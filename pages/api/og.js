export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  // Microlink met screenshot=true geeft altijd een bruikbare preview
  try {
    const mlRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
      {
        headers: { "User-Agent": "BrainDump/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    const ml = await mlRes.json();

    if (ml.status === "success") {
      const d = ml.data;
      return res.json({
        title: d.title || "",
        description: d.description || "",
        // Voorkeur: screenshot van de site zelf, dan og image, dan logo
        image: d.screenshot?.url || d.image?.url || d.logo?.url || null,
        siteName: d.publisher || extractDomain(url),
        type: detectType(url, d),
      });
    }
  } catch (err) {
    // Microlink timeout of fout - val terug op eigen OG parse
  }

  // Fallback: zelf OG tags ophalen
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
      return m?.[1]?.trim() || "";
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return res.json({
      title: og("og:title") || titleMatch?.[1]?.trim() || "",
      description: og("og:description") || og("description") || "",
      image: og("og:image") || null,
      siteName: og("og:site_name") || extractDomain(url),
      type: detectType(url, {}),
    });
  } catch {
    return res.json({ title: "", description: "", image: null, siteName: extractDomain(url), type: "link" });
  }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

function detectType(url, data) {
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  if (data?.video) return "video";
  return "link";
}
