import formidable from "formidable";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

export const config = {
  api: { bodyParser: false },
};

// Use service key for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable({ maxFileSize: 15 * 1024 * 1024, keepExtensions: true });

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    console.error("Form parse error:", err);
    return res.status(400).json({ error: "Form parse failed" });
  }

  const title = Array.isArray(fields.title) ? fields.title[0] : fields.title || "";
  const text = Array.isArray(fields.text) ? fields.text[0] : fields.text || "";
  const url = Array.isArray(fields.url) ? fields.url[0] : fields.url || "";
  const mediaFile = files.media?.[0] || files.media;

  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (text) params.set("text", text);
  if (url) params.set("url", url);

  // Handle image/video upload
  if (mediaFile) {
    try {
      const fileBuffer = readFileSync(mediaFile.filepath);
      const ext = mediaFile.originalFilename?.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("media")
        .upload(fileName, fileBuffer, {
          contentType: mediaFile.mimetype || "image/jpeg",
          upsert: false,
        });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          params.set("imageUrl", urlData.publicUrl);
          params.set("mediaType", mediaFile.mimetype?.startsWith("video") ? "video" : "image");
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  }

  res.redirect(302, `/save?${params.toString()}`);
}
