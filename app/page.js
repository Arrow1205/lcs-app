"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between", minHeight: "100dvh", padding: "60px 24px",
      backgroundColor: "#050514", color: "#fff", fontFamily: "'DM Sans', sans-serif"
    }}>
      {/* Import des polices Google */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap');
        .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; }
      `}} />

      {/* Espace vide en haut pour centrer le logo */}
      <div></div>

      {/* Logo */}
      <div style={{ textAlign: "center", width: "100%", maxWidth: 280 }}>
        <img 
          src="/logo.png" 
          alt="Lille Card Show 2026" 
          style={{ width: "100%", height: "auto", objectFit: "contain" }}
          onError={(e) => {
            // Fallback si l'image n'est pas encore dans le dossier public/
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        {/* Placeholder texte qui s'affiche uniquement si logo.png est introuvable */}
        <div style={{ display: "none" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#F06A2A" }} className="fugaz">Lille</div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", lineHeight: 1 }} className="fugaz">CARD<br/>SHOW</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }} className="fugaz">2026</div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 320 }}>
        <button
          onClick={() => router.push("/vendeur")}
          className="fugaz"
          style={{
            padding: "18px 24px", borderRadius: 50, border: "2px solid #fff",
            background: "#F06A2A", color: "#fff",
            fontSize: 18, cursor: "pointer", transition: "transform 0.15s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          JE SUIS EXPOSANT
        </button>
        <button
          onClick={() => router.push("/acheteur")}
          className="fugaz"
          style={{
            padding: "18px 24px", borderRadius: 50, border: "2px solid #fff",
            background: "#1A0DFF", color: "#fff",
            fontSize: 18, cursor: "pointer", transition: "transform 0.15s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          JE SUIS VISITEUR
        </button>
      </div>
    </div>
  );
}