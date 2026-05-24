import { useState, useEffect } from "react";
import Head from "next/head";
import { supabase } from "../lib/supabase";

const TYPE_COLORS = { video: "#B085FF", instagram: "#FF6EB0", tweet: "#4DB8FF", link: "#CCFF00", tekst: "#FFD166", afbeelding: "#44FFCC", notitie: "#FF9F43", url: "#CCFF00" };

export default function Stats() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("brain_dump").select("id,type,tags,created_at").order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setItems(data); setLoading(false); });
  }, []);

  if (loading) return <div style={s.root}><div style={s.loadTxt}>Laden...</div></div>;

  // Compute stats
  const total = items.length;
  const byType = {};
  const byTag = {};
  const byDay = {};

  items.forEach((item) => {
    byType[item.type] = (byType[item.type] || 0) + 1;
    (item.tags || []).forEach((t) => { byTag[t] = (byTag[t] || 0) + 1; });
    const day = item.created_at?.slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
  });

  const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const sortedTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxType = Math.max(...sortedTypes.map((t) => t[1]), 1);
  const maxTag = Math.max(...sortedTags.map((t) => t[1]), 1);

  // Last 30 days sparkline
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last30.push({ date: key, count: byDay[key] || 0 });
  }
  const maxDay = Math.max(...last30.map((d) => d.count), 1);

  // This week / this month
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const thisWeek = items.filter((i) => i.created_at >= weekAgo).length;
  const thisMonth = items.filter((i) => i.created_at >= monthAgo).length;

  return (
    <>
      <Head><title>Stats - Brain Dump</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={s.root}>
        <div style={s.header}><span style={s.title}>Stats</span></div>

        {/* Summary cards */}
        <div style={s.summaryGrid}>
          <div style={s.summaryCard}>
            <div style={s.summaryNum}>{total}</div>
            <div style={s.summaryLabel}>Totaal</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryNum}>{thisWeek}</div>
            <div style={s.summaryLabel}>Deze week</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryNum}>{thisMonth}</div>
            <div style={s.summaryLabel}>Afgelopen maand</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryNum}>{Object.keys(byTag).length}</div>
            <div style={s.summaryLabel}>Unieke tags</div>
          </div>
        </div>

        {/* Activity sparkline */}
        <div style={s.card}>
          <div style={s.cardTitle}>Activiteit - afgelopen 30 dagen</div>
          <div style={s.sparkline}>
            {last30.map((d) => (
              <div key={d.date} style={s.sparkCol} title={`${d.date}: ${d.count}`}>
                <div style={{ ...s.sparkBar, height: `${Math.max(2, (d.count / maxDay) * 52)}px`, background: d.count > 0 ? "var(--accent)" : "var(--bg4)" }} />
              </div>
            ))}
          </div>
        </div>

        {/* By type */}
        <div style={s.card}>
          <div style={s.cardTitle}>Per type</div>
          <div style={s.barList}>
            {sortedTypes.map(([t, count]) => (
              <div key={t} style={s.barRow}>
                <div style={s.barLabel}>{t}</div>
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, width: `${(count / maxType) * 100}%`, background: TYPE_COLORS[t] || "var(--accent)" }} />
                </div>
                <div style={s.barCount}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* By tag */}
        {sortedTags.length > 0 && (
          <div style={s.card}>
            <div style={s.cardTitle}>Top tags</div>
            <div style={s.barList}>
              {sortedTags.map(([t, count]) => (
                <div key={t} style={s.barRow}>
                  <div style={s.barLabel}>{t}</div>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${(count / maxTag) * 100}%`, background: "var(--accent)" }} />
                  </div>
                  <div style={s.barCount}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", padding: "24px 16px 40px", maxWidth: 600, margin: "0 auto" },
  loadTxt: { color: "rgba(255,255,255,0.5)", fontFamily: "var(--font)", padding: 40, textAlign: "center" },
  header: { marginBottom: 20 },
  title: { fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.02em" },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 },
  summaryCard: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)", textAlign: "center" },
  summaryNum: { fontWeight: 800, fontSize: 32, color: "var(--text)", letterSpacing: "-0.03em" },
  summaryLabel: { fontSize: 12, color: "var(--muted)", fontWeight: 500, marginTop: 2 },
  card: { background: "var(--bg2)", borderRadius: "var(--radius)", padding: "16px 18px", boxShadow: "var(--shadow-sm)", marginBottom: 10 },
  cardTitle: { fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14, letterSpacing: "-0.01em" },
  sparkline: { display: "flex", alignItems: "flex-end", gap: 3, height: 56 },
  sparkCol: { flex: 1, display: "flex", alignItems: "flex-end" },
  sparkBar: { width: "100%", borderRadius: 2, transition: "height 0.2s" },
  barList: { display: "flex", flexDirection: "column", gap: 10 },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barLabel: { fontSize: 12, fontWeight: 600, color: "var(--text2)", width: 70, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  barCount: { fontSize: 12, fontWeight: 700, color: "var(--text)", width: 24, textAlign: "right", flexShrink: 0 },
};
