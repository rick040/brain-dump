import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const TYPE_COLORS = {
  video: { bg: "#1A0A2E", color: "#B085FF" }, instagram: { bg: "#2E0A1A", color: "#FF6EB0" },
  tweet: { bg: "#0A1420", color: "#4DB8FF" }, link: { bg: "#0A1A0A", color: "#CCFF00" },
  tekst: { bg: "#1A1A0A", color: "#FFD166" }, afbeelding: { bg: "#0A1A18", color: "#44FFCC" },
  notitie: { bg: "#1A100A", color: "#FF9F43" }, url: { bg: "#0A1A0A", color: "#CCFF00" },
};

function decode(str) {
  if (!str) return "";
  return str.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&apos;/g,"'")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x[0-9a-fA-F]+;/g,"").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"").trim();
}

function formatDay(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today - 86400000);
  d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime()) return "Vandaag";
  if (d.getTime() === yesterday.getTime()) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [dateFilter, setDateFilter] = useState("all");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("brain_dump").select("*").order("created_at", { ascending: false });
    if (activeTag) query = query.contains("tags", [activeTag]);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,content.ilike.%${search}%,url.ilike.%${search}%`);
    if (dateFilter === "today") query = query.gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
    else if (dateFilter === "week") query = query.gte("created_at", new Date(Date.now() - 7*86400000).toISOString());
    else if (dateFilter === "month") query = query.gte("created_at", new Date(Date.now() - 30*86400000).toISOString());
    const { data, error } = await query;
    if (!error && data) {
      setItems(data);
      setAllTags([...new Set(data.flatMap((i) => i.tags || []))].sort());
    }
    setLoading(false);
  }, [search, activeTag, dateFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleDelete(id) {
    await supabase.from("brain_dump").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteId(null);
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  const img = (item) => item.image_url || item.og_image || null;

  // Group items by day for dividers
  const groupedItems = [];
  let lastDay = null;
  items.forEach((item) => {
    const day = item.created_at?.slice(0, 10);
    if (day !== lastDay) { groupedItems.push({ type: "divider", day, label: formatDay(item.created_at) }); lastDay = day; }
    groupedItems.push({ type: "item", item });
  });

  return (
    <>
      <Head><title>Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></Head>
      <div style={s.root}>
        {/* Top bar */}
        <div style={s.topbar}>
          <div style={s.logoWrap}>
            <span style={s.logo}>Brain Dump</span>
            <span style={s.count}>{items.length}</span>
          </div>
          <div style={s.topActions}>
            <button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")} style={s.iconBtn} title="Wissel weergave">{viewMode === "list" ? "⊞" : "☰"}</button>
            <Link href="/save" style={s.addBtn}>+ Nieuw</Link>
            <button onClick={handleLogout} style={s.iconBtn} title="Uitloggen">↪</button>
          </div>
        </div>

        {/* Search */}
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek naam, inhoud, url..." style={s.searchInput} />
          {search && <button onClick={() => setSearch("")} style={s.clearBtn}>✕</button>}
        </div>

        {/* Date filter */}
        <div style={s.filterRow}>
          {[["all","Alles"],["today","Vandaag"],["week","Week"],["month","Maand"]].map(([val, label]) => (
            <button key={val} onClick={() => setDateFilter(val)} style={{ ...s.filterBtn, ...(dateFilter === val ? s.filterBtnActive : {}) }}>{label}</button>
          ))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={s.tagRow}>
            <button onClick={() => setActiveTag(null)} style={{ ...s.tagChip, ...(activeTag === null ? s.tagChipActive : {}) }}>alles</button>
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} style={{ ...s.tagChip, ...(activeTag === tag ? s.tagChipActive : {}) }}>{tag}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={s.empty}><span style={s.emptyText}>Laden...</span></div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>○</div>
            <div style={s.emptyText}>Nog niets opgeslagen.</div>
            <Link href="/save" style={s.emptyLink}>Eerste item toevoegen</Link>
          </div>
        ) : viewMode === "grid" ? (
          <div style={s.grid}>
            {items.map((item) => <GridCard key={item.id} item={item} img={img(item)} deleteId={deleteId} setDeleteId={setDeleteId} handleDelete={handleDelete} formatDate={formatDate} activeTag={activeTag} setActiveTag={setActiveTag} tc={TYPE_COLORS[item.type] || TYPE_COLORS.link} />)}
          </div>
        ) : (
          <div style={s.list}>
            {groupedItems.map((row, i) => {
              if (row.type === "divider") return (
                <div key={`d-${row.day}`} style={s.dayDivider}>
                  <div style={s.dayLine} />
                  <span style={s.dayLabel}>{row.label}</span>
                  <div style={s.dayLine} />
                </div>
              );
              return <ListCard key={row.item.id} item={row.item} img={img(row.item)} deleteId={deleteId} setDeleteId={setDeleteId} handleDelete={handleDelete} formatDate={formatDate} expandedId={expandedId} setExpandedId={setExpandedId} activeTag={activeTag} setActiveTag={setActiveTag} tc={TYPE_COLORS[row.item.type] || TYPE_COLORS.link} />;
            })}
          </div>
        )}
      </div>
    </>
  );
}

function GridCard({ item, img, deleteId, setDeleteId, handleDelete, formatDate, activeTag, setActiveTag, tc }) {
  const name = decode(item.name);
  const desc = decode(item.og_description || item.content || "");
  return (
    <div style={s.gridCard}>
      {img && <div style={s.gridImgWrap}><img src={img} alt="" style={s.gridImg} onError={(e) => { e.target.parentElement.style.display = "none"; }} /></div>}
      <div style={s.gridBody}>
        <div style={s.gridMeta}>
          <span style={{ ...s.typePill, background: tc.bg, color: tc.color }}>{item.type}</span>
          <span style={s.dateTxt}>{formatDate(item.created_at)}</span>
          <button onClick={() => setDeleteId(deleteId === item.id ? null : item.id)} style={s.delBtn}>✕</button>
        </div>
        <div style={s.gridName}>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{name}</a> : name}</div>
        {desc && <div style={s.gridDesc}>{desc.slice(0, 80)}{desc.length > 80 ? "..." : ""}</div>}
        {item.tags?.length > 0 && <div style={s.cardTags}>{item.tags.map((t) => <span key={t} onClick={() => setActiveTag(t)} style={{ ...s.tagMini, ...(activeTag === t ? s.tagMiniActive : {}) }}>{t}</span>)}</div>}
        {deleteId === item.id && <div style={s.delConfirm}><span style={s.delTxt}>Verwijderen?</span><button onClick={() => handleDelete(item.id)} style={s.delYes}>Ja</button><button onClick={() => setDeleteId(null)} style={s.delNo}>Nee</button></div>}
      </div>
    </div>
  );
}

function ListCard({ item, img, deleteId, setDeleteId, handleDelete, formatDate, expandedId, setExpandedId, activeTag, setActiveTag, tc }) {
  const expanded = expandedId === item.id;
  const name = decode(item.name);
  const desc = decode(item.og_description || item.content || "");
  return (
    <div style={s.listCard}>
      {img && (
        <div style={{ ...s.listImgWrap, cursor: "pointer" }} onClick={() => setExpandedId(expanded ? null : item.id)}>
          <img src={img} alt="" style={{ ...s.listImg, ...(expanded ? s.listImgExpanded : {}) }} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
          {!expanded && <div style={s.imgHint}>Tap om groter te zien</div>}
        </div>
      )}
      <div style={s.listBody}>
        <div style={s.listTop}>
          <div style={s.listMeta}><span style={{ ...s.typePill, background: tc.bg, color: tc.color }}>{item.type}</span><span style={s.dateTxt}>{formatDate(item.created_at)}</span></div>
          <button onClick={() => setDeleteId(deleteId === item.id ? null : item.id)} style={s.delBtn}>✕</button>
        </div>
        <div style={s.listName}>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{name}</a> : name}</div>
        {desc && <div style={s.listDesc}>{desc.slice(0, 130)}{desc.length > 130 ? "..." : ""}</div>}
        {item.url && <div style={s.urlTxt}>{item.url.replace(/^https?:\/\//,"").slice(0,55)}</div>}
        {item.tags?.length > 0 && <div style={s.cardTags}>{item.tags.map((t) => <span key={t} onClick={() => setActiveTag(t)} style={{ ...s.tagMini, ...(activeTag === t ? s.tagMiniActive : {}) }}>{t}</span>)}</div>}
        {deleteId === item.id && <div style={s.delConfirm}><span style={s.delTxt}>Verwijderen?</span><button onClick={() => handleDelete(item.id)} style={s.delYes}>Ja</button><button onClick={() => setDeleteId(null)} style={s.delNo}>Nee</button></div>}
      </div>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px", maxWidth: 680, margin: "0 auto" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: "-0.02em" },
  count: { background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 },
  topActions: { display: "flex", alignItems: "center", gap: 8 },
  addBtn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 13, padding: "8px 16px", borderRadius: 10, display: "inline-block" },
  iconBtn: { background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  searchWrap: { position: "relative", marginBottom: 10 },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "var(--muted)", pointerEvents: "none" },
  searchInput: { width: "100%", background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 40px 12px 42px", fontSize: 14, color: "var(--text)", boxShadow: "var(--shadow-sm)" },
  clearBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 4 },
  filterRow: { display: "flex", gap: 6, marginBottom: 10 },
  filterBtn: { background: "rgba(255,255,255,0.13)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" },
  filterBtnActive: { background: "var(--bg2)", color: "var(--text)" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tagChip: { background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)" },
  tagChipActive: { background: "var(--accent)", color: "var(--accent-text)" },
  // Day divider
  dayDivider: { display: "flex", alignItems: "center", gap: 10, padding: "12px 0 6px" },
  dayLine: { flex: 1, height: 1, background: "rgba(255,255,255,0.15)" },
  dayLabel: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", whiteSpace: "nowrap" },
  // Grid
  grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  gridCard: { background: "var(--bg2)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow-sm)" },
  gridImgWrap: { height: 120, overflow: "hidden" },
  gridImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  gridBody: { padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6 },
  gridMeta: { display: "flex", alignItems: "center", gap: 6 },
  gridName: { fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: "var(--text)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  gridDesc: { fontSize: 11, color: "var(--text2)", lineHeight: 1.5 },
  // List
  list: { display: "flex", flexDirection: "column", gap: 8 },
  listCard: { background: "var(--bg2)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow-sm)" },
  listImgWrap: { overflow: "hidden", maxHeight: 220 },
  listImg: { width: "100%", height: 200, objectFit: "cover", display: "block", transition: "height 0.2s" },
  listImgExpanded: { height: "auto", maxHeight: 600, objectFit: "contain", background: "#000" },
  imgHint: { textAlign: "center", padding: "4px 0 6px", fontSize: 10, color: "var(--muted)" },
  listBody: { padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 7 },
  listTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  listMeta: { display: "flex", alignItems: "center", gap: 8 },
  listName: { fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: "var(--text)", letterSpacing: "-0.01em" },
  listDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6 },
  urlTxt: { fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  // Shared
  typePill: { fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 5 },
  dateTxt: { fontSize: 11, color: "var(--muted)", flex: 1 },
  delBtn: { fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", opacity: 0.6 },
  cardTags: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 },
  tagMini: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: "var(--bg3)", color: "var(--text2)", cursor: "pointer" },
  tagMiniActive: { background: "var(--accent)", color: "var(--accent-text)" },
  delConfirm: { display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4 },
  delTxt: { fontSize: 12, color: "var(--danger)", flex: 1, fontWeight: 500 },
  delYes: { fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--danger)", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "var(--font)" },
  delNo: { fontSize: 12, fontWeight: 600, color: "var(--text2)", background: "var(--bg3)", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "var(--font)" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 80 },
  emptyIcon: { fontSize: 48, color: "rgba(255,255,255,0.3)" },
  emptyText: { fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 500 },
  emptyLink: { fontSize: 13, color: "var(--accent)", fontWeight: 700 },
};
