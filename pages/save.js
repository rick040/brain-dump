import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = ["lezen", "idee", "link", "video", "inspiratie", "werk", "klant", "tool", "later", "urgent"];

const ENTRY_TYPES = [
  { key: "url", label: "URL / Link" },
  { key: "tekst", label: "Tekst" },
  { key: "afbeelding", label: "Afbeelding" },
];

function detectType(url) {
  if (!url) return "link";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  return "link";
}

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x[0-9a-fA-F]+;/g, "").replace(/&#\d+;/g, "").replace(/&[a-z]+;/g, "").trim();
}

export default function SavePage() {
  const router = useRouter();
  const nameRef = useRef(null);
  const urlInputRef = useRef(null);
  const fileRef = useRef(null);

  const [entryType, setEntryType] = useState(null); // null = auto-detect or choosing
  const [type, setType] = useState("link");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ogData, setOgData] = useState(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [isShared, setIsShared] = useState(false); // came from share target

  useEffect(() => {
    if (!router.isReady) return;
    const { title, text, url: sharedUrl, imageUrl: sharedImage, mediaType } = router.query;

    const hasSharedData = !!(title || text || sharedUrl || sharedImage || mediaType);
    setIsShared(hasSharedData);

    if (!hasSharedData) return; // manual entry - show type selector

    const rawText = text || "";
    const urlInText = rawText.match(/https?:\/\/[^\s"'<>]+/)?.[0]?.replace(/[.,;:!?]+$/, "") || "";
    const resolvedUrl = sharedUrl || urlInText || "";
    const resolvedText = urlInText ? rawText.replace(urlInText, "").trim() : rawText;
    const resolvedTitle = title || "";
    const resolvedImage = sharedImage || "";

    setImageUrl(resolvedImage);

    if (resolvedImage) {
      setEntryType("afbeelding");
      setType(mediaType || "afbeelding");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "Afbeelding");
    } else if (resolvedUrl) {
      setEntryType("url");
      setType(detectType(resolvedUrl));
      setUrl(resolvedUrl);
      setName(resolvedTitle || "");
      setNote(resolvedText || "");
      fetchOg(resolvedUrl, resolvedTitle, resolvedText);
    } else {
      setEntryType("tekst");
      setType("tekst");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "");
      setNote(resolvedText || "");
    }

    setTimeout(() => nameRef.current?.select(), 150);
  }, [router.isReady]);

  function fetchOg(resolvedUrl, resolvedTitle, resolvedText) {
    setOgLoading(true);
    fetch(`/api/og?url=${encodeURIComponent(resolvedUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        setOgData(data);
        if (!resolvedTitle && data.title) setName(decodeEntities(data.title).slice(0, 80));
        if (!resolvedText && data.description) setNote(decodeEntities(data.description).slice(0, 200));
        if (data.type && data.type !== "link") setType(data.type);
      })
      .catch(() => {})
      .finally(() => setOgLoading(false));
  }

  function handleUrlBlur() {
    if (url && url.startsWith("http") && !ogData) {
      fetchOg(url, name, note);
      setType(detectType(url));
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // For manual image upload, create a local preview
    const reader = new FileReader();
    reader.onload = (ev) => setImageUrl(ev.target.result);
    reader.readAsDataURL(file);
    setName(name || file.name.replace(/\.[^.]+$/, ""));
  }

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
    if (!name.trim()) { nameRef.current?.focus(); setError("Naam is verplicht"); return; }
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    // Handle local file upload for manual image entries
    let finalImageUrl = imageUrl;
    if (entryType === "afbeelding" && imageUrl?.startsWith("data:") && fileRef.current?.files?.[0]) {
      const file = fileRef.current.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from("media").upload(fileName, file, { contentType: file.type, upsert: false });
      if (!upErr && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        finalImageUrl = urlData?.publicUrl || imageUrl;
      }
    }

    const { error: dbError } = await supabase.from("brain_dump").insert({
      user_id: user?.id,
      name: name.trim(),
      content: note.trim() || null,
      url: url.trim() || null,
      type,
      tags,
      image_url: (entryType === "afbeelding" ? finalImageUrl : null) || null,
      og_image: ogData?.image || null,
      og_description: ogData?.description ? decodeEntities(ogData.description) : note.trim() || null,
    });

    if (dbError) { setError(dbError.message); setSaving(false); return; }

    setSaved(true);
    setTimeout(() => {
      if (window.history.length > 1) window.close();
      else router.push("/");
    }, 700);
  }

  const typeColors = {
    video: "#B085FF", instagram: "#FF6EB0", tweet: "#4DB8FF",
    link: "#CCFF00", tekst: "#FFD166", afbeelding: "#44FFCC", url: "#CCFF00",
  };
  const tc = typeColors[type] || "#CCFF00";

  // Manual entry: show type selector first
  if (!isShared && entryType === null) {
    return (
      <>
        <Head><title>Nieuw - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div style={s.root}>
          <div style={s.header}>
            <button onClick={() => router.push("/")} style={s.backBtn}>← Terug</button>
            <span style={s.headerTitle}>Nieuw item</span>
            <span />
          </div>
          <div style={s.typeSelector}>
            <div style={s.typeSelectorLabel}>Wat wil je opslaan?</div>
            {ENTRY_TYPES.map((et) => (
              <button key={et.key} onClick={() => { setEntryType(et.key); setType(et.key === "url" ? "link" : et.key); setTimeout(() => et.key === "url" ? urlInputRef.current?.focus() : nameRef.current?.focus(), 100); }} style={s.typeOption}>
                <span style={s.typeOptionIcon}>{et.key === "url" ? "🔗" : et.key === "tekst" ? "📝" : "🖼️"}</span>
                <span style={s.typeOptionLabel}>{et.label}</span>
                <span style={s.typeOptionArrow}>→</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Opslaan - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></Head>
      <div style={s.root}>
        <div style={s.header}>
          {!isShared && <button onClick={() => setEntryType(null)} style={s.backBtn}>← Terug</button>}
          {isShared && <div />}
          <span style={{ ...s.typeTag, color: tc }}>{type}</span>
          <div />
        </div>

        {/* Afbeelding preview */}
        {entryType === "afbeelding" && (
          <div style={s.imgBlock}>
            {imageUrl ? (
              <img src={imageUrl} alt="" style={s.imgPreview} />
            ) : (
              <button onClick={() => fileRef.current?.click()} style={s.uploadBtn}>
                <span style={s.uploadIcon}>+</span>
                <span>Kies afbeelding</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>
        )}

        {/* URL entry */}
        {entryType === "url" && (
          <>
            {/* OG card preview */}
            {(ogLoading || ogData) && (
              <div style={s.ogCard}>
                {ogLoading && <div style={s.ogLoading}><span style={{ ...s.ogDot, background: tc }} /><span style={s.ogLoadTxt}>preview laden...</span></div>}
                {!ogLoading && ogData?.image && (
                  <img src={ogData.image} alt="" style={s.ogImg} onError={(e) => { e.target.style.display = "none"; }} />
                )}
                {!ogLoading && (
                  <div style={s.ogInfo}>
                    <span style={{ ...s.ogSite, color: tc }}>{ogData?.siteName || ""}</span>
                    <span style={s.ogUrl}>{url.replace(/^https?:\/\//, "").slice(0, 50)}</span>
                  </div>
                )}
              </div>
            )}

            {/* URL input (only for manual entry) */}
            {!isShared && (
              <div style={s.field}>
                <label style={s.label}>URL</label>
                <input ref={urlInputRef} value={url} onChange={(e) => { setUrl(e.target.value); setOgData(null); }} onBlur={handleUrlBlur} placeholder="https://..." style={s.input} type="url" autoComplete="off" />
              </div>
            )}
          </>
        )}

        {/* Name field */}
        <div style={s.field}>
          <label style={s.label}>Naam</label>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Geef het een naam..." style={s.nameInput} maxLength={120} autoComplete="off" />
        </div>

        {/* Note field */}
        <div style={s.field}>
          <label style={s.label}>{entryType === "tekst" ? "Tekst" : "Notitie"}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={entryType === "tekst" ? "Schrijf hier je tekst..." : "Waarom sla je dit op?"} style={s.textarea} rows={entryType === "tekst" ? 5 : 2} />
        </div>

        {/* Tags */}
        <div style={s.field}>
          <label style={s.label}>Tags</label>
          <div style={s.tagGrid}>
            {DEFAULT_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagBtn, ...(tags.includes(tag) ? s.tagBtnActive : {}) }}>{tag}</button>
            ))}
          </div>
          <div style={s.customTagRow}>
            <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag(e))} placeholder="+ eigen tag" style={s.customTagInput} maxLength={30} />
          </div>
          {tags.filter((t) => !DEFAULT_TAGS.includes(t)).length > 0 && (
            <div style={{ ...s.tagGrid, marginTop: 6 }}>
              {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagBtn, ...s.tagBtnActive }}>{tag} ✕</button>
              ))}
            </div>
          )}
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}

        <button onClick={handleSave} disabled={saving || saved} style={{ ...s.saveBtn, ...(saving || saved ? s.saveBtnDone : {}) }}>
          {saved ? "Opgeslagen ✓" : saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerTitle: { fontWeight: 700, fontSize: 17, color: "#fff" },
  backBtn: { fontSize: 13, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", padding: "4px 0" },
  typeTag: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(0,0,0,0.2)", padding: "3px 10px", borderRadius: 20 },

  // Type selector
  typeSelector: { display: "flex", flexDirection: "column", gap: 10 },
  typeSelectorLabel: { fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" },
  typeOption: { background: "var(--bg2)", border: "none", borderRadius: "var(--radius)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "var(--shadow-sm)", fontFamily: "var(--font)", textAlign: "left" },
  typeOptionIcon: { fontSize: 24, width: 32, textAlign: "center" },
  typeOptionLabel: { flex: 1, fontSize: 16, fontWeight: 600, color: "var(--text)" },
  typeOptionArrow: { fontSize: 16, color: "var(--muted)" },

  // Image
  imgBlock: { borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg2)", boxShadow: "var(--shadow-sm)" },
  imgPreview: { width: "100%", maxHeight: 260, objectFit: "cover", display: "block" },
  uploadBtn: { width: "100%", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", color: "var(--muted)" },
  uploadIcon: { fontSize: 32, lineHeight: 1 },

  // OG card
  ogCard: { background: "var(--bg2)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow-sm)" },
  ogLoading: { display: "flex", alignItems: "center", gap: 8, padding: "14px" },
  ogDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  ogLoadTxt: { fontSize: 12, color: "var(--muted)" },
  ogImg: { width: "100%", height: 160, objectFit: "cover", display: "block" },
  ogInfo: { padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 2 },
  ogSite: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  ogUrl: { fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // Fields
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--text)", width: "100%", boxShadow: "var(--shadow-sm)" },
  nameInput: { background: "var(--bg2)", border: "none", borderRadius: 12, padding: "13px 14px", fontSize: 18, fontWeight: 700, color: "var(--text)", width: "100%", boxShadow: "var(--shadow-sm)", letterSpacing: "-0.02em" },
  textarea: { background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "var(--text)", width: "100%", resize: "vertical", lineHeight: 1.6, boxShadow: "var(--shadow-sm)" },

  // Tags
  tagGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagBtn: { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "var(--font)" },
  tagBtnActive: { background: "var(--accent)", color: "var(--accent-text)" },
  customTagRow: { marginTop: 6 },
  customTagInput: { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fff", width: "100%", fontFamily: "var(--font)" },

  errorMsg: { fontSize: 12, color: "var(--danger)", padding: "8px 12px", background: "rgba(232,85,85,0.12)", borderRadius: 8, fontWeight: 500 },
  saveBtn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", padding: "15px", borderRadius: 12, width: "100%", border: "none", cursor: "pointer", marginTop: 4, fontFamily: "var(--font)" },
  saveBtnDone: { opacity: 0.5 },
};
