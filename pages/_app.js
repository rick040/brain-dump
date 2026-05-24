import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const PUBLIC_ROUTES = ["/login"];
const NAV_ROUTES = ["/", "/stats", "/ai", "/record"];

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.error);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !PUBLIC_ROUTES.includes(router.pathname)) router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      else setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
      if (event === "SIGNED_IN") setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, [router.pathname]);

  if (checking && !PUBLIC_ROUTES.includes(router.pathname)) {
    return <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:24, height:24, border:"2px solid rgba(0,0,0,0.1)", borderTop:"2px solid var(--text)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} /><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;
  }

  const showNav = NAV_ROUTES.includes(router.pathname);

  return (
    <>
      <Component {...pageProps} />
      {showNav && <BottomNav pathname={router.pathname} />}
    </>
  );
}

function BottomNav({ pathname }) {
  const tabs = [
    { href:"/",       icon:NavHome,   label:"Dump"   },
    { href:"/stats",  icon:NavStats,  label:"Stats"  },
    { href:"/record", icon:NavRecord, label:"Record", accent:true },
    { href:"/ai",     icon:NavAI,     label:"AI"     },
  ];

  return (
    <nav style={n.bar}>
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} style={{ ...n.tab, ...(t.accent ? n.tabAccent : {}) }}>
            <div style={{ ...n.iconWrap, ...(t.accent ? n.iconWrapAccent : {}), ...(active && !t.accent ? n.iconWrapActive : {}), ...(active && t.accent ? n.iconWrapAccentActive : {}) }}>
              <Icon active={active} accent={t.accent} />
            </div>
            <span style={{ ...n.label, ...(active ? n.labelActive : {}) }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const NavHome = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"var(--text)":"var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);
const NavStats = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"var(--text)":"var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const NavRecord = ({ active, accent }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accent ? "var(--accent-text)" : "var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const NavAI = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"var(--text)":"var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const n = {
  bar: { position:"fixed", bottom:0, left:0, right:0, height:"var(--nav-h)", background:"rgba(245,247,244,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"space-around", borderTop:"1px solid rgba(0,0,0,0.07)", zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)" },
  tab: { display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1, textDecoration:"none" },
  tabAccent: {},
  iconWrap: { width:40, height:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"var(--r-sm)", transition:"background 0.15s" },
  iconWrapActive: { background:"rgba(0,0,0,0.07)" },
  iconWrapAccent: { width:44, height:36, borderRadius:"var(--r-md)", background:"var(--text)" },
  iconWrapAccentActive: { background:"var(--sage)" },
  label: { fontSize:10, fontWeight:600, color:"var(--muted)", letterSpacing:"0.02em" },
  labelActive: { color:"var(--text)" },
};
