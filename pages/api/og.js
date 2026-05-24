function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x[0-9a-fA-F]+;/g, "")
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/g, "")
    .trim();
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

function detectType(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "video";
  if (/vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}

// Direct YouTube thumbnail - always works, no API needed
function getYoutubeThumbnail(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  const type = detectType(url);
  const domain = extractDomain(url);

  // YouTube: direct thumbnail, no API needed
  if (type === "video" && /youtube|youtu\.be/.test(url)) {
    const thumb = getYoutubeThumbnail(url);
    // Still fetch title via microlink but don't wait for screenshot
    try {
      const ml = await fetch(
        `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`,
        { signal: AbortSignal.timeout(5000) }
      );
      const mlData = await ml.json();
      if (mlData.status === "success") {
        return res.json({
          title: decodeEntities(mlData.data.title || ""),
          description: decodeEntities(mlData.data.description || ""),
          image: thumb,
          siteName: "YouTube",
          type,
        });
      }
    } catch (_) {}
    return res.json({ title: "", description: "", image: thumb, siteName: "YouTube", type });
  }

  // All other URLs: try microlink with screenshot
  try {
    const mlRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false`,
      {
        headers: { "User-Agent": "BrainDump/1.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    const ml = await mlRes.json();

    if (ml.status === "success") {
      const d = ml.data;
      const image = d.screenshot?.url || d.image?.url || d.logo?.url || null;
      return res.json({
        title: decodeEntities(d.title || ""),
        description: decodeEntities(d.description || ""),
        image,
        siteName: decodeEntities(d.publisher || domain),
        type,
      });
    }
  } catch (_) {}

  // Final fallback: fetch HTML and parse OG tags
  try {
    const htmlRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BrainDump/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await htmlRes.text();

    const og = (prop) => {
      const m =
        html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"));
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
