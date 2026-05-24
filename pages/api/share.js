import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseForm(req) {
  return new Promise(async (resolve, reject) => {
    try {
      // Dynamic import avoids SSR issues with formidable
      const formidable = (await import("formidable")).default;
      const form = formidable({ maxFileSize: 15 * 1024 * 1024, keepExtensions: true });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function field(val) {
  return Array.isArray(val) ? val[0] : val || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err) {
    console.error("Form parse error:", err.message);
    // Fallback redirect even on parse failure
    return res.redirect(302, "/save");
  }

  const title = field(fields.title);
  const text = field(fields.text);
  const url = field(fields.url);
  const mediaFile = Array.isArray(files.media) ? files.media[0] : files.media;

  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (text) params.set("text", text);
  if (url) params.set("url", url);

  if (mediaFile?.filepath) {
    try {
      const fileBuffer = readFileSync(mediaFile.filepath);
      const mimeType = mediaFile.mimetype || "image/jpeg";
      const ext = mediaFile.originalFilename?.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("media")
        .upload(fileName, fileBuffer, { contentType: mimeType, upsert: false });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          params.set("imageUrl", urlData.publicUrl);
          params.set("mediaType", mimeType.startsWith("video") ? "video" : "afbeelding");
        }
      } else if (error) {
        console.error("Storage error:", error.message);
      }
    } catch (err) {
      console.error("File read/upload error:", err.message);
    }
  }

  res.redirect(302, `/save?${params.toString()}`);
}
