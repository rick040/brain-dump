import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = ["idee", "notitie", "taak", "later", "werk", "klant"];

export default function RecordPage() {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | recording | stopped | saving | saved
  const [transcript, setTranscript] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState(new Array(32).fill(0.1));

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startRecording() {
    setError("");
    setTranscript("");
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      // Audio analyser for waveform viz
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      function updateLevels() {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const levels = Array.from(data).map((v) => Math.max(0.05, v / 255));
        setAudioLevels(levels);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      }
      updateLevels();

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { ctx.close(); cancelAnimationFrame(animFrameRef.current); clearInterval(timerRef.current); };
      mr.start(100);
      mediaRecorderRef.current = mr;

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setStatus("recording");
    } catch (e) {
      setError("Microfoon toegang geweigerd. Geef toestemming in je browser.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setAudioLevels(new Array(32).fill(0.1));
    setStatus("stopped");
    transcribeAudio();
  }

  async function transcribeAudio() {
    if (!chunksRef.current.length) return;
    setStatus("stopped");

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: blob,
      });
      const data = await res.json();
      if (data.transcript) {
        setTranscript(data.transcript);
        setName(data.transcript.slice(0, 60));
      } else {
        setError(data.error || "Transcriptie mislukt");
      }
    } catch (e) {
      setError("Transcriptie mislukt: " + e.message);
    }
  }

  async function handleDump() {
    if (!transcript.trim()) return;
    setStatus("saving");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: dbError } = await supabase.from("brain_dump").insert({
      user_id: user?.id,
      name: name.trim() || transcript.slice(0, 60),
      content: transcript.trim(),
      type: "notitie",
      tags,
    });
    if (dbError) { setError(dbError.message); setStatus("stopped"); return; }
    setStatus("saved");
    setTimeout(() => router.push("/"), 900);
  }

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <>
      <Head>
        <title>Record - Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div style={s.root}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLogo}>●&nbsp;Brain Dump</div>
        </div>

        {/* Main content */}
        {status === "idle" && (
          <div style={s.idleContent}>
            <div style={s.idleTitle}>
              <span>Zeg het.</span><br />
              <span>Type het.</span><br />
              <span style={{ color: "var(--sage)" }}>Dump het.</span>
            </div>
            <div style={s.idleHint}>Tik en houd ingedrukt om op te nemen — of typ het gewoon.</div>
          </div>
        )}

        {status === "recording" && (
          <div style={s.recordingContent}>
            <div style={s.timer}>{formatTime(duration)}</div>
            <div style={s.waveform}>
              {audioLevels.slice(0, 24).map((level, i) => (
                <div key={i} style={{ ...s.waveBar, height: `${Math.max(4, level * 64)}px`, opacity: 0.4 + level * 0.6 }} />
              ))}
            </div>
            <div style={s.listeningTxt}>Aan het luisteren...</div>
          </div>
        )}

        {(status === "stopped" || status === "saving") && !transcript && (
          <div style={s.processingWrap}>
            <div style={s.spinner} />
            <div style={s.processingTxt}>Transcriberen...</div>
          </div>
        )}

        {status === "saved" && (
          <div style={s.savedWrap}>
            <div style={s.savedIcon}>✓</div>
            <div style={s.savedTxt}>Gedumpt!</div>
          </div>
        )}

        {/* Bottom sheet - shown when transcript ready */}
        {(status === "stopped" || status === "saving") && transcript && (
          <div style={s.sheet}>
            <div style={s.sheetHandle} />
            <div style={s.sheetTitle}>Klaar om te dumpen</div>

            <div style={s.transcriptBox}>
              <div style={s.transcriptLabel}>TRANSCRIPT</div>
              <div style={s.transcriptText}>{transcript}</div>
            </div>

            <div style={s.nameWrap}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam (optioneel)..." style={s.nameInput} maxLength={80} />
            </div>

            <div style={s.tagRow}>
              {DEFAULT_TAGS.map((t) => (
                <button key={t} onClick={() => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])} style={{ ...s.tagBtn, ...(tags.includes(t) ? s.tagBtnActive : {}) }}>{t}</button>
              ))}
            </div>

            {error && <div style={s.errorTxt}>{error}</div>}

            <div style={s.sheetActions}>
              <button onClick={() => { setStatus("idle"); setTranscript(""); setName(""); }} style={s.discardBtn}>Weggooien</button>
              <button onClick={handleDump} disabled={status === "saving"} style={s.dumpBtn}>
                <span style={s.dumpDot} />
                {status === "saving" ? "Opslaan..." : "Dump"}
              </button>
            </div>
          </div>
        )}

        {/* Record button (shown when idle or recording) */}
        {(status === "idle" || status === "recording") && (
          <div style={s.btnArea}>
            {error && <div style={s.errorTxt}>{error}</div>}
            <button
              onPointerDown={status === "idle" ? startRecording : undefined}
              onClick={status === "recording" ? stopRecording : undefined}
              style={{ ...s.micBtn, ...(status === "recording" ? s.micBtnActive : {}) }}
            >
              {status === "recording" ? (
                <span style={s.stopIcon} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/></svg>
              )}
            </button>
            <div style={s.micHint}>{status === "recording" ? "Tik om te stoppen" : "Tik om op te nemen"}</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { 0% { transform: scale(0.8); opacity:0; } 100% { transform: scale(1); opacity:1; } }
      `}</style>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg-dark, #0D130B)", display: "flex", flexDirection: "column", padding: "20px var(--page-pad) 0", position: "relative", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerLogo: { fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" },
  idleContent: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 120, gap: 16 },
  idleTitle: { fontWeight: 800, fontSize: 44, lineHeight: 1.1, color: "#fff", letterSpacing: "-0.03em" },
  idleHint: { fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, maxWidth: 260 },
  recordingContent: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, paddingBottom: 120 },
  timer: { fontWeight: 800, fontSize: 56, color: "#fff", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" },
  waveform: { display: "flex", alignItems: "center", gap: 3, height: 80 },
  waveBar: { width: 5, background: "var(--accent)", borderRadius: 3, transition: "height 0.05s ease" },
  listeningTxt: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  processingWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 },
  spinner: { width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  processingTxt: { fontSize: 14, color: "rgba(255,255,255,0.4)" },
  savedWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 },
  savedIcon: { width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "var(--accent-text)", fontWeight: 700, animation: "pop 0.3s ease" },
  savedTxt: { fontWeight: 700, fontSize: 20, color: "#fff" },
  // Bottom sheet
  sheet: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "24px 24px 0 0", padding: "12px 20px 36px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp 0.3s ease", boxShadow: "0 -8px 40px rgba(0,0,0,0.3)" },
  sheetHandle: { width: 36, height: 4, background: "rgba(0,0,0,0.12)", borderRadius: 2, margin: "0 auto 4px" },
  sheetTitle: { fontWeight: 700, fontSize: 15, color: "var(--text)" },
  transcriptBox: { background: "var(--bg)", borderRadius: 14, padding: "12px 14px" },
  transcriptLabel: { fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 6 },
  transcriptText: { fontSize: 15, color: "var(--text)", lineHeight: 1.6 },
  nameWrap: {},
  nameInput: { width: "100%", background: "var(--bg)", border: "none", borderRadius: 12, padding: "11px 14px", fontSize: 15, color: "var(--text)", fontFamily: "var(--font)" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagBtn: { background: "var(--bg)", border: "none", borderRadius: "999px", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)", borderRadius: "999px" },
  tagBtnActive: { background: "var(--accent)", color: "var(--accent-text)" },
  errorTxt: { fontSize: 12, color: "var(--danger)", fontWeight: 500 },
  sheetActions: { display: "flex", gap: 10 },
  discardBtn: { flex: 1, background: "var(--bg)", border: "none", borderRadius: "999px", padding: "14px", fontSize: 15, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)" },
  dumpBtn: { flex: 2, background: "var(--text)", border: "none", borderRadius: "999px", padding: "14px 20px", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "var(--font)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  dumpDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block" },
  btnArea: { position: "fixed", bottom: "calc(var(--nav-h) + 16px)", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  micBtn: { width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", backdropFilter: "blur(8px)", transition: "all 0.15s" },
  micBtnActive: { background: "rgba(232,85,85,0.2)", border: "2px solid #E85555", color: "#E85555" },
  stopIcon: { width: 20, height: 20, background: "#E85555", borderRadius: 4, display: "block" },
  micHint: { fontSize: 12, color: "rgba(255,255,255,0.3)" },
};
