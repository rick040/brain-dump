import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { supabase } from "../lib/supabase";

export default function AIPage() {
  const [analysis, setAnalysis] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [lastAnalyzed, setLastAnalyzed] = useState(null);
  // Chat state
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey! Ik heb toegang tot al je brain dump entries. Vraag me alles — wat heb je opgeslagen over X, welke patronen zie ik, wat zijn je meest actieve thema's." }]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    supabase.from("brain_dump").select("id,name,type").then(({ data }) => { if (data) setEntries(data); });
    try { const c = localStorage.getItem("bd_analysis"); if (c) { const p = JSON.parse(c); setAnalysis(p.data); setLastAnalyzed(p.ts); } } catch (_) {}
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(e) {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || chatLoading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: newMessages.slice(-10) }) });
      const data = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: data.reply || data.error || "Fout" }]);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: "Verbindingsfout. Probeer opnieuw." }]);
    }
    setChatLoading(false);
  }

  async function runAnalysis() {
    setLoadingAnalysis(true);
    try {
      const res = await fetch("/api/ai-analyze", { method: "POST" });
      const data = await res.json();
      if (!data.error) {
        setAnalysis(data);
        const ts = new Date().toLocaleString("nl-NL");
        setLastAnalyzed(ts);
        localStorage.setItem("bd_analysis", JSON.stringify({ data, ts }));
        setActiveTab("clusters");
      }
    } catch (_) {}
    setLoadingAnalysis(false);
  }

  const TABS = [
    { key: "chat", label: "Chat", icon: "◇" },
    { key: "clusters", label: "Clusters", icon: "⬡" },
    { key: "ideas", label: "Ideeën", icon: "✦" },
    { key: "connections", label: "Verbanden", icon: "⟡" },
  ];

  const PRIORITY = { hoog: "#FF6EB0", medium: "#CCFF00", laag: "#4DB8FF" };

  function EntryRef({ id }) {
    const e = entries.find((x) => x.id === id);
    if (!e) return null;
    return <span style={chip}>{e.name?.slice(0,28)}{e.name?.length > 28 ? "…" : ""}</span>;
  }
  const chip = { display:"inline-block", fontSize:10, fontWeight:600, background:"var(--bg)", color:"var(--text2)", padding:"2px 8px", borderRadius:"999px", margin:"2px" };

  const QUICK_PROMPTS = ["Wat zijn mijn meest opgeslagen thema's?", "Welke projecten kan ik starten?", "Wat heb ik opgeslagen over design?", "Verbanden die ik misschien over het hoofd zie"];

  return (
    <>
      <Head><title>AI - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={s.root}>
        <div style={s.header}>
          <div>
            <div style={s.title}>AI Assistent</div>
            {lastAnalyzed && <div style={s.sub}>Analyse: {lastAnalyzed}</div>}
          </div>
          <button onClick={runAnalysis} disabled={loadingAnalysis} style={s.analyzeBtn}>
            {loadingAnalysis ? "…" : "Analyseer"}
          </button>
        </div>

        {/* Tabs */}
        <div style={s.tabRow}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <div style={s.chatWrap}>
            <div style={s.chatMessages}>
              {messages.map((m, i) => (
                <div key={i} style={{ ...s.msg, ...(m.role === "user" ? s.msgUser : s.msgAI) }}>
                  {m.role === "assistant" && <div style={s.msgAvatar}>✦</div>}
                  <div style={{ ...s.msgBubble, ...(m.role === "user" ? s.msgBubbleUser : s.msgBubbleAI) }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ ...s.msg, ...s.msgAI }}>
                  <div style={s.msgAvatar}>✦</div>
                  <div style={{ ...s.msgBubble, ...s.msgBubbleAI, ...s.typing }}><span /><span /><span /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            {messages.length <= 1 && (
              <div style={s.quickPrompts}>
                {QUICK_PROMPTS.map((p) => (
                  <button key={p} onClick={() => { setInput(p); setTimeout(() => sendMessage(), 50); }} style={s.quickBtn}>{p}</button>
                ))}
              </div>
            )}

            <form onSubmit={sendMessage} style={s.chatForm}>
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vraag iets over je brain dump..." style={s.chatInput} disabled={chatLoading} />
              <button type="submit" disabled={chatLoading || !input.trim()} style={{ ...s.sendBtn, ...((!input.trim() || chatLoading) ? s.sendBtnDis : {}) }}>›</button>
            </form>
          </div>
        )}

        {/* CLUSTERS */}
        {activeTab === "clusters" && (
          <div style={s.section}>
            {!analysis ? <EmptyAnalysis onRun={runAnalysis} loading={loadingAnalysis} /> : (
              analysis.clusters?.map((c) => (
                <div key={c.id} style={s.card}>
                  <div style={s.cardTop}><div style={s.cardTitle}>{c.title}</div><span style={{ ...s.badge, color: c.strength === "hoog" ? "#CCFF00" : c.strength === "medium" ? "#FFD166" : "var(--muted)" }}>{c.strength}</span></div>
                  <div style={s.cardDesc}>{c.description}</div>
                  <div style={{ ...s.infoBox, background: "var(--bg)" }}><span style={s.infoLabel}>Inzicht: </span>{c.insight}</div>
                  <div style={s.chips}>{c.entry_ids?.map((id) => <EntryRef key={id} id={id} />)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* IDEAS */}
        {activeTab === "ideas" && (
          <div style={s.section}>
            {!analysis ? <EmptyAnalysis onRun={runAnalysis} loading={loadingAnalysis} /> : (
              analysis.ideas?.sort((a,b) => (b.priority==="hoog"?1:0)-(a.priority==="hoog"?1:0)).map((idea, i) => (
                <div key={i} style={s.card}>
                  <div style={s.cardTop}><div style={s.cardTitle}>{idea.title}</div><span style={{ ...s.badge, background: PRIORITY[idea.priority]+"22", color: PRIORITY[idea.priority] }}>{idea.priority}</span></div>
                  <div style={s.cardDesc}>{idea.description}</div>
                  <div style={{ ...s.infoBox, background: "var(--bg)" }}><span style={s.infoLabel}>Waarom jij: </span>{idea.why}</div>
                  <div style={s.chips}>{idea.entry_ids?.map((id) => <EntryRef key={id} id={id} />)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONNECTIONS */}
        {activeTab === "connections" && (
          <div style={s.section}>
            {!analysis ? <EmptyAnalysis onRun={runAnalysis} loading={loadingAnalysis} /> : (
              analysis.connections?.map((c, i) => (
                <div key={i} style={s.card}>
                  <div style={s.cardTop}><span style={s.connIcon}>⟡</span><div style={s.cardTitle}>{c.title}</div></div>
                  <div style={s.cardDesc}>{c.description}</div>
                  <div style={{ ...s.infoBox, background: "var(--bg)" }}><span style={s.infoLabel}>Potentieel: </span>{c.potential}</div>
                  <div style={s.chips}>{c.entry_ids?.map((id) => <EntryRef key={id} id={id} />)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes typing { 0%,60%,100%{opacity:0.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-4px)} }
        .typing span { display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--muted); margin:0 2px; animation: typing 1s infinite; }
        .typing span:nth-child(2) { animation-delay:0.2s; }
        .typing span:nth-child(3) { animation-delay:0.4s; }
      `}</style>
    </>
  );
}

function EmptyAnalysis({ onRun, loading }) {
  return (
    <div style={ea.wrap}>
      <div style={ea.icon}>✦</div>
      <div style={ea.title}>Nog geen analyse</div>
      <div style={ea.text}>Tik "Analyseer" rechtsboven om patronen, verbanden en ideeën te ontdekken.</div>
      <button onClick={onRun} disabled={loading} style={ea.btn}>{loading ? "Bezig..." : "Start analyse"}</button>
    </div>
  );
}
const ea = {
  wrap: { background:"var(--card)", borderRadius:"var(--r-lg)", padding:"32px 24px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:12, boxShadow:"var(--shadow-sm)" },
  icon: { fontSize:32, color:"var(--accent)" },
  title: { fontWeight:800, fontSize:18, color:"var(--text)" },
  text: { fontSize:13, color:"var(--text2)", maxWidth:260, lineHeight:1.6 },
  btn: { background:"var(--text)", color:"#fff", fontWeight:700, fontSize:14, padding:"11px 24px", borderRadius:"var(--r-md)", border:"none", cursor:"pointer", fontFamily:"var(--font)", marginTop:4 },
};

const s = {
  root: { minHeight:"100vh", background:"var(--bg)", padding:"20px var(--page-pad) 20px", maxWidth:600, margin:"0 auto" },
  header: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 },
  title: { fontWeight:800, fontSize:24, color:"var(--text)", letterSpacing:"-0.02em" },
  sub: { fontSize:11, color:"var(--muted)", marginTop:2 },
  analyzeBtn: { background:"var(--text)", color:"#fff", fontWeight:700, fontSize:13, padding:"9px 16px", borderRadius:"var(--r-md)", border:"none", cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 },
  tabRow: { display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 },
  tab: { display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:"999px", background:"var(--card)", border:"none", cursor:"pointer", fontFamily:"var(--font)", fontSize:13, fontWeight:600, color:"var(--text2)", whiteSpace:"nowrap", boxShadow:"var(--shadow-xs)" },
  tabActive: { background:"var(--text)", color:"#fff" },
  section: { display:"flex", flexDirection:"column", gap:10 },
  card: { background:"var(--card)", borderRadius:"var(--r-lg)", padding:"16px 18px", boxShadow:"var(--shadow-sm)", display:"flex", flexDirection:"column", gap:8 },
  cardTop: { display:"flex", alignItems:"center", gap:10 },
  cardTitle: { fontWeight:700, fontSize:15, color:"var(--text)", flex:1 },
  cardDesc: { fontSize:13, color:"var(--text2)", lineHeight:1.6 },
  infoBox: { borderRadius:"var(--r-sm)", padding:"8px 12px", fontSize:12, color:"var(--text2)" },
  infoLabel: { fontWeight:700, color:"var(--text)" },
  chips: { display:"flex", flexWrap:"wrap", gap:2, marginTop:2 },
  badge: { fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"2px 8px", borderRadius:"999px" },
  connIcon: { fontSize:18, color:"var(--accent)", flexShrink:0 },
  // Chat
  chatWrap: { display:"flex", flexDirection:"column", gap:12 },
  chatMessages: { display:"flex", flexDirection:"column", gap:10, maxHeight:"52vh", overflowY:"auto", paddingRight:4 },
  msg: { display:"flex", gap:8, alignItems:"flex-end" },
  msgAI: { flexDirection:"row" },
  msgUser: { flexDirection:"row-reverse" },
  msgAvatar: { width:28, height:28, borderRadius:"50%", background:"var(--text)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 },
  msgBubble: { maxWidth:"80%", padding:"10px 14px", borderRadius:"18px", fontSize:14, lineHeight:1.6 },
  msgBubbleAI: { background:"var(--card)", color:"var(--text)", borderBottomLeftRadius:4, boxShadow:"var(--shadow-xs)" },
  msgBubbleUser: { background:"var(--text)", color:"#fff", borderBottomRightRadius:4 },
  typing: { display:"flex", alignItems:"center", gap:0, padding:"12px 14px" },
  quickPrompts: { display:"flex", flexDirection:"column", gap:6 },
  quickBtn: { background:"var(--card)", border:"none", borderRadius:"var(--r-md)", padding:"11px 14px", fontSize:13, color:"var(--text2)", cursor:"pointer", fontFamily:"var(--font)", textAlign:"left", boxShadow:"var(--shadow-xs)", fontWeight:500 },
  chatForm: { display:"flex", gap:8, alignItems:"center" },
  chatInput: { flex:1, background:"var(--card)", border:"none", borderRadius:"var(--r-md)", padding:"12px 16px", fontSize:14, color:"var(--text)", boxShadow:"var(--shadow-sm)", fontFamily:"var(--font)" },
  sendBtn: { width:42, height:42, borderRadius:"50%", background:"var(--text)", color:"#fff", border:"none", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"var(--font)", flexShrink:0 },
  sendBtnDis: { opacity:0.4, cursor:"not-allowed" },
};
