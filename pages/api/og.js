function decode(str) {
  if (!str) return "";
  return str.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&apos;/g,"'")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x[0-9a-fA-F]+;/g,"").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"").trim();
}
function domain(url) { try { return new URL(url).hostname.replace("www.",""); } catch { return ""; } }
function type(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "video";
  if (/vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}
function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  const t = type(url);
  const d = domain(url);

  // YouTube: direct thumbnail always works
  if (t === "video" && /youtube|youtu\.be/.test(url)) {
    const thumb = ytThumb(url);
    try {
      const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`, { signal: AbortSignal.timeout(5000) });
      const ml = await r.json();
      if (ml.status === "success") return res.json({ title: decode(ml.data.title||""), description: decode(ml.data.description||""), image: thumb, siteName: "YouTube", type: t });
    } catch (_) {}
    return res.json({ title: "", description: "", image: thumb, siteName: "YouTube", type: t });
  }

  // Instagram: microlink handles it, og:image is the actual post image
  // Also try to get caption from description
  if (t === "instagram") {
    try {
      const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`, { headers: { "User-Agent": "BrainDump/1.0" }, signal: AbortSignal.timeout(8000) });
      const ml = await r.json();
      if (ml.status === "success") {
        const data = ml.data;
        // Instagram image comes back as data.image or data.video.poster
        const image = data.image?.url || data.video?.poster || null;
        // Caption is in description, strip the "X likes, Y comments - " prefix
        let caption = decode(data.description || "");
        caption = caption.replace(/^\d+ likes?,\s*\d+ comments?\s*-\s*/i, "").trim();
        return res.json({ title: decode(data.title || ""), description: caption, image, siteName: "Instagram", type: t });
      }
    } catch (_) {}
  }

  // All other URLs: microlink OG image (no screenshot)
  try {
    const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false&meta=false`, { headers: { "User-Agent": "BrainDump/1.0" }, signal: AbortSignal.timeout(8000) });
    const ml = await r.json();
    if (ml.status === "success") {
      return res.json({ title: decode(ml.data.title||""), description: decode(ml.data.description||""), image: ml.data.image?.url || ml.data.logo?.url || null, siteName: decode(ml.data.publisher||d), type: t });
    }
  } catch (_) {}

  // HTML fallback
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BrainDump/1.0)" }, signal: AbortSignal.timeout(5000) });
    const html = await r.text();
    const og = (p) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']${p}["'][^>]*content=["']([^"']+)["']`,"i"))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${p}["']`,"i"))
        || html.match(new RegExp(`<meta[^>]*name=["']${p}["'][^>]*content=["']([^"']+)["']`,"i"));
      return decode(m?.[1]||"");
    };
    const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return res.json({ title: og("og:title")||decode(titleM?.[1]||""), description: og("og:description")||og("description"), image: og("og:image")||null, siteName: og("og:site_name")||d, type: t });
  } catch (_) {
    return res.json({ title: "", description: "", image: null, siteName: d, type: t });
  }
}
