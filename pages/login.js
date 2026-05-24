import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Verkeerde gegevens."); setLoading(false); return; }
    router.push(router.query.redirect || "/");
  }

  return (
    <>
      <Head>
        <title>Login - Brain Dump</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.logoWrap}>
            <div style={s.logo}>Brain Dump</div>
            <div style={s.sub}>Privé toegang</div>
          </div>
          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.com" style={s.input} required autoComplete="email" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Wachtwoord</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={s.input} required autoComplete="current-password" />
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" disabled={loading} style={{ ...s.btn, ...(loading ? s.btnDis : {}) }}>
              {loading ? "Inloggen..." : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" },
  card: { width: "100%", maxWidth: 360, background: "var(--bg2)", borderRadius: 20, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: 28 },
  logoWrap: { textAlign: "center" },
  logo: { fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em", color: "var(--text)" },
  sub: { fontSize: 13, color: "var(--muted)", marginTop: 4 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { background: "var(--bg3)", border: "none", borderRadius: 10, padding: "13px 14px", fontSize: 15, color: "var(--text)", width: "100%", fontFamily: "var(--font)" },
  error: { fontSize: 12, color: "var(--danger)", padding: "8px 12px", background: "rgba(232,85,85,0.1)", borderRadius: 8, fontWeight: 500 },
  btn: { background: "var(--accent)", color: "var(--accent-text)", fontWeight: 700, fontSize: 15, padding: "14px", borderRadius: 12, width: "100%", border: "none", cursor: "pointer", fontFamily: "var(--font)", marginTop: 4 },
  btnDis: { opacity: 0.5 },
};
