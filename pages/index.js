import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const TYPE_C = {
  video:      { bg:"#1A0A2E", c:"#B085FF" }, instagram: { bg:"#2E0A1A", c:"#FF6EB0" },
  tweet:      { bg:"#0A1420", c:"#4DB8FF" }, link:      { bg:"#0D1A0D", c:"#CCFF00" },
  tekst:      { bg:"#1A1A0A", c:"#FFD166" }, afbeelding:{ bg:"#0A1A18", c:"#44FFCC" },
  notitie:    { bg:"#1A100A", c:"#FF9F43" }, url:       { bg:"#0D1A0D", c:"#CCFF00" },
  pinterest:  { bg:"#2E0008", c:"#FF6B81" },
};

function decode(str) {
  if (!str) return "";
  return str.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x[0-9a-fA-F]+;/g,"").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"").trim();
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDay(iso) {
  const d = new Date(iso); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today - 86400000);
  if (d.getTime() === today.getTime()) return "Vandaag";
  if (d.getTime() === yesterday.getTime()) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday:"long", day:"numeric", month:"long" });
}

function formatDate(iso) { return new Date(iso).toLocaleDateString("nl-NL", { day:"2-digit", month:"short" }); }

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
    let q = supabase.from("brain_dump").select("*").order("created_at", { ascending:false });
    if (activeTag) q = q.contains("tags", [activeTag]);
    if (search.trim()) q = q.or(`name.ilike.%${search}%,content.ilike.%${search}%,url.ilike.%${search}%`);
    if (dateFilter === "today") q = q.gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
    else if (dateFilter === "week") q = q.gte("created_at", new Date(Date.now()-7*86400000).toISOString());
    else if (dateFilter === "month") q = q.gte("created_at", new Date(Date.now()-30*86400000).toISOString());
    const { data, error } = await q;
    if (!error && data) { setItems(data); setAllTags([...new Set(data.flatMap((i) => i.tags||[]))].sort()); }
    setLoading(false);
  }, [search, activeTag, dateFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleDelete(id) { await supabase.from("brain_dump").delete().eq("id",id); setItems((p) => p.filter((i) => i.id!==id)); setDeleteId(null); }
  async function handleLogout() { await supabase.auth.signOut(); }

  const img = (item) => item.image_url || item.og_image || null;

  // Group by day for dividers
  const rows = [];
  let lastDay = null;
  items.forEach((item) => {
    const day = item.created_at?.slice(0, 10);
    if (day !== lastDay) { rows.push({ isDivider:true, day, label:formatDay(item.created_at) }); lastDay=day; }
    rows.push({ isDivider:false, item });
  });

  return (
    <>
      <Head><title>Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></Head>
      <div style={s.root}>
        <div style={s.topbar}>
          <div style={s.logoRow}>
            <div style={s.logoIcon}>●</div>
            <span style={s.logo}>Brain Dump</span>
            <span style={s.count}>{items.length}</span>
          </div>
          <div style={s.topActions}>
            <button onClick={() => setViewMode(v => v==="list"?"grid":"list")} style={s.iconBtn}>{viewMode==="list"?"⊞":"☰"}</button>
            <Link href="/save" style={s.addBtn}>+ Nieuw</Link>
            <button onClick={handleLogout} style={s.iconBtn} title="Uitloggen">↪</button>
          </div>
        </div>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek je brain dump..." style={s.searchInput} />
          {search && <button onClick={() => setSearch("")} style={s.clearBtn}>✕</button>}
        </div>

        <div style={s.filterRow}>
          {[["all","Alles"],["today","Vandaag"],["week","Week"],["month","Maand"]].map(([v,l]) => (
            <button key={v} onClick={() => setDateFilter(v)} style={{ ...s.filterChip, ...(dateFilter===v ? s.filterChipActive : {}) }}>{l}</button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div style={s.tagScroll}>
            <button onClick={() => setActiveTag(null)} style={{ ...s.tagChip, ...(activeTag===null ? s.tagChipActive : {}) }}>Alles</button>
            {allTags.map((t) => <button key={t} onClick={() => setActiveTag(activeTag===t?null:t)} style={{ ...s.tagChip, ...(activeTag===t ? s.tagChipActive : {}) }}>{t}</button>)}
          </div>
        )}

        {loading ? (
          <div style={s.emptyWrap}><div style={s.loadDot} /><div style={s.loadDot} /><div style={s.loadDot} /></div>
        ) : items.length === 0 ? (
          <div style={s.emptyWrap}>
            <div style={s.emptyIcon}>○</div>
            <div style={s.emptyTitle}>Dump hier</div>
            <div style={s.emptyTxt}>Deel iets via Android of tik + Nieuw</div>
            <Link href="/save" style={s.emptyLink}>Eerste dump →</Link>
          </div>
        ) : viewMode === "grid" ? (
          <div style={s.grid}>
            {items.map((item) => <GridCard key={item.id} item={item} img={img(item)} deleteId={deleteId} setDeleteId={setDeleteId} handleDelete={handleDelete} formatDate={formatDate} activeTag={activeTag} setActiveTag={setActiveTag} decode={decode} stripHtml={stripHtml} tc={TYPE_C[item.type]||TYPE_C.link} />)}
          </div>
        ) : (
          <div style={s.list}>
            {rows.map((row, i) => row.isDivider ? (
              <div key={`d-${row.day}`} style={s.dayDiv}>
                <span style={s.dayLine} /><span style={s.dayLbl}>{row.label}</span><span style={s.dayLine} />
              </div>
            ) : (
              <ListCard key={row.item.id} item={row.item} img={img(row.item)} deleteId={deleteId} setDeleteId={setDeleteId} handleDelete={handleDelete} formatDate={formatDate} expandedId={expandedId} setExpandedId={setExpandedId} activeTag={activeTag} setActiveTag={setActiveTag} decode={decode} stripHtml={stripHtml} tc={TYPE_C[row.item.type]||TYPE_C.link} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TypePill({ type, tc }) {
  return <span style={{ ...pill.base, background: tc.bg, color: tc.c }}>{type}</span>;
}
const pill = { base: { fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", padding:"2px 7px", borderRadius:"999px", flexShrink:0 } };

function GridCard({ item, img, deleteId, setDeleteId, handleDelete, formatDate, activeTag, setActiveTag, decode, stripHtml, tc }) {
  const name = decode(item.name);
  const desc = stripHtml(decode(item.og_description||item.content||""));
  return (
    <div style={s.gridCard} style2={{}}>
      {img && <div style={s.gridImgWrap}><img src={img} style={s.gridImg} onError={(e)=>{e.target.parentElement.style.display="none";}} /></div>}
      <div style={s.gridBody}>
        <div style={s.rowMeta}><TypePill type={item.type} tc={tc} /><span style={s.dateTxt}>{formatDate(item.created_at)}</span><button onClick={() => setDeleteId(deleteId===item.id?null:item.id)} style={s.delBtn}>✕</button></div>
        <div style={s.gridName}>{item.url?<a href={item.url} target="_blank" rel="noreferrer">{name}</a>:name}</div>
        {desc && <div style={s.gridDesc}>{desc.slice(0,80)}{desc.length>80?"…":""}</div>}
        {item.tags?.length>0 && <div style={s.chipRow}>{item.tags.map((t)=><span key={t} onClick={()=>setActiveTag(t)} style={{ ...s.tagMini, ...(activeTag===t?s.tagMiniActive:{}) }}>{t}</span>)}</div>}
        {deleteId===item.id && <ConfirmDelete onYes={()=>handleDelete(item.id)} onNo={()=>setDeleteId(null)} />}
      </div>
    </div>
  );
}

function ListCard({ item, img, deleteId, setDeleteId, handleDelete, formatDate, expandedId, setExpandedId, activeTag, setActiveTag, decode, stripHtml, tc }) {
  const exp = expandedId === item.id;
  const name = decode(item.name);
  const desc = stripHtml(decode(item.og_description||item.content||""));
  return (
    <div style={s.listCard}>
      {img && (
        <div style={s.listImgWrap} onClick={() => setExpandedId(exp?null:item.id)}>
          <img src={img} style={{ ...s.listImg, ...(exp?s.listImgExp:{}) }} onError={(e)=>{e.target.parentElement.style.display="none";}} />
          {!exp && <div style={s.imgTap}>Tap om te vergroten</div>}
        </div>
      )}
      <div style={s.listBody}>
        <div style={s.rowMeta}><TypePill type={item.type} tc={tc} /><span style={s.dateTxt}>{formatDate(item.created_at)}</span><button onClick={()=>setDeleteId(deleteId===item.id?null:item.id)} style={s.delBtn}>✕</button></div>
        <div style={s.listName}>{item.url?<a href={item.url} target="_blank" rel="noreferrer" style={{color:"inherit"}}>{name}</a>:name}</div>
        {desc && <div style={s.listDesc}>{desc.slice(0,140)}{desc.length>140?"…":""}</div>}
        {item.url && <div style={s.urlTxt}>{item.url.replace(/^https?:\/\//,"").slice(0,55)}</div>}
        {item.tags?.length>0 && <div style={s.chipRow}>{item.tags.map((t)=><span key={t} onClick={()=>setActiveTag(t)} style={{ ...s.tagMini, ...(activeTag===t?s.tagMiniActive:{}) }}>{t}</span>)}</div>}
        {deleteId===item.id && <ConfirmDelete onYes={()=>handleDelete(item.id)} onNo={()=>setDeleteId(null)} />}
      </div>
    </div>
  );
}

function ConfirmDelete({ onYes, onNo }) {
  return (
    <div style={s.delRow}><span style={s.delTxt}>Verwijderen?</span><button onClick={onYes} style={s.delYes}>Ja</button><button onClick={onNo} style={s.delNo}>Nee</button></div>
  );
}

const s = {
  root: { minHeight:"100vh", background:"var(--bg)", padding:"20px var(--page-pad) 20px", maxWidth:680, margin:"0 auto" },
  topbar: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 },
  logoRow: { display:"flex", alignItems:"center", gap:8 },
  logoIcon: { width:28, height:28, borderRadius:"50%", background:"var(--sage)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#fff" },
  logo: { fontWeight:800, fontSize:20, color:"var(--text)", letterSpacing:"-0.02em" },
  count: { background:"var(--border-hi, rgba(0,0,0,0.08))", color:"var(--muted)", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:"999px" },
  topActions: { display:"flex", alignItems:"center", gap:8 },
  addBtn: { background:"var(--text)", color:"#fff", fontWeight:700, fontSize:13, padding:"8px 16px", borderRadius:"var(--r-md)", display:"inline-block", letterSpacing:"-0.01em" },
  iconBtn: { background:"var(--card)", border:"none", borderRadius:"var(--r-sm)", width:36, height:36, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"var(--shadow-xs)", color:"var(--text2)" },
  searchWrap: { position:"relative", marginBottom:12 },
  searchIcon: { position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:18, color:"var(--muted)", pointerEvents:"none" },
  searchInput: { width:"100%", background:"var(--card)", border:"none", borderRadius:"var(--r-md)", padding:"12px 40px 12px 42px", fontSize:14, color:"var(--text)", boxShadow:"var(--shadow-sm)", fontFamily:"var(--font)" },
  clearBtn: { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"var(--muted)", background:"none", border:"none", cursor:"pointer" },
  filterRow: { display:"flex", gap:6, marginBottom:12 },
  filterChip: { background:"var(--card)", border:"none", borderRadius:"999px", padding:"5px 14px", fontSize:12, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"var(--font)", boxShadow:"var(--shadow-xs)" },
  filterChipActive: { background:"var(--text)", color:"#fff" },
  tagScroll: { display:"flex", gap:6, overflowX:"auto", marginBottom:16, paddingBottom:2 },
  tagChip: { background:"var(--card)", border:"none", borderRadius:"999px", padding:"5px 14px", fontSize:12, fontWeight:600, color:"var(--text2)", cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap", boxShadow:"var(--shadow-xs)", flexShrink:0 },
  tagChipActive: { background:"var(--text)", color:"#fff" },
  dayDiv: { display:"flex", alignItems:"center", gap:10, padding:"12px 0 4px" },
  dayLine: { flex:1, height:1, background:"var(--border)" },
  dayLbl: { fontSize:11, fontWeight:700, color:"var(--muted)", letterSpacing:"0.04em", whiteSpace:"nowrap" },
  grid: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 },
  gridCard: { background:"var(--card)", borderRadius:"var(--r-lg)", overflow:"hidden", boxShadow:"var(--shadow-sm)" },
  gridImgWrap: { height:120, overflow:"hidden" },
  gridImg: { width:"100%", height:"100%", objectFit:"cover" },
  gridBody: { padding:"10px 12px 12px", display:"flex", flexDirection:"column", gap:6 },
  gridName: { fontSize:13, fontWeight:700, lineHeight:1.3, color:"var(--text)", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" },
  gridDesc: { fontSize:11, color:"var(--text2)", lineHeight:1.5 },
  list: { display:"flex", flexDirection:"column", gap:8 },
  listCard: { background:"var(--card)", borderRadius:"var(--r-lg)", overflow:"hidden", boxShadow:"var(--shadow-sm)" },
  listImgWrap: { overflow:"hidden", maxHeight:240, cursor:"pointer" },
  listImg: { width:"100%", height:200, objectFit:"cover", transition:"height 0.2s" },
  listImgExp: { height:"auto", maxHeight:600, objectFit:"contain", background:"#000" },
  imgTap: { textAlign:"center", padding:"3px 0 5px", fontSize:10, color:"var(--muted)" },
  listBody: { padding:"12px 14px 14px", display:"flex", flexDirection:"column", gap:7 },
  listName: { fontSize:16, fontWeight:700, lineHeight:1.3, color:"var(--text)", letterSpacing:"-0.01em" },
  listDesc: { fontSize:13, color:"var(--text2)", lineHeight:1.6 },
  urlTxt: { fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  rowMeta: { display:"flex", alignItems:"center", gap:7 },
  dateTxt: { fontSize:11, color:"var(--muted)", flex:1 },
  delBtn: { fontSize:12, color:"var(--muted)", opacity:0.5, padding:"2px 4px" },
  chipRow: { display:"flex", flexWrap:"wrap", gap:4, marginTop:2 },
  tagMini: { fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:"999px", background:"var(--bg)", color:"var(--text2)", cursor:"pointer" },
  tagMiniActive: { background:"var(--accent)", color:"var(--accent-text)" },
  delRow: { display:"flex", alignItems:"center", gap:8, paddingTop:8, borderTop:"1px solid var(--border)", marginTop:4 },
  delTxt: { fontSize:12, color:"var(--danger)", flex:1, fontWeight:500 },
  delYes: { fontSize:12, fontWeight:700, color:"#fff", background:"var(--danger)", border:"none", borderRadius:"999px", padding:"4px 14px", cursor:"pointer", fontFamily:"var(--font)" },
  delNo: { fontSize:12, fontWeight:600, color:"var(--text2)", background:"var(--bg)", border:"none", borderRadius:"999px", padding:"4px 14px", cursor:"pointer", fontFamily:"var(--font)" },
  emptyWrap: { display:"flex", flexDirection:"column", alignItems:"center", gap:12, paddingTop:80 },
  emptyIcon: { fontSize:48, color:"var(--border-hi,rgba(0,0,0,0.1))" },
  emptyTitle: { fontWeight:800, fontSize:22, color:"var(--text)", letterSpacing:"-0.02em" },
  emptyTxt: { fontSize:14, color:"var(--text2)" },
  emptyLink: { fontSize:14, fontWeight:700, color:"var(--text)", background:"var(--accent)", padding:"10px 20px", borderRadius:"var(--r-md)", marginTop:4 },
  loadDot: { display:"inline-block", width:6, height:6, borderRadius:"50%", background:"var(--muted)", margin:"80px 3px 0" },
};
