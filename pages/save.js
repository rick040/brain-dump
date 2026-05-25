import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = ["lezen","idee","link","video","inspiratie","werk","klant","tool","later","urgent"];

function detectType(url) {
  if (!url) return "link";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "tweet";
  if (/pinterest\.com|pin\.it/.test(url)) return "pinterest";
  return "link";
}
function decode(str) {
  if (!str) return "";
  return str.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x[0-9a-fA-F]+;/g,"").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"").trim();
}

// Rich text toolbar actions
const TOOLBAR = [
  { cmd: "bold",            icon: "B",     style: { fontWeight: 800 } },
  { cmd: "italic",          icon: "I",     style: { fontStyle: "italic" } },
  { cmd: "underline",       icon: "U",     style: { textDecoration: "underline" } },
  { cmd: "insertUnorderedList", icon: "•—",style: {} },
  { cmd: "insertOrderedList",   icon: "1.", style: {} },
  { cmd: "formatBlock:h3",  icon: "H",     style: { fontWeight: 700 } },
];

function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({});

  function execCmd(cmd) {
    if (cmd.startsWith("formatBlock:")) {
      document.execCommand("formatBlock", false, cmd.split(":")[1]);
    } else {
      document.execCommand(cmd, false, null);
    }
    editorRef.current?.focus();
    checkFormats();
    onChange(editorRef.current?.innerHTML || "");
  }

  function checkFormats() {
    const formats = {};
    TOOLBAR.forEach((t) => {
      if (!t.cmd.startsWith("formatBlock")) {
        formats[t.cmd] = document.queryCommandState(t.cmd);
      }
    });
    setActiveFormats(formats);
  }

  function handleInput() {
    onChange(editorRef.current?.innerHTML || "");
    checkFormats();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
  }

  // Set initial content once
  useEffect(() => {
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  return (
    <div style={s.editorWrap}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        {TOOLBAR.map((t) => (
          <button key={t.cmd} onMouseDown={(e) => { e.preventDefault(); execCmd(t.cmd); }} style={{ ...s.toolbarBtn, ...(activeFormats[t.cmd] ? s.toolbarBtnActive : {}), ...t.style }}>
            {t.icon}
          </button>
        ))}
      </div>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={checkFormats}
        onMouseUp={checkFormats}
        onKeyDown={handleKeyDown}
        style={s.editor}
        data-placeholder={placeholder}
      />
    </div>
  );
}

export default function SavePage() {
  const router = useRouter();
  const nameRef = useRef(null);
  const urlInputRef = useRef(null);
  const fileRef = useRef(null);

  const [entryType, setEntryType] = useState(null);
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
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const { title, text, url: sharedUrl, imageUrl: sharedImage, mediaType } = router.query;
    const hasSharedData = !!(title || text || sharedUrl || sharedImage || mediaType);
    setIsShared(hasSharedData);
    if (!hasSharedData) return;

    const rawText = text || "";
    const urlInText = rawText.match(/https?:\/\/[^\s"'<>]+/)?.[0]?.replace(/[.,;:!?]+$/, "") || "";
    const resolvedUrl = sharedUrl || urlInText || "";
    const resolvedText = urlInText ? rawText.replace(urlInText, "").trim() : rawText;
    const resolvedTitle = title || "";
    const resolvedImage = sharedImage || "";

    setImageUrl(resolvedImage);
    if (resolvedImage) {
      setEntryType("afbeelding"); setType(mediaType || "afbeelding");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "Afbeelding");
    } else if (resolvedUrl) {
      setEntryType("url"); setType(detectType(resolvedUrl));
      setUrl(resolvedUrl); setName(resolvedTitle || ""); setNote(resolvedText || "");
      fetchOg(resolvedUrl, resolvedTitle, resolvedText);
    } else {
      setEntryType("tekst"); setType("tekst");
      setName(resolvedTitle || resolvedText?.slice(0, 60) || "");
      setNote(resolvedText || "");
    }
    setTimeout(() => nameRef.current?.select(), 150);
  }, [router.isReady]);

  function fetchOg(u, t, d) {
    setOgLoading(true);
    fetch(`/api/og?url=${encodeURIComponent(u)}`)
      .then((r) => r.json())
      .then((data) => {
        setOgData(data);
        if (!t && data.title) setName(decode(data.title).slice(0, 80));
        if (!d && data.description) setNote(decode(data.description).slice(0, 200));
        if (data.type && data.type !== "link") setType(data.type);
      })
      .catch(() => {})
      .finally(() => setOgLoading(false));
  }

  function handleUrlBlur() {
    if (url && url.startsWith("http") && !ogData) { fetchOg(url, name, note); setType(detectType(url)); }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageUrl(ev.target.result);
    reader.readAsDataURL(file);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  }

  function toggleTag(tag) { setTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]); }

  async function handleSave() {
    if (!name.trim()) { nameRef.current?.focus(); setError("Naam is verplicht"); return; }
    setSaving(true); setError("");

    const { data: { user } } = await supabase.auth.getUser();

    let finalImg = imageUrl;
    if (entryType === "afbeelding" && imageUrl?.startsWith("data:") && fileRef.current?.files?.[0]) {
      const file = fileRef.current.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from("media").upload(fileName, file, { contentType: file.type });
      if (!upErr && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        finalImg = urlData?.publicUrl || imageUrl;
      }
    }

    const { error: dbError } = await supabase.from("brain_dump").insert({
      user_id: user?.id,
      name: name.trim(),
      content: note || null,
      url: url.trim() || null,
      type,
      tags,
      image_url: entryType === "afbeelding" ? finalImg || null : null,
      og_image: ogData?.image || null,
      og_description: ogData?.description ? decode(ogData.description) : null,
    });

    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setSaved(true);
    setTimeout(() => { if (window.history.length > 1) window.close(); else router.push("/"); }, 700);
  }

  const tc = { video:"#B085FF", instagram:"#FF6EB0", tweet:"#4DB8FF", link:"#CCFF00", tekst:"#FFD166", afbeelding:"#44FFCC", url:"#CCFF00", pinterest:"#E60023" }[type] || "#CCFF00";

  // Manual entry type chooser
  if (!isShared && entryType === null) {
    return (
      <>
        <Head><title>Nieuw - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div style={s.root}>
          <div style={s.topRow}>
            <button onClick={() => router.push("/")} style={s.backBtn}>← Terug</button>
            <span style={s.pageTitle}>Nieuw item</span>
            <span />
          </div>
          <div style={s.chooserGrid}>
            {[
              { key:"url", emoji:"🔗", title:"URL / Link", desc:"Website, social media, artikel" },
              { key:"tekst", emoji:"📝", title:"Notitie", desc:"Vrije tekst, idee, gedachte" },
              { key:"afbeelding", emoji:"🖼️", title:"Afbeelding", desc:"Foto, screenshot, ontwerp" },
            ].map((opt) => (
              <button key={opt.key} onClick={() => { setEntryType(opt.key); setType(opt.key === "url" ? "link" : opt.key); setTimeout(() => opt.key === "url" ? urlInputRef.current?.focus() : nameRef.current?.focus(), 100); }} style={s.typeCard}>
                <span style={s.typeEmoji}>{opt.emoji}</span>
                <div>
                  <div style={s.typeTitle}>{opt.title}</div>
                  <div style={s.typeDesc}>{opt.desc}</div>
                </div>
                <span style={s.typeArrow}>›</span>
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
        <div style={s.topRow}>
          {!isShared ? <button onClick={() => setEntryType(null)} style={s.backBtn}>← Terug</button> : <div />}
          <span style={{ ...s.typeBadge, color: tc }}>{type}</span>
          <div />
        </div>

        {/* Image */}
        {entryType === "afbeelding" && (
          <div style={s.imgBlock}>
            {imageUrl ? <img src={imageUrl} alt="" style={s.imgPreview} /> : (
              <button onClick={() => fileRef.current?.click()} style={s.uploadArea}>
                <span style={s.uploadIcon}>+</span>
                <span style={s.uploadTxt}>Kies afbeelding</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileChange} />
          </div>
        )}

        {/* URL card */}
        {entryType === "url" && (
          <div style={{ ...s.ogCard, borderLeftColor: tc }}>
            {ogLoading && <div style={s.ogLoading}><span style={{ ...s.ogPulse, background: tc }} /><span style={s.ogLoadTxt}>Preview laden...</span></div>}
            {!ogLoading && ogData?.image && <img src={ogData.image} alt="" style={s.ogImg} onError={(e) => { e.target.style.display="none"; }} />}
            {!ogLoading && (
              <div style={s.ogMeta}>
                <span style={{ ...s.ogSite, color: tc }}>{ogData?.siteName || ""}</span>
                <span style={s.ogUrl}>{url.replace(/^https?:\/\//, "").slice(0, 55)}</span>
              </div>
            )}
            {!isShared && <input ref={urlInputRef} value={url} onChange={(e) => { setUrl(e.target.value); setOgData(null); }} onBlur={handleUrlBlur} placeholder="https://..." style={s.urlInput} type="url" />}
          </div>
        )}

        {/* Name */}
        <div style={s.field}>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam..." style={s.nameInput} maxLength={120} />
        </div>

        {/* Note / Rich text */}
        <div style={s.field}>
          <label style={s.fieldLabel}>{entryType === "tekst" ? "Inhoud" : "Notitie"}</label>
          <RichTextEditor
            value={note}
            onChange={setNote}
            placeholder={entryType === "tekst" ? "Schrijf hier je notitie..." : "Waarom sla je dit op?"}
          />
        </div>

        {/* Tags */}
        <div style={s.field}>
          <label style={s.fieldLabel}>Tags</label>
          <div style={s.tagGrid}>
            {DEFAULT_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagChip, ...(tags.includes(tag) ? s.tagChipActive : {}) }}>{tag}</button>
            ))}
          </div>
          <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = customTag.trim().toLowerCase(); if (t && !tags.includes(t)) setTags((p) => [...p, t]); setCustomTag(""); } }} placeholder="+ Eigen tag (Enter om toe te voegen)" style={s.customTagInput} />
          {tags.filter((t) => !DEFAULT_TAGS.includes(t)).length > 0 && (
            <div style={{ ...s.tagGrid, marginTop: 6 }}>
              {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{ ...s.tagChip, ...s.tagChipActive }}>{tag} ✕</button>
              ))}
            </div>
          )}
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}

        <button onClick={handleSave} disabled={saving || saved} style={{ ...s.saveBtn, ...(saving || saved ? s.saveBtnDone : {}) }}>
          {saved ? "Opgeslagen ✓" : saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 20px; }
        [contenteditable] h3 { font-size: 17px; font-weight: 700; }
        [contenteditable] p { margin: 0; }
      `}</style>
    </>
  );
}

const s = {
  root: { minHeight:"100vh", background:"var(--bg)", padding:"20px var(--page-pad) 40px", maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column", gap:16 },
  topRow: { display:"flex", alignItems:"center", justifyContent:"space-between" },
  backBtn: { fontSize:13, color:"var(--text2)", fontFamily:"var(--font)", padding:"4px 0" },
  pageTitle: { fontWeight:700, fontSize:17, color:"var(--text)" },
  typeBadge: { fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", background:"rgba(0,0,0,0.06)", padding:"3px 10px", borderRadius:"999px" },

  chooserGrid: { display:"flex", flexDirection:"column", gap:10, paddingTop:8 },
  typeCard: { background:"var(--card)", borderRadius:"var(--r-lg)", padding:"18px 16px", display:"flex", alignItems:"center", gap:14, boxShadow:"var(--shadow-sm)", border:"none", cursor:"pointer", fontFamily:"var(--font)", textAlign:"left" },
  typeEmoji: { fontSize:28, width:40, textAlign:"center", flexShrink:0 },
  typeTitle: { fontWeight:700, fontSize:16, color:"var(--text)" },
  typeDesc: { fontSize:12, color:"var(--muted)", marginTop:2 },
  typeArrow: { fontSize:22, color:"var(--muted)", marginLeft:"auto" },

  imgBlock: { borderRadius:"var(--r-lg)", overflow:"hidden", background:"var(--card)", boxShadow:"var(--shadow-sm)" },
  imgPreview: { width:"100%", maxHeight:260, objectFit:"cover" },
  uploadArea: { width:"100%", padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font)" },
  uploadIcon: { fontSize:36, color:"var(--muted)" },
  uploadTxt: { fontSize:14, color:"var(--muted)", fontWeight:500 },

  ogCard: { background:"var(--card)", borderRadius:"var(--r-md)", overflow:"hidden", boxShadow:"var(--shadow-sm)", borderLeft:"3px solid", display:"flex", flexDirection:"column" },
  ogLoading: { display:"flex", alignItems:"center", gap:8, padding:14 },
  ogPulse: { width:6, height:6, borderRadius:"50%", display:"inline-block", flexShrink:0, animation:"pulse 1s infinite" },
  ogLoadTxt: { fontSize:12, color:"var(--muted)" },
  ogImg: { width:"100%", height:160, objectFit:"cover" },
  ogMeta: { padding:"10px 14px 4px", display:"flex", flexDirection:"column", gap:2 },
  ogSite: { fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" },
  ogUrl: { fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  urlInput: { margin:"8px 14px 12px", background:"var(--bg)", border:"none", borderRadius:10, padding:"10px 12px", fontSize:14, color:"var(--text)", fontFamily:"var(--font)" },

  field: { display:"flex", flexDirection:"column", gap:8 },
  fieldLabel: { fontSize:11, fontWeight:700, color:"var(--muted)", letterSpacing:"0.06em", textTransform:"uppercase" },
  nameInput: { background:"var(--card)", border:"none", borderRadius:"var(--r-md)", padding:"14px 16px", fontSize:20, fontWeight:800, color:"var(--text)", width:"100%", boxShadow:"var(--shadow-sm)", letterSpacing:"-0.02em", fontFamily:"var(--font)" },

  // Rich text editor
  editorWrap: { background:"var(--card)", borderRadius:"var(--r-md)", boxShadow:"var(--shadow-sm)", overflow:"hidden" },
  toolbar: { display:"flex", gap:2, padding:"8px 10px", borderBottom:"1px solid var(--border)" },
  toolbarBtn: { width:30, height:30, borderRadius:"var(--r-xs)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"var(--text2)", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font)" },
  toolbarBtnActive: { background:"var(--accent)", color:"var(--accent-text)" },
  editor: { padding:"12px 14px", fontSize:15, color:"var(--text)", minHeight:100, lineHeight:1.7, outline:"none" },

  tagGrid: { display:"flex", flexWrap:"wrap", gap:6 },
  tagChip: { background:"var(--bg)", border:"none", borderRadius:"999px", padding:"6px 14px", fontSize:12, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"var(--font)", transition:"all 0.1s" },
  tagChipActive: { background:"var(--accent)", color:"var(--accent-text)" },
  customTagInput: { background:"var(--card)", border:"1px dashed var(--border-hi)", borderRadius:"var(--r-sm)", padding:"9px 14px", fontSize:13, color:"var(--text)", width:"100%", fontFamily:"var(--font)", marginTop:6 },

  errorMsg: { fontSize:13, color:"var(--danger)", padding:"10px 14px", background:"rgba(232,85,85,0.08)", borderRadius:"var(--r-sm)", fontWeight:500 },
  saveBtn: { background:"var(--text)", color:"#fff", fontWeight:700, fontSize:15, padding:"15px", borderRadius:"var(--r-md)", width:"100%", border:"none", cursor:"pointer", fontFamily:"var(--font)", marginTop:4, letterSpacing:"-0.01em" },
  saveBtnDone: { opacity:0.5 },
};
