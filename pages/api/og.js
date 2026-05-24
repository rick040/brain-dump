export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL" });

  try {
    // Microlink handles Instagram, YouTube, Twitter, and most sites
    const mlRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`,
      { headers: { "User-Agent": "BrainDump/1.0" } }
    );
    const mlData = await mlRes.json();

    if (mlData.status === "success") {
      return res.json({
        title: mlData.data.title || "",
        description: mlData.data.description || "",
        image: mlData.data.image?.url || mlData.data.logo?.url || null,
        siteName: mlData.data.publisher || "",
        type: detectType(url, mlData.data),
      });
    }

    // Fallback: basic HTML fetch + OG parse
    const htmlRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrainDump/1.0) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    const html = await htmlRes.text();

    const get = (prop) => {
      const m =
        html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, "i"));
      return m?.[1] || "";
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return res.json({
      title: get("og:title") || titleMatch?.[1] || "",
      description: get("og:description") || get("description") || "",
      image: get("og:image") || null,
      siteName: get("og:site_name") || "",
      type: detectType(url, {}),
    });
  } catch (err) {
    return res.json({ title: "", description: "", image: null, siteName: "", type: "link" });
  }
}

function detectType(url, data) {
  if (/youtube|youtu\.be/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  if (/vimeo\.com/.test(url)) return "video";
  if (data?.video) return "video";
  return "link";
}
