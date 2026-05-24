import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}

// Properly parse multipart - split headers from body at \r\n\r\n
function parseMultipartTextFields(rawBuffer, boundary) {
  const fields = {};
  const body = rawBuffer.toString("binary");
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    // Headers and body are separated by \r\n\r\n
    const splitIdx = part.indexOf("\r\n\r\n");
    if (splitIdx === -1) continue;

    const headers = part.substring(0, splitIdx);
    const value = part.substring(splitIdx + 4).replace(/\r\n$/, "").trim();

    // Only process form fields (no filename = no file upload)
    if (headers.includes("filename=")) continue;

    const nameMatch = headers.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;

    fields[nameMatch[1]] = value;
  }
  return fields;
}

function extractUrl(str) {
  if (!str) return "";
  const match = str.match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0].replace(/[.,;:!?)]+$/, "") : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const contentType = req.headers["content-type"] || "";
  const rawBuffer = await readBody(req);
  const rawBody = rawBuffer.toString("utf8");

  let fields = {};
  let hasFile = false;

  if (contentType.includes("multipart/form-data")) {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    const boundary = boundaryMatch?.[1];

    if (boundary) {
      hasFile = rawBody.includes('filename="') || rawBody.includes("Content-Type: image") || rawBody.includes("Content-Type: video");

      if (hasFile) {
        try {
          const formidable = (await import("formidable")).default;
          const form = formidable({ maxFileSize: 15 * 1024 * 1024, keepExtensions: true });
          const [fFields, fFiles] = await new Promise((resolve, reject) => {
            form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
          });

          const g = (v) => Array.isArray(v) ? v[0] : v || "";
          fields = { title: g(fFields.title), text: g(fFields.text), url: g(fFields.url) };

          const mediaFile = Array.isArray(fFiles.media) ? fFiles.media[0] : fFiles.media;
          if (mediaFile?.filepath) {
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
                const params = new URLSearchParams();
                if (fields.title) params.set("title", fields.title);
                if (fields.text) params.set("text", fields.text);
                params.set("imageUrl", urlData.publicUrl);
                params.set("mediaType", mimeType.startsWith("video") ? "video" : "afbeelding");
                return res.redirect(302, `/save?${params.toString()}`);
              }
            }
          }
        } catch (err) {
          console.error("File upload error:", err.message);
        }
      } else {
        // Text-only share: parse properly
        fields = parseMultipartTextFields(rawBuffer, boundary);
      }
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(rawBody);
    fields = { title: p.get("title") || "", text: p.get("text") || "", url: p.get("url") || "" };
  }

  let { title = "", text = "", url = "" } = fields;

  // Strip any Content-Type or header bleed from field values
  title = title.replace(/^Content-Type:\s*\S+\s*/i, "").trim();
  text = text.replace(/^Content-Type:\s*\S+\s*/i, "").trim();

  // Extract URL from text if url field is empty
  if (!url) {
    const found = extractUrl(text);
    if (found) {
      url = found;
      text = text.replace(found, "").replace(/\s{2,}/g, " ").trim();
    }
  }

  if (!url && title.startsWith("http")) {
    url = title;
    title = "";
  }

  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (text) params.set("text", text);
  if (url) params.set("url", url);

  res.redirect(302, `/save?${params.toString()}`);
}
