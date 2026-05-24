import { useState, useEffect } from "react";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const PRIORITY_COLOR = { hoog: "#FF6EB0", medium: "#CCFF00", laag: "#4DB8FF" };
const STRENGTH_COLOR = { hoog: "#CCFF00", medium: "#FFD166", laag: "var(--muted)" };

function EntryChip({ id, entries }) {
  const e = entries.find((x) => x.id === id);
  if (!e) return null;
  return <span style={chip.wrap} title={e.name}>{e.name?.slice(0, 30)}{e.name?.length > 30 ? "..." : ""}</span>;
}
const chip = {
  wrap: { display: "inline-block", fontSize: 10, fontWeight: 600, background: "var(--bg3)", color: "var(--text2)", padding: "2px 8px", borderRadius: 5, margin: "2px" }
};

export default function AIPage() {
  const [analysis, setAnalysis] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("clusters");
  const [lastAnalyzed, setLastAnalyzed] = useState(null);

  useEffect(() => {
    // Load entries for chip display
    supabase.from("brain_dump").select("id,name,type").then(({ data }) => { if (data) setEntries(data); });
    // Load cached analysis from localStorage
    try {
      const cached = localStorage.getItem("bd_analysis");
      if (cached) { const p = JSON.parse(cached); setAnalysis(p.data); setLastAnalyzed(p.ts); }
    } catch (_) {}
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai-analyze", { method: "POST" });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setAnalysis(data);
      const ts = new Date().toLocaleString("nl-NL");
      setLastAnalyzed(ts);
      localStorage.setItem("bd_analysis", JSON.stringify({ data, ts }));
    } catch (e) {
      setError("Analyse mislukt: " + e.message);
    }
    setLoading(false);
  }

  const tabs = [
    { key: "clusters", label: "Clusters", icon: "⬡" },
    { key: "connections", label: "Verbanden", icon: "⟡" },
    { key: "ideas", label: "Ideeën", icon: "✦" },
    { key: "forgotten", label: "Vergeten", icon: "◌" },
  ];

  return (
    <>
      <Head><title>AI Insights - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={s.root}>
        <div style={s.header}>
          <div>
            <div style={s.title}>AI Insights</div>
            {lastAnalyzed && <div style={s.lastRun}>Laatste analyse: {lastAnalyzed}</div>}
            {analysis && <div style={s.entryCount}>{analysis.entryCount} entries geanalyseerd</div>}
          </div>
          <button onClick={runAnalysis} disabled={loading} style={{ ...s.analyzeBtn, ...(loading ? s.analyzeBtnLoading : {}) }}>
            {loading ? "Analyseren..." : analysis ? "Heranalyse" : "Analyseer"}
          </button>
        </div>

        {!analysis && !loading && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>✦</div>
            <div style={s.emptyTitle}>AI Analyse</div>
            <div style={s.emptyText}>De AI analyseert al je entries en ontdekt verborgen patronen, verbanden en project-ideeën die je misschien zelf gemist hebt.</div>
            <div style={s.featureList}>
              {["Thematische clusters in je saves", "Onverwachte verbanden tussen entries", "Concrete projectideeën op basis van patronen", "Vergeten items die nu relevant zijn"].map((f) => (
                <div key={f} style={s.featureItem}><span style={s.featureDot}>✓</span>{f}</div>
              ))}
            </div>
            <button onClick={runAnalysis} style={s.bigAnalyzeBtn}>Start analyse →</button>
          </div>
        )}

        {loading && (
          <div style={s.loadingWrap}>
            <div style={s.loadingIcon}>✦</div>
            <div style={s.loadingTitle}>Aan het analyseren...</div>
            <div style={s.loadingText}>Claude leest al je entries en zoekt naar verbanden en patronen.</div>
            <div style={s.loadingSteps}>
              {["Entries ophalen", "Patronen analyseren", "Verbanden leggen", "Ideeën genereren"].map((step, i) => (
                <div key={step} style={s.loadingStep}>
                  <span style={{ ...s.loadingDot, animationDelay: `${i * 0.4}s` }} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        {analysis && !loading && (
          <>
            {/* Summary */}
            {analysis.summary && (
              <div style={s.summaryCard}>
                <div style={s.summaryIcon}>✦</div>
                <div style={s.summaryText}>{analysis.summary}</div>
              </div>
            )}

            {/* Tabs */}
            <div style={s.tabRow}>
              {tabs.map((t) => {
                const count = analysis[t.key]?.length || 0;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {count > 0 && <span style={{ ...s.tabCount, ...(activeTab === t.key ? s.tabCountActive : {}) }}>{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Clusters */}
            {activeTab === "clusters" && (
              <div style={s.sectionList}>
                {(analysis.clusters || []).map((c) => (
                  <div key={c.id} style={s.clusterCard}>
                    <div style={s.clusterTop}>
                      <div style={s.clusterTitle}>{c.title}</div>
                      <span style={{ ...s.strengthBadge, color: STRENGTH_COLOR[c.strength] || "var(--muted)" }}>{c.strength}</span>
                    </div>
                    <div style={s.clusterDesc}>{c.description}</div>
                    <div style={s.insightBox}><span style={s.insightLabel}>Inzicht: </span>{c.insight}</div>
                    <div style={s.chipRow}>{(c.entry_ids || []).map((id) => <EntryChip key={id} id={id} entries={entries} />)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Connections */}
            {activeTab === "connections" && (
              <div style={s.sectionList}>
                {(analysis.connections || []).map((c, i) => (
                  <div key={i} style={s.connectionCard}>
                    <div style={s.connTop}>
                      <span style={s.connIcon}>⟡</span>
                      <div style={s.connTitle}>{c.title}</div>
                    </div>
                    <div style={s.connDesc}>{c.description}</div>
                    <div style={s.potentialBox}><span style={s.potentialLabel}>Potentieel: </span>{c.potential}</div>
                    <div style={s.chipRow}>{(c.entry_ids || []).map((id) => <EntryChip key={id} id={id} entries={entries} />)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Ideas */}
            {activeTab === "ideas" && (
              <div style={s.sectionList}>
                {(analysis.ideas || []).sort((a, b) => (b.priority === "hoog" ? 1 : 0) - (a.priority === "hoog" ? 1 : 0)).map((idea, i) => (
                  <div key={i} style={s.ideaCard}>
                    <div style={s.ideaTop}>
                      <div style={s.ideaTitle}>{idea.title}</div>
                      <span style={{ ...s.priorityBadge, background: PRIORITY_COLOR[idea.priority] + "22", color: PRIORITY_COLOR[idea.priority] }}>{idea.priority}</span>
                    </div>
                    <div style={s.ideaDesc}>{idea.description}</div>
                    <div style={s.whyBox}><span style={s.whyLabel}>Waarom jij: </span>{idea.why}</div>
                    <div style={s.chipRow}>{(idea.entry_ids || []).map((id) => <EntryChip key={id} id={id} entries={entries} />)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Forgotten */}
            {activeTab === "forgotten" && (
              <div style={s.sectionList}>
                <div style={s.forgottenIntro}>Items die je opgeslagen hebt maar misschien bent vergeten - nu opnieuw relevant.</div>
                {(analysis.forgotten || []).map((f, i) => (
                  <div key={i} style={s.forgottenCard}>
                    <div style={s.forgottenName}>{f.entry_name}</div>
                    <div style={s.forgottenReason}>{f.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:0.3 } 50% { opacity:1 } }
      `}</style>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "24px 16px 40px", maxWidth: 600, margin: "0 auto" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  title: { fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.02em" },
  lastRun: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  entryCount: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
  analyzeBtn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0 },
  analyzeBtnLoading: { opacity: 0.6 },

  // Empty state
  empty: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "28px 22px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--shadow-sm)" },
  emptyIcon: { fontSize: 32, color: "var(--accent)" },
  emptyTitle: { fontWeight: 800, fontSize: 20, color: "var(--text)", letterSpacing: "-0.02em" },
  emptyText: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6 },
  featureList: { display: "flex", flexDirection: "column", gap: 8 },
  featureItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text2)" },
  featureDot: { color: "var(--accent)", fontWeight: 700, flexShrink: 0 },
  bigAnalyzeBtn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 15, padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "var(--font)", marginTop: 4 },

  // Loading
  loadingWrap: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "32px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", boxShadow: "var(--shadow-sm)" },
  loadingIcon: { fontSize: 36, color: "var(--accent)", animation: "pulse 1.5s infinite" },
  loadingTitle: { fontWeight: 700, fontSize: 18, color: "var(--text)" },
  loadingText: { fontSize: 13, color: "var(--text2)", maxWidth: 280 },
  loadingSteps: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", width: "100%", maxWidth: 220 },
  loadingStep: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text2)" },
  loadingDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse 1s infinite", flexShrink: 0 },

  errorBox: { background: "rgba(232,85,85,0.12)", color: "var(--danger)", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500 },

  // Summary
  summaryCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px 18px", boxShadow: "var(--shadow-sm)", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  summaryIcon: { fontSize: 18, color: "var(--accent)", flexShrink: 0, marginTop: 2 },
  summaryText: { fontSize: 14, color: "var(--text2)", lineHeight: 1.7, fontStyle: "italic" },

  // Tabs
  tabRow: { display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" },
  tab: { display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" },
  tabActive: { background: "var(--bg2)", color: "var(--text)" },
  tabCount: { background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8 },
  tabCountActive: { background: "var(--accent)", color: "var(--accent-text)" },

  sectionList: { display: "flex", flexDirection: "column", gap: 10 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 2, marginTop: 8 },

  // Clusters
  clusterCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  clusterTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  clusterTitle: { fontWeight: 700, fontSize: 15, color: "var(--text)" },
  strengthBadge: { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  clusterDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 },
  insightBox: { background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text2)", lineHeight: 1.5 },
  insightLabel: { fontWeight: 700, color: "var(--text)" },

  // Connections
  connectionCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  connTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  connIcon: { fontSize: 18, color: "var(--accent)" },
  connTitle: { fontWeight: 700, fontSize: 15, color: "var(--text)" },
  connDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 },
  potentialBox: { background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text2)" },
  potentialLabel: { fontWeight: 700, color: "var(--text)" },

  // Ideas
  ideaCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  ideaTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  ideaTitle: { fontWeight: 700, fontSize: 15, color: "var(--text)", flex: 1 },
  priorityBadge: { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 5, flexShrink: 0 },
  ideaDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 },
  whyBox: { background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text2)" },
  whyLabel: { fontWeight: 700, color: "var(--text)" },

  // Forgotten
  forgottenIntro: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  forgottenCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" },
  forgottenName: { fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 6 },
  forgottenReason: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6 },
};
