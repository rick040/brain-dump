import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "Geen bericht" });

  // Fetch recent entries for context
  const { data: entries } = await supabase
    .from("brain_dump")
    .select("id,name,content,url,type,tags,og_description,created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  const entrySummary = (entries || []).map((e) => ({
    id: e.id.slice(0, 8),
    naam: e.name,
    type: e.type,
    tags: e.tags?.join(", ") || "",
    inhoud: (e.og_description || e.content || "").slice(0, 120),
    datum: e.created_at?.slice(0, 10),
  }));

  const systemPrompt = `Je bent een persoonlijke kennisassistent die toegang heeft tot de brain dump database van de gebruiker. 
Je helpt de gebruiker hun opgeslagen kennis te doorzoeken, verbanden te vinden en vragen te beantwoorden.

BRAIN DUMP DATABASE (${entrySummary.length} entries):
${JSON.stringify(entrySummary)}

Regels:
- Antwoord in het Nederlands
- Wees direct en concreet
- Verwijs naar specifieke entries bij naam als dat relevant is
- Als je patronen ziet, benoem ze
- Houd antwoorden bondig maar informatief
- Je kunt vragen beantwoorden als "wat heb ik opgeslagen over X?", "wat is mijn meest opgeslagen type?", "geef me ideeën op basis van mijn saves", etc.`;

  const messages = [
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await aiRes.json();
    const reply = data.content?.[0]?.text || "Geen antwoord ontvangen";
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
