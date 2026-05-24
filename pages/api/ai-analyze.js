import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  // Fetch all entries
  const { data: entries, error } = await supabase.from("brain_dump").select("id,name,content,url,type,tags,og_description,created_at").order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  if (!entries?.length) return res.json({ clusters: [], connections: [], ideas: [], summary: "Nog geen entries om te analyseren." });

  // Build compact representation for Claude
  const entryList = entries.map((e) => ({
    id: e.id,
    naam: e.name,
    type: e.type,
    tags: e.tags,
    inhoud: e.og_description || e.content || "",
    url: e.url || "",
    datum: e.created_at?.slice(0, 10),
  }));

  const prompt = `Je bent een persoonlijke kennisassistent. Analyseer de volgende brain dump entries van een creatieve ondernemer/designer en geef een rijke analyse.

ENTRIES:
${JSON.stringify(entryList, null, 2)}

Analyseer deze entries grondig en geef je antwoord ALLEEN als JSON (geen markdown, geen uitleg erbuiten):

{
  "summary": "2-3 zinnen over wat deze persoon bezighoudt en zijn interesses",
  "clusters": [
    {
      "id": "uniek-id",
      "title": "Cluster naam",
      "description": "Wat verbindt deze entries",
      "entry_ids": ["id1", "id2"],
      "insight": "Wat dit onthult over de gebruiker",
      "strength": "hoog|medium|laag"
    }
  ],
  "connections": [
    {
      "title": "Onverwachte verbinding",
      "description": "Hoe deze entries samenhangen ondanks dat ze anders lijken",
      "entry_ids": ["id1", "id2"],
      "potential": "Waarom dit interessant is"
    }
  ],
  "ideas": [
    {
      "title": "Project/idee titel",
      "description": "Concreet uitgewerkt idee gebaseerd op de patterns",
      "why": "Waarom dit perfect past bij deze persoon",
      "entry_ids": ["id1", "id2"],
      "priority": "hoog|medium|laag"
    }
  ],
  "forgotten": [
    {
      "entry_id": "id",
      "entry_name": "naam",
      "reason": "Waarom dit relevant is om opnieuw te bekijken"
    }
  ]
}

Regels:
- Genereer 3-6 clusters, 2-4 onverwachte verbindingen, 3-5 ideeën, 2-4 vergeten items
- Wees specifiek, gebruik echte namen en details uit de entries
- Geef prioriteit aan entries die meerdere keren terugkomen als thema
- Denk als een slimme mentor die patronen ziet die de gebruiker zelf mist`;

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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "AI gaf geen valide JSON terug", raw: text.slice(0, 200) });

    const result = JSON.parse(jsonMatch[0]);
    return res.json({ ...result, analyzedAt: new Date().toISOString(), entryCount: entries.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
