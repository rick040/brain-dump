import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const TYPE_COLORS = {
  video: "#b085ff",
  link: "#c8ff00",
  tweet: "#4db8ff",
  instagram: "#ff6eb0",
  tekst: "#ffcc44",
  afbeelding: "#44ffcc",
};

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("brain_dump").select("*").order("created_at", { ascending: false });
    if (activeTag) query = query.contains("tags", [activeTag]);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,content.ilike.%${search}%,url.ilike.%${search}%`);
    const { data, error } = await query;
    if (!error && data) {
      setItems(data);
      const tags = [...new Set(data.flatMap((item) => item.tags || []))].sort();
      setAllTags(tags);
    }
    setLoading(false);
  }, [search, activeTag]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleDelete(id) {
    const { error } = await supabase.from("brain_dump").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteId(null);
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
  }

  const previewImg = (item) => item.image_url || item.og_image || null;

  return (
    <>
      <Head>
        <title>Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div style={s.root}>
        <div style={s.topbar}>
          <div style={s.logoRow}>
            <span style={s.logo}>BRAIN DUMP</span>
            <span style={s.count}>{items.length} items</span>
          </div>
          <Link href="/save" style={s.addBtn}>+ NIEUW</Link>
        </div>

        <div style={s.searchWrap}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek naam, inhoud, url..."
            style={s.searchInput}
          />
          {search && <button onClick={() => setSearch("")} style={s.clearBtn}>x</button>}
        </div>

        {allTags.length > 0 && (
          <div style={s.tagRow}>
            <button onClick={() => setActiveTag(null)} style={{ ...s.tagFilter, ...(activeTag === null ? s.tagFilterActive : {}) }}>
              alles
            </button>
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} style={{ ...s.tagFilter, ...(activeTag === tag ? s.tagFilterActive : {}) }}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={s.emptyState}><span style={s.muted}>laden...</span></div>
        ) : items.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>&#9633;</div>
            <div style={s.muted}>Nog niets opgeslagen.</div>
            <Link href="/save" style={s.accentLink}>Eerste item toevoegen</Link>
          </div>
        ) : (
          <div style={s.list}>
            {items.map((item) => {
              const img = previewImg(item);
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} style={s.card}>
                  {/* Image preview */}
                  {img && (
                    <div style={s.cardImgWrap} onClick={() => setExpandedId(expanded ? null : item.id)}>
                      <img
                        src={img}
                        alt=""
                        style={{ ...s.cardImg, ...(expanded ? s.cardImgExpanded : {}) }}
                        onError={(e) => { e.target.parentElement.style.display = "none"; }}
                      />
                      {!expanded && <div style={s.cardImgOverlay}>TAP OM GROTER TE ZIEN</div>}
                    </div>
                  )}

                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <div style={s.cardMeta}>
                        <span style={{ ...s.typeLabel, color: TYPE_COLORS[item.type] || "#888" }}>{item.type}</span>
                        <span style={s.dateLabel}>{formatDate(item.created_at)}</span>
                      </div>
                      <button onClick={() => setDeleteId(deleteId === item.id ? null : item.id)} style={s.deleteToggle}>&times;</button>
                    </div>

                    <div style={s.cardName}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{item.name}</a>
                      ) : item.name}
                    </div>

                    {item.og_description && (
                      <div style={s.cardDesc}>{item.og_description.slice(0, 120)}{item.og_description.length > 120 ? "..." : ""}</div>
                    )}

                    {item.content && item.content !== item.url && !item.og_description && (
                      <div style={s.cardDesc}>{item.content.slice(0, 120)}{item.content.length > 120 ? "..." : ""}</div>
                    )}

                    {item.url && (
                      <div style={s.cardUrl}>{item.url.replace(/^https?:\/\//, "").slice(0, 50)}{item.url.length > 50 ? "..." : ""}</div>
                    )}

                    {item.tags?.length > 0 && (
                      <div style={s.cardTags}>
                        {item.tags.map((tag) => (
                          <span key={tag} onClick={() => setActiveTag(tag)} style={{ ...s.cardTag, ...(activeTag === tag ? s.cardTagActive : {}) }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {deleteId === item.id && (
                      <div style={s.deleteConfirm}>
                        <span style={s.deleteText}>Verwijderen?</span>
                        <button onClick={() => handleDelete(item.id)} style={s.deleteYes}>JA</button>
                        <button onClick={() => setDeleteId(null)} style={s.deleteNo}>NEE</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 60px", maxWidth: 600, margin: "0 auto" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" },
  logoRow: { display: "flex", alignItems: "baseline", gap: 12 },
  logo: { fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", color: "var(--accent)" },
  count: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" },
  addBtn: { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", color: "#000", background: "var(--accent)", padding: "7px 14px", borderRadius: 4, fontWeight: 600, display: "inline-block" },
  searchWrap: { position: "relative", marginBottom: 14 },
  searchInput: { width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "11px 40px 11px 14px", fontSize: 14, fontFamily: "var(--font-ui)", color: "var(--text)" },
  clearBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 4 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  tagFilter: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", padding: "5px 10px", borderRadius: 3, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer" },
  tagFilterActive: { background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  cardImgWrap: { position: "relative", cursor: "pointer", overflow: "hidden", maxHeight: 200 },
  cardImg: { width: "100%", height: 180, objectFit: "cover", display: "block", transition: "height 0.2s" },
  cardImgExpanded: { height: "auto", maxHeight: 500, objectFit: "contain", background: "#000" },
  cardImgOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 12px 8px", background: "linear-gradient(transparent, rgba(0,0,0,0.5))", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textAlign: "center" },
  cardBody: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardMeta: { display: "flex", alignItems: "center", gap: 10 },
  typeLabel: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" },
  dateLabel: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" },
  deleteToggle: { color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "0 4px", opacity: 0.5, background: "none", border: "none", cursor: "pointer" },
  cardName: { fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: "var(--text)" },
  cardDesc: { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 },
  cardUrl: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardTags: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 },
  cardTag: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 3, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer" },
  cardTagActive: { background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)" },
  deleteConfirm: { display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4 },
  deleteText: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--danger)", flex: 1, letterSpacing: "0.08em" },
  deleteYes: { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "#000", background: "var(--danger)", border: "none", borderRadius: 3, padding: "5px 12px", cursor: "pointer" },
  deleteNo: { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 3, padding: "5px 12px", cursor: "pointer" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 80 },
  emptyIcon: { fontSize: 40, color: "var(--border-hi)" },
  muted: { fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" },
  accentLink: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginTop: 4 },
};
