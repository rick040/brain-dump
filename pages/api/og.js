function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x[0-9a-fA-F]+;/g, "").replace(/&#\d+;/g, "").replace(/&[a-z]+;/g, "")
    .trim();
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

function detectType(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "video";
  if (/vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}

function getYoutubeThumbnail(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  const type = detectType(url);
  const domain = extractDomain(url);

  // YouTube: direct thumbnail, no API
  if (type === "video" && /youtube|youtu\.be/.test(url)) {
    const thumb = getYoutubeThumbnail(url);
    try {
      const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`, { signal: AbortSignal.timeout(5000) });
      const d = (await ml.json()).data || {};
      return res.json({ title: decodeEntities(d.title || ""), description: decodeEntities(d.description || ""), image: thumb, siteName: "YouTube", type });
    } catch (_) {}
    return res.json({ title: "", description: "", image: thumb, siteName: "YouTube", type });
  }

  // All other URLs: microlink WITHOUT screenshot (OG image only, like WhatsApp)
  try {
    const mlRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false&meta=false`,
      { headers: { "User-Agent": "BrainDump/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    const ml = await mlRes.json();
    if (ml.status === "success") {
      const d = ml.data;
      return res.json({
        title: decodeEntities(d.title || ""),
        description: decodeEntities(d.description || ""),
        image: d.image?.url || d.logo?.url || null,
        siteName: decodeEntities(d.publisher || domain),
        type,
      });
    }
  } catch (_) {}

  // Fallback: fetch HTML, parse OG tags ourselves
  try {
    const htmlRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BrainDump/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await htmlRes.text();
    const og = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, "i"))
        || html.match(new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"));
      return decodeEntities(m?.[1]?.trim() || "");
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return res.json({
      title: og("og:title") || decodeEntities(titleMatch?.[1]?.trim() || ""),
      description: og("og:description") || og("description"),
      image: og("og:image") || null,
      siteName: og("og:site_name") || domain,
      type,
    });
  } catch (_) {
    return res.json({ title: "", description: "", image: null, siteName: domain, type });
  }
}
