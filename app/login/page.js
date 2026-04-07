"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const translations = {
  FR: {
    back: "← Retour",
    title: "CONNEXION",
    emailPlaceholder: "Adresse Email",
    pwdPlaceholder: "Mot de passe",
    btn: "SE CONNECTER",
    loading: "CHARGEMENT...",
    errEmpty: "Remplis tous les champs",
    errFail: "Email ou mot de passe incorrect !"
  },
  EN: {
    back: "← Back",
    title: "LOGIN",
    emailPlaceholder: "Email Address",
    pwdPlaceholder: "Password",
    btn: "SIGN IN",
    loading: "LOADING...",
    errEmpty: "Please fill all fields",
    errFail: "Incorrect email or password!"
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("FR");

  useEffect(() => {
    const savedLang = localStorage.getItem("lcs_lang");
    if (savedLang) setLang(savedLang);
  }, []);

  const t = translations[lang];

  const handleLogin = async () => {
    if (!email || !pwd) return alert(t.errEmpty);
    setLoading(true);
    const upperMail = email.trim().toUpperCase();

    const { data: acheteur } = await supabase.from("acheteurs").select("*").eq("email", upperMail).eq("mot_de_passe", pwd).maybeSingle();
    if (acheteur) {
      localStorage.setItem("lcs_acheteur_mail", acheteur.email);
      return router.push("/acheteur");
    }

    const { data: vendeur } = await supabase.from("vendeurs").select("*").eq("email", upperMail).eq("mot_de_passe", pwd).maybeSingle();
    if (vendeur) {
      localStorage.setItem("lcs_vendor_mail", vendeur.email);
      return router.push("/vendeur");
    }

    alert(t.errFail);
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      
      <button onClick={() => router.push("/")} className="dm" style={backBtn}>{t.back}</button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
        <h1 className="fugaz" style={{ textAlign: "center", fontSize: 32, marginBottom: 40 }}>{t.title}</h1>
        
        <input className="dm" type="email" placeholder={t.emailPlaceholder} value={email} onChange={e => setEmail(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="password" placeholder={t.pwdPlaceholder} value={pwd} onChange={e => setPwd(e.target.value)} style={inputStyleLeft} />
      </div>

      <button onClick={handleLogin} disabled={loading} className="fugaz" style={btnPrimary}>
        {loading ? t.loading : t.btn}
      </button>
    </div>
  );
}

const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#01011e", color: "#fff", padding: "40px 20px", maxWidth: 500, margin: "0 auto", position: "relative" };
const inputStyleLeft = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15, boxSizing: "border-box", fontSize: 14, textAlign: "left" };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#1A0DFF", color: "#fff", cursor: "pointer", fontSize: 16, width: "100%", marginTop: "auto" };
const backBtn = { position: "absolute", top: 30, left: 20, background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer" };