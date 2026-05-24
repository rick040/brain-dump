import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const PUBLIC_ROUTES = ["/login"];
const NAV_ROUTES = ["/", "/stats", "/ai", "/record"];

function BottomNav({ pathname }) {
  const tabs = [
    { href: "/", icon: "⊞", label: "Dump" },
    { href: "/record", icon: "◉", label: "Record", accent: true },
    { href: "/stats", icon: "◎", label: "Stats" },
    { href: "/ai", icon: "✦", label: "AI" },
  ];
  return (
    <nav style={nav.bar}>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} style={{ ...nav.tab, ...(t.accent ? nav.tabAccent : {}), ...(active ? (t.accent ? nav.tabAccentActive : nav.tabActive) : {}) }}>
            <span style={{ ...nav.icon, ...(t.accent ? nav.iconAccent : {}), ...(active ? nav.iconActive : {}) }}>{t.icon}</span>
            <span style={{ ...nav.label, ...(active ? nav.labelActive : {}) }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const nav = {
  bar: { position: "fixed", bottom: 0, left: 0, right: 0, height: "var(--nav-h)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(0,0,0,0.08)", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" },
  tab: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 16px", borderRadius: 12, textDecoration: "none", flex: 1 },
  tabAccent: {},
  tabAccentActive: {},
  tabActive: {},
  icon: { fontSize: 20, color: "var(--muted)", lineHeight: 1 },
  iconAccent: { fontSize: 24, color: "var(--text)" },
  iconActive: { color: "var(--text)" },
  label: { fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" },
  labelActive: { color: "var(--text)" },
};

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.error);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !PUBLIC_ROUTES.includes(router.pathname)) {
        router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      } else setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
      if (event === "SIGNED_IN") setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, [router.pathname]);

  if (checking && !PUBLIC_ROUTES.includes(router.pathname)) {
    return <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "var(--font)", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Laden...</span></div>;
  }

  const showNav = NAV_ROUTES.includes(router.pathname);

  return (
    <>
      <Component {...pageProps} />
      {showNav && <BottomNav pathname={router.pathname} />}
    </>
  );
}
