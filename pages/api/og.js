function decode(str) {
  if (!str) return "";
  return str.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&apos;/g,"'")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x[0-9a-fA-F]+;/g,"").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"").trim();
}

function domain(url) {
  try { return new URL(url).hostname.replace("www.",""); } catch { return ""; }
}

function toAbsolute(src, base) {
  if (!src) return null;
  if (src.startsWith("http")) return src;
  try { return new URL(src, base).href; } catch { return null; }
}

function detectType(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "video";
  if (/vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/pinterest\.com|pin\.it/.test(url)) return "pinterest";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}

function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

async function fetchMicrolink(url, timeout = 8000) {
  const r = await fetch(
    `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`,
    { headers: { "User-Agent": "BrainDump/1.0" }, signal: AbortSignal.timeout(timeout) }
  );
  const ml = await r.json();
  return ml.status === "success" ? ml.data : null;
}

async function fetchOgFromHtml(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)" },
    signal: AbortSignal.timeout(5000),
  });
  const html = await r.text();
  const og = (p) => {
    const m = html.match(new RegExp(`<meta[^>]*property=["']${p}["'][^>]*content=["']([^"']+)["']`, "i"))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${p}["']`, "i"))
      || html.match(new RegExp(`<meta[^>]*name=["']${p}["'][^>]*content=["']([^"']+)["']`, "i"));
    return decode(m?.[1] || "");
  };
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const image = og("og:image");
  return {
    title: og("og:title") || decode(titleM?.[1] || ""),
    description: og("og:description") || og("description"),
    image: toAbsolute(image, url),
    siteName: og("og:site_name") || domain(url),
  };
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  const t = detectType(url);
  const d = domain(url);

  // YouTube: guaranteed thumbnail
  if (t === "video" && /youtube|youtu\.be/.test(url)) {
    const thumb = ytThumb(url);
    try {
      const ml = await fetchMicrolink(url, 5000);
      if (ml) return res.json({ title: decode(ml.title||""), description: decode(ml.description||""), image: thumb, siteName: "YouTube", type: t });
    } catch (_) {}
    return res.json({ title: "", description: "", image: thumb, siteName: "YouTube", type: t });
  }

  // Instagram
  if (t === "instagram") {
    try {
      const ml = await fetchMicrolink(url);
      if (ml) {
        const image = ml.image?.url || ml.video?.poster || null;
        let caption = decode(ml.description || "");
        caption = caption.replace(/^\d+\s*likes?,\s*\d+\s*comments?\s*[-–]\s*/i, "").trim();
        return res.json({ title: decode(ml.title||""), description: caption, image, siteName: "Instagram", type: t });
      }
    } catch (_) {}
    return res.json({ title: "", description: "", image: null, siteName: "Instagram", type: t });
  }

  // Pinterest
  if (t === "pinterest") {
    try {
      const ml = await fetchMicrolink(url);
      if (ml) {
        const image = ml.image?.url || null;
        // Pinterest description is often the board/pin title
        const description = decode(ml.description || "");
        return res.json({ title: decode(ml.title||""), description, image, siteName: "Pinterest", type: t });
      }
    } catch (_) {}
    // HTML fallback for Pinterest
    try {
      const data = await fetchOgFromHtml(url);
      return res.json({ ...data, siteName: "Pinterest", type: t });
    } catch (_) {}
    return res.json({ title: "", description: "", image: null, siteName: "Pinterest", type: t });
  }

  // All other web URLs: try microlink first, then HTML fallback
  try {
    const ml = await fetchMicrolink(url);
    if (ml) {
      const image = ml.image?.url || ml.logo?.url || null;
      if (image || ml.title) {
        return res.json({
          title: decode(ml.title||""),
          description: decode(ml.description||""),
          image,
          siteName: decode(ml.publisher||d),
          type: t,
        });
      }
    }
  } catch (_) {}

  // HTML direct fetch fallback
  try {
    const data = await fetchOgFromHtml(url);
    return res.json({ ...data, type: t });
  } catch (_) {
    return res.json({ title: "", description: "", image: null, siteName: d, type: t });
  }
}
