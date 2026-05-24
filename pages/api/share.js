import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const config = {
  api: { bodyParser: false },
};

// Parse multipart form data without external deps
async function parseMultipart(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        // fallback: try urlencoded
        const params = new URLSearchParams(body);
        return resolve({
          title: params.get("title") || "",
          text: params.get("text") || "",
          url: params.get("url") || "",
        });
      }
      const parts = body.split(`--${boundary}`).filter((p) => p.includes("Content-Disposition"));
      const fields = {};
      parts.forEach((part) => {
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) return;
        const name = nameMatch[1];
        const value = part.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
        fields[name] = value;
      });
      resolve({
        title: fields.title || "",
        text: fields.text || "",
        url: fields.url || "",
      });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { title, text, url } = await parseMultipart(req);

  // Build redirect URL with prefilled data for the save page
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (text) params.set("text", text);
  if (url) params.set("url", url);

  // Redirect to /save page where user can name + tag
  res.redirect(302, `/save?${params.toString()}`);
}
