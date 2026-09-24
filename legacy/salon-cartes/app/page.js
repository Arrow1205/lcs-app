"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const translations = {
  FR: { exposant: "JE SUIS EXPOSANT", visiteur: "JE SUIS VISITEUR", login: "J'ai déjà un compte" },
  EN: { exposant: "I AM AN EXHIBITOR", visiteur: "I AM A VISITOR", login: "I already have an account" }
};

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState("FR");

  // On charge la langue au démarrage si elle existe déjà
  useEffect(() => {
    const savedLang = localStorage.getItem("lcs_lang");
    if (savedLang) setLang(savedLang);
  }, []);

  // Fonction pour changer et sauvegarder la langue
  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem("lcs_lang", newLang);
  };

  const t = translations[lang];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", minHeight: "100dvh", padding: "80px 24px", backgroundColor: "#01011e", color: "#fff", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />

      {/* Switcher de langue */}
      <div style={{ position: "absolute", top: 30, right: 20, display: "flex", gap: 10, zIndex: 10 }}>
        <button onClick={() => changeLang("FR")} className="fugaz" style={{ ...langBtn, opacity: lang === "FR" ? 1 : 0.4 }}>FR</button>
        <button onClick={() => changeLang("EN")} className="fugaz" style={{ ...langBtn, opacity: lang === "EN" ? 1 : 0.4 }}>EN</button>
      </div>

      <div style={{ height: 40 }}></div>

      <div style={{ textAlign: "center", width: "100%", maxWidth: 220, margin: "0 auto" }}>
        <img src="/logo.png" alt="Lille Card Show 2026" style={{ width: "100%", height: "auto", objectFit: "contain" }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
        <div style={{ display: "none" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#F06A2A" }} className="fugaz">Lille</div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", lineHeight: 1 }} className="fugaz">CARD<br/>SHOW</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 320, zIndex: 2, textAlign: "center" }}>
        <button onClick={() => router.push("/vendeur")} className="fugaz" style={btnOrange}>{t.exposant}</button>
        <button onClick={() => router.push("/acheteur")} className="fugaz" style={btnBlue}>{t.visiteur}</button>
        <button onClick={() => router.push("/login")} className="dm" style={linkBtn}>{t.login}</button>
      </div>
    </div>
  );
}

const langBtn = { background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", transition: "0.2s" };
const btnOrange = { padding: "20px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", fontSize: 18, cursor: "pointer" };
const btnBlue = { padding: "20px", borderRadius: 50, border: "2px solid #fff", background: "#1A0DFF", color: "#fff", fontSize: 18, cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#888", textDecoration: "underline", marginTop: 10, cursor: "pointer", fontSize: 14 };