import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const DEFAULT_TAGS = [
  "lezen", "idee", "link", "video", "inspiratie",
  "werk", "klant", "tool", "later", "urgent",
];

function detectType(url, text) {
  if (!url && !text) return "tekst";
  if (url) {
    if (/youtube|youtu\.be|vimeo/.test(url)) return "video";
    if (/twitter\.com|x\.com/.test(url)) return "tweet";
    if (/instagram\.com/.test(url)) return "instagram";
    return "link";
  }
  return "tekst";
}

export default function SavePage() {
  const router = useRouter();
  const nameRef = useRef(null);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("tekst");

  useEffect(() => {
    if (!router.isReady) return;
    const { title, text, url: sharedUrl } = router.query;

    const resolvedUrl = sharedUrl || "";
    const resolvedText = text || "";
    const resolvedTitle = title || "";

    setUrl(resolvedUrl);
    setContent(resolvedText || resolvedUrl);
    setName(resolvedTitle || resolvedText?.slice(0, 60) || resolvedUrl?.replace(/^https?:\/\//, "").slice(0, 60) || "");
    setType(detectType(resolvedUrl, resolvedText));

    setTimeout(() => nameRef.current?.select(), 100);
  }, [router.isReady, router.query]);

  function toggleTag(tag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag(e) {
    e.preventDefault();
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
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
      content: content.trim(),
      url: url.trim() || null,
      type,
      tags,
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

  return (
    <>
      <Head>
        <title>Opslaan - Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div style={styles.root} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>BRAIN DUMP</span>
          <span style={{ ...styles.typeBadge, ...getTypeBadgeColor(type) }}>{type}</span>
        </div>

        {/* Name */}
        <div style={styles.field}>
          <label style={styles.label}>NAAM</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Geef het een naam..."
            style={styles.nameInput}
            maxLength={120}
            autoComplete="off"
          />
        </div>

        {/* URL preview */}
        {url && (
          <div style={styles.urlPreview}>
            <span style={styles.urlIcon}>&#9783;</span>
            <span style={styles.urlText}>{url.replace(/^https?:\/\//, "").slice(0, 60)}{url.length > 60 ? "..." : ""}</span>
          </div>
        )}

        {/* Content */}
        <div style={styles.field}>
          <label style={styles.label}>INHOUD</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tekst, notitie, context..."
            style={styles.textarea}
            rows={3}
          />
        </div>

        {/* Tags */}
        <div style={styles.field}>
          <label style={styles.label}>TAGS</label>
          <div style={styles.tagGrid}>
            {DEFAULT_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  ...styles.tagChip,
                  ...(tags.includes(tag) ? styles.tagChipActive : {}),
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Custom tag */}
          <form onSubmit={addCustomTag} style={styles.customTagRow}>
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="+ eigen tag"
              style={styles.customTagInput}
              maxLength={30}
            />
            <button type="submit" style={styles.customTagBtn}>+</button>
          </form>

          {/* Active custom tags (non-default) */}
          {tags.filter((t) => !DEFAULT_TAGS.includes(t)).length > 0 && (
            <div style={{ ...styles.tagGrid, marginTop: 8 }}>
              {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{ ...styles.tagChip, ...styles.tagChipActive }}
                >
                  {tag} x
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div style={styles.errorMsg}>{error}</div>}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            ...styles.saveBtn,
            ...(saving || saved ? styles.saveBtnDone : {}),
          }}
        >
          {saved ? "OPGESLAGEN !" : saving ? "OPSLAAN..." : "OPSLAAN"}
        </button>

        <div style={styles.hint}>CMD+Enter om snel op te slaan</div>
      </div>
    </>
  );
}

function getTypeBadgeColor(type) {
  const map = {
    video: { background: "#1a0a2e", color: "#b085ff" },
    link: { background: "#0a1a0a", color: "#c8ff00" },
    tweet: { background: "#0a1420", color: "#4db8ff" },
    instagram: { background: "#1f0a15", color: "#ff6eb0" },
    tekst: { background: "#1a1a0a", color: "#ffcc44" },
  };
  return map[type] || map.tekst;
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: "20px 16px 40px",
    maxWidth: 480,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottom: "1px solid var(--border)",
  },
  logo: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "0.2em",
    color: "var(--accent)",
    fontWeight: 400,
  },
  typeBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    padding: "3px 8px",
    borderRadius: 3,
    textTransform: "uppercase",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.15em",
    color: "var(--muted)",
  },
  nameInput: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "14px 14px",
    fontSize: 18,
    fontFamily: "var(--font-ui)",
    fontWeight: 700,
    color: "var(--text)",
    width: "100%",
    transition: "border-color 0.15s",
  },
  textarea: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
    fontSize: 14,
    fontFamily: "var(--font-mono)",
    color: "var(--muted)",
    width: "100%",
    resize: "vertical",
    lineHeight: 1.6,
    transition: "border-color 0.15s",
  },
  urlPreview: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--accent-dim2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "8px 12px",
  },
  urlIcon: {
    fontSize: 14,
    color: "var(--accent)",
    flexShrink: 0,
  },
  urlText: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },
  tagChip: {
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "7px 13px",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    color: "var(--muted)",
    transition: "all 0.1s",
    letterSpacing: "0.05em",
  },
  tagChipActive: {
    background: "var(--accent-dim)",
    border: "1px solid var(--accent)",
    color: "var(--accent)",
  },
  customTagRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  customTagInput: {
    flex: 1,
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "8px 12px",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    color: "var(--text)",
    letterSpacing: "0.05em",
  },
  customTagBtn: {
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    width: 38,
    fontSize: 18,
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  errorMsg: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--danger)",
    padding: "8px 12px",
    background: "rgba(255,68,68,0.08)",
    borderRadius: "var(--radius)",
    border: "1px solid rgba(255,68,68,0.2)",
  },
  saveBtn: {
    background: "var(--accent)",
    color: "#000",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: "0.15em",
    padding: "16px",
    borderRadius: "var(--radius)",
    width: "100%",
    transition: "opacity 0.15s, transform 0.1s",
    marginTop: 4,
  },
  saveBtnDone: {
    opacity: 0.5,
  },
  hint: {
    textAlign: "center",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--border-hi)",
    letterSpacing: "0.1em",
  },
};
