// Groq Whisper API transcription endpoint
// Free tier: 2000 minutes/day. Dutch: use whisper-large-v3

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY niet ingesteld in Vercel env vars" });

  try {
    // Read raw audio buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "audio/webm";

    // Build multipart form for Groq
    const boundary = "----BrainDumpBoundary" + Date.now();
    const CRLF = "\r\n";

    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="audio.webm"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`
    );
    const modelField = Buffer.from(
      `${CRLF}--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      `whisper-large-v3${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
      `nl${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
      `json${CRLF}` +
      `--${boundary}--${CRLF}`
    );

    const body = Buffer.concat([header, buffer, modelField]);

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "Groq transcriptie mislukt", detail: err.slice(0, 200) });
    }

    const data = await groqRes.json();
    return res.json({ transcript: data.text || "" });
  } catch (err) {
    console.error("Transcribe error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
