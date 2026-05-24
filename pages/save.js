import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = [
  "lezen", "idee", "link", "video", "inspiratie",
  "werk", "klant", "tool", "later", "urgent",
];

function detectType(url, mediaType) {
  if (mediaType) return mediaType;
  if (!url) return "tekst";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}

const TYPE_COLORS = {
  video: { bg: "#1a0a2e", color: "#b085ff" },
  instagram: { bg: "#1f0a15", color: "#ff6eb0" },
  tweet: { bg: "#0a1420", color: "#4db8ff" },
  link: { bg: "#0a1a0a", color: "#c8ff00" },
  tekst: { bg: "#1a1a0a", color: "#ffcc44" },
  afbeelding: { bg: "#0a1a18", color: "#44ffcc" },
};

export default function SavePage() {
  const router = useRouter();
  const nameRef = useRef(null);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [entryType, setEntryType] = useState("tekst"); // tekst | url | afbeelding
  const [type, setType] = useState("tekst");
  const [imageUrl, setImageUrl] = useState("");
  const [ogData, setOgData] = useState(null);
  const [ogLoading, setOgLoading] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const { title, text, url: sharedUrl, imageUrl: sharedImage, mediaType } = router.query;

    const resolvedUrl = sharedUrl || "";
    const resolvedText = text || "";
    const resolvedTitle = title || "";
    const resolvedImage = sharedImage || "";

    setImageUrl(resolvedImage);

    const detectedType = detectType(resolvedUrl, mediaType);
    setType(detectedType);

    if (resolvedImage) {
      // IMAGE entry
      setEntryType("afbeelding");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "Afbeelding");
    } else if (resolvedUrl) {
      // URL entry
      setEntryType("url");
      setUrl(resolvedUrl);
      setName(resolvedTitle || "");
      setNote(resolvedText || "");

      // Fetch OG data
      setOgLoading(true);
      fetch(`/api/og?url=${encodeURIComponent(resolvedUrl)}`)
        .then((r) => r.json())
        .then((data) => {
          setOgData(data);
          // Only auto-fill name if still empty
          if (!resolvedTitle && data.title) setName(data.title.slice(0, 80));
          if (!resolvedText && data.description) setNote(data.description.slice(0, 200));
          if (data.type && data.type !== "link") setType(data.type);
        })
        .catch(() => {})
        .finally(() => setOgLoading(false));
    } else {
      // TEXT entry
      setEntryType("tekst");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "");
      setNote(resolvedText || "");
    }

    setTimeout(() => nameRef.current?.select(), 150);
  }, [router.isReady]);

  function toggleTag(tag) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  function addCustomTag(e) {
    e.preventDefault();
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  async function handleSave() {
    if (!name.trim()) {
      nameRef.current?.focus();
      setError("Naam is verplicht");
      return;
    }
    setSaving(true);
    setError("");

    const { error: dbError } = await supabase.from("brain_dump").insert({
      name: name.trim(),
      content: note.trim() || null,
      url: url.trim() || null,
      type,
      tags,
      image_url: imageUrl || null,
      og_image: ogData?.image || null,
      og_description: ogData?.description || note.trim() || null,
    });

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setTimeout(() => {
      if (window.history.length > 1) window.close();
      else router.push("/");
    }, 800);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  }

  const tc = TYPE_COLORS[type] || TYPE_COLORS.link;

  return (
    <>
      <Head>
        <title>Opslaan - Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div style={s.root} onKeyDown={handleKeyDown}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.logo}>BRAIN DUMP</span>
          <span style={{ ...s.typeBadge, background: tc.bg, color: tc.color }}>{type}</span>
        </div>

        {/* ---- AFBEELDING ENTRY ---- */}
        {entryType === "afbeelding" && (
          <>
            <div style={s.imgPreviewWrap}>
              <img src={imageUrl} alt="" style={s.imgPreview} />
            </div>
            <div style={s.field}>
              <label style={s.label}>NAAM</label>
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam..." style={s.nameInput} maxLength={120} autoComplete="off" />
            </div>
          </>
        )}

        {/* ---- URL ENTRY (website / social) ---- */}
        {entryType === "url" && (
          <>
            {/* OG Preview card */}
            <div style={{ ...s.ogCard, borderColor: tc.color + "44" }}>
              {ogLoading && (
                <div style={s.ogCardLoading}>
                  <span style={{ ...s.ogDot, background: tc.color }} />
                  <span style={s.ogLoadText}>preview laden...</span>
                </div>
              )}

              {!ogLoading && ogData?.image && (
                <img src={ogData.image} alt="" style={s.ogCardImg} onError={(e) => { e.target.style.display = "none"; }} />
              )}

              <div style={s.ogCardBody}>
                <div style={{ ...s.ogSiteName, color: tc.color }}>
                  {ogData?.siteName || url.replace(/^https?:\/\//, "").split("/")[0]}
                </div>
                <div style={s.ogCardUrl}>{url}</div>
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>NAAM</label>
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Geef het een naam..." style={s.nameInput} maxLength={120} autoComplete="off" />
            </div>

            <div style={s.field}>
              <label style={s.label}>NOTITIE</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Waarom sla je dit op?" style={s.textarea} rows={2} />
            </div>
          </>
        )}

        {/* ---- TEKST ENTRY ---- */}
        {entryType === "tekst" && (
          <>
            <div style={s.field}>
              <label style={s.label}>NAAM</label>
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Geef het een naam..." style={s.nameInput} maxLength={120} autoComplete="off" />
            </div>
            <div style={s.field}>
              <label style={s.label}>TEKST</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Inhoud..." style={s.textarea} rows={4} />
            </div>
          </>
        )}

        {/* Tags - altijd zichtbaar */}
        <div style={s.field}>
          <label style={s.label}>TAGS</label>
          <div style={s.tagGrid}>
            {DEFAULT_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagChip, ...(tags.includes(tag) ? s.tagChipActive : {}) }}>
                {tag}
              </button>
            ))}
          </div>
          <form onSubmit={addCustomTag} style={s.customTagRow}>
            <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="+ eigen tag" style={s.customTagInput} maxLength={30} />
            <button type="submit" style={s.customTagBtn}>+</button>
          </form>
          {tags.filter((t) => !DEFAULT_TAGS.includes(t)).length > 0 && (
            <div style={{ ...s.tagGrid, marginTop: 8 }}>
              {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagChip, ...s.tagChipActive }}>{tag} x</button>
              ))}
            </div>
          )}
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}

        <button onClick={handleSave} disabled={saving || saved} style={{ ...s.saveBtn, ...(saving || saved ? s.saveBtnDone : {}) }}>
          {saved ? "OPGESLAGEN !" : saving ? "OPSLAAN..." : "OPSLAAN"}
        </button>

        <div style={s.hint}>CMD+Enter om snel op te slaan</div>
      </div>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--border)" },
  logo: { fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.2em", color: "var(--accent)" },
  typeBadge: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 3, textTransform: "uppercase" },

  // Image entry
  imgPreviewWrap: { borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", maxHeight: 260, background: "var(--bg3)" },
  imgPreview: { width: "100%", height: 240, objectFit: "cover", display: "block" },

  // URL/OG card
  ogCard: { borderRadius: 8, border: "1px solid", overflow: "hidden", background: "var(--bg2)" },
  ogCardLoading: { display: "flex", alignItems: "center", gap: 8, padding: "14px 14px" },
  ogDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  ogLoadText: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" },
  ogCardImg: { width: "100%", height: 180, objectFit: "cover", display: "block" },
  ogCardBody: { padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 4 },
  ogSiteName: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 },
  ogCardUrl: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // Fields
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--muted)" },
  nameInput: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "13px 14px", fontSize: 18, fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--text)", width: "100%" },
  textarea: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "11px 14px", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--muted)", width: "100%", resize: "vertical", lineHeight: 1.6 },

  // Tags
  tagGrid: { display: "flex", flexWrap: "wrap", gap: 7 },
  tagChip: { background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 4, padding: "7px 13px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.05em", cursor: "pointer" },
  tagChipActive: { background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)" },
  customTagRow: { display: "flex", gap: 8, marginTop: 8 },
  customTagInput: { flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)" },
  customTagBtn: { background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, width: 38, fontSize: 18, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" },

  errorMsg: { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--danger)", padding: "8px 12px", background: "rgba(255,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(255,68,68,0.2)" },
  saveBtn: { background: "var(--accent)", color: "#000", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14, letterSpacing: "0.15em", padding: "16px", borderRadius: 6, width: "100%", marginTop: 4, cursor: "pointer", border: "none" },
  saveBtnDone: { opacity: 0.5 },
  hint: { textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--border-hi)", letterSpacing: "0.1em" },
};
