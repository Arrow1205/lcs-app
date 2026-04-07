"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between", minHeight: "100dvh", padding: "80px 24px",
      backgroundColor: "#01011e", color: "#fff", fontFamily: "'DM Sans', sans-serif",
      position: "relative", overflow: "hidden"
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap');
        .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; }
      `}} />

      {/* Espace vide pour équilibrer */}
      <div></div>

      {/* Logo réduit de 20% */}
      <div style={{ textAlign: "center", width: "100%", maxWidth: 220, margin: "0 auto" }}>
        <img 
          src="/logo.png" 
          alt="Lille Card Show 2026" 
          style={{ width: "100%", height: "auto", objectFit: "contain" }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div style={{ display: "none" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#F06A2A" }} className="fugaz">Lille</div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", lineHeight: 1 }} className="fugaz">CARD<br/>SHOW</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }} className="fugaz">2026</div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 320, zIndex: 2 }}>
        <button onClick={() => router.push("/vendeur")} className="fugaz" style={btnOrange}>JE SUIS EXPOSANT</button>
        <button onClick={() => router.push("/acheteur")} className="fugaz" style={btnBlue}>JE SUIS VISITEUR</button>
      </div>
    </div>
  );
}

const btnOrange = { padding: "20px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", fontSize: 18, cursor: "pointer" };
const btnBlue = { padding: "20px", borderRadius: 50, border: "2px solid #fff", background: "#1A0DFF", color: "#fff", fontSize: 18, cursor: "pointer" };