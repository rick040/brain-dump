import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = ["idee", "notitie", "taak", "later", "werk", "klant"];

export default function RecordPage() {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | recording | processing | done
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const finalRef = useRef("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const r = new SR();
    r.lang = "nl-NL";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let interim = "";
      let final = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + " ";
          finalRef.current = final;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscript(final.trim());
      setInterimText(interim);
    };

    r.onerror = (e) => {
      if (e.error !== "aborted") setError("Microfoon fout: " + e.error);
      setStatus("idle");
    };

    r.onend = () => {
      if (status === "recording") setStatus("processing");
      setInterimText("");
    };

    recognitionRef.current = r;
  }, []);

  function startRecording() {
    setTranscript("");
    setInterimText("");
    setName("");
    finalRef.current = "";
    setError("");
    try {
      recognitionRef.current?.start();
      setStatus("recording");
    } catch (e) {
      setError("Kan niet starten: " + e.message);
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setStatus("processing");
  }

  async function handleSave() {
    const text = transcript.trim();
    if (!text) { setError("Geen tekst om op te slaan"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: dbError } = await supabase.from("brain_dump").insert({
      user_id: user?.id,
      name: name.trim() || text.slice(0, 60),
      content: text,
      type: "notitie",
      tags,
    });
    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setStatus("done");
    setTimeout(() => router.push("/"), 1200);
  }

  function reset() { setStatus("idle"); setTranscript(""); setInterimText(""); setName(""); finalRef.current = ""; setError(""); }

  const isRecording = status === "recording";
  const hasText = transcript.trim().length > 0;

  return (
    <>
      <Head>
        <title>Opnemen - Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={s.root}>
        <div style={s.header}>
          <span style={s.title}>Voicenote</span>
          {(status === "processing" || status === "done") && (
            <button onClick={reset} style={s.resetBtn}>Opnieuw</button>
          )}
        </div>

        {!supported && (
          <div style={s.unsupported}>
            <div style={s.unsupportedIcon}>⚠</div>
            <div style={s.unsupportedText}>Speech herkenning wordt niet ondersteund in deze browser. Gebruik Chrome op Android.</div>
          </div>
        )}

        {supported && (
          <>
            {/* Record button */}
            {(status === "idle" || status === "recording") && (
              <div style={s.recordSection}>
                <button
                  onPointerDown={startRecording}
                  onPointerUp={stopRecording}
                  onPointerLeave={isRecording ? stopRecording : undefined}
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{ ...s.recordBtn, ...(isRecording ? s.recordBtnActive : {}) }}
                >
                  <span style={{ ...s.recordIcon, ...(isRecording ? s.recordIconActive : {}) }}>
                    {isRecording ? "■" : "◉"}
                  </span>
                </button>
                <div style={s.recordHint}>
                  {isRecording ? "Aan het luisteren... tik om te stoppen" : "Tik en houd ingedrukt om op te nemen"}
                </div>
                {isRecording && (
                  <div style={s.waveWrap}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} style={{ ...s.wave, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transcript display */}
            {(isRecording || hasText || status === "processing") && (
              <div style={s.transcriptBox}>
                <div style={s.transcriptLabel}>TRANSCRIPT</div>
                <div style={s.transcriptText}>
                  {transcript}
                  {interimText && <span style={s.interim}> {interimText}</span>}
                  {!transcript && !interimText && status === "recording" && <span style={s.listening}>luisteren...</span>}
                </div>
              </div>
            )}

            {/* Save form */}
            {(status === "processing" || status === "done") && hasText && (
              <div style={s.saveForm}>
                <div style={s.field}>
                  <label style={s.label}>Naam (optioneel)</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={transcript.slice(0, 50) + "..."} style={s.input} maxLength={80} />
                </div>

                <div style={s.field}>
                  <label style={s.label}>Tags</label>
                  <div style={s.tagRow}>
                    {DEFAULT_TAGS.map((t) => (
                      <button key={t} onClick={() => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])} style={{ ...s.tagBtn, ...(tags.includes(t) ? s.tagBtnActive : {}) }}>{t}</button>
                    ))}
                  </div>
                </div>

                {error && <div style={s.error}>{error}</div>}

                <button onClick={handleSave} disabled={saving || status === "done"} style={{ ...s.saveBtn, ...(saving || status === "done" ? s.saveBtnDone : {}) }}>
                  {status === "done" ? "Opgeslagen ✓" : saving ? "Opslaan..." : "Opslaan"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 28px; }
        }
      `}</style>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "24px 16px 40px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.02em" },
  resetBtn: { fontSize: 13, color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" },
  recordSection: { display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 20 },
  recordBtn: { width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "3px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", backdropFilter: "blur(8px)" },
  recordBtnActive: { background: "rgba(232,85,85,0.25)", border: "3px solid #E85555", transform: "scale(1.05)" },
  recordIcon: { fontSize: 40, color: "rgba(255,255,255,0.8)" },
  recordIconActive: { color: "#E85555" },
  recordHint: { fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", maxWidth: 240 },
  waveWrap: { display: "flex", alignItems: "center", gap: 4, height: 36 },
  wave: { width: 4, height: 8, background: "var(--accent)", borderRadius: 2, animation: "wave 0.6s ease-in-out infinite" },
  transcriptBox: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  transcriptLabel: { fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 },
  transcriptText: { fontSize: 15, lineHeight: 1.7, color: "var(--text)", minHeight: 60 },
  interim: { color: "var(--muted)", fontStyle: "italic" },
  listening: { color: "var(--muted)", fontStyle: "italic" },
  saveForm: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--text)", boxShadow: "var(--shadow-sm)", width: "100%" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagBtn: { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "var(--font)" },
  tagBtnActive: { background: "var(--accent)", color: "var(--accent-text)" },
  error: { fontSize: 12, color: "var(--danger)", padding: "8px 12px", background: "rgba(232,85,85,0.12)", borderRadius: 8 },
  saveBtn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 15, padding: "15px", borderRadius: 12, width: "100%", border: "none", cursor: "pointer", fontFamily: "var(--font)" },
  saveBtnDone: { opacity: 0.5 },
  unsupported: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" },
  unsupportedIcon: { fontSize: 32 },
  unsupportedText: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6 },
};
