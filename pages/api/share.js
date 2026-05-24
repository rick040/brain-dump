import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Read raw body as string
function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(""));
  });
}

// Parse multipart/form-data manually for text fields only (no file)
function parseMultipart(body, boundary) {
  const fields = {};
  const parts = body.split(`--${boundary}`);
  for (const part of parts) {
    const match = part.match(/Content-Disposition: form-data; name="([^"]+)"[\r\n]+([^]+)/i);
    if (match) {
      fields[match[1]] = match[2].replace(/\r?\n$/, "").trim();
    }
  }
  return fields;
}

// Extract first URL from a string
function extractUrl(str) {
  if (!str) return "";
  const match = str.match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const contentType = req.headers["content-type"] || "";
  const rawBody = await readBody(req);

  let fields = {};
  let hasFile = false;

  // Detect if request contains a file (binary data)
  if (contentType.includes("multipart/form-data")) {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    const boundary = boundaryMatch?.[1];

    if (boundary) {
      // Check if there's binary/file content
      hasFile = rawBody.includes('filename="') || rawBody.includes("Content-Type: image") || rawBody.includes("Content-Type: video");

      if (hasFile) {
        // Use formidable for file uploads
        try {
          const formidable = (await import("formidable")).default;
          const { IncomingMessage } = await import("http");

          // Reconstruct a fresh request for formidable from raw body
          const form = formidable({ maxFileSize: 15 * 1024 * 1024, keepExtensions: true });
          const [fFields, fFiles] = await new Promise((resolve, reject) => {
            form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
          });

          const getF = (v) => Array.isArray(v) ? v[0] : v || "";
          fields = {
            title: getF(fFields.title),
            text: getF(fFields.text),
            url: getF(fFields.url),
          };

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
          console.error("Formidable error:", err.message);
        }
      } else {
        // No file - parse text fields from multipart manually
        fields = parseMultipart(rawBody, boundary);
      }
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(rawBody);
    fields = { title: p.get("title") || "", text: p.get("text") || "", url: p.get("url") || "" };
  }

  let { title = "", text = "", url = "" } = fields;

  // Many apps (Instagram, Chrome) put the URL inside the text field
  if (!url) {
    const urlInText = extractUrl(text);
    if (urlInText) {
      url = urlInText;
      text = text.replace(urlInText, "").replace(/\s{2,}/g, " ").trim();
    }
  }

  // Some apps put URL as title
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
