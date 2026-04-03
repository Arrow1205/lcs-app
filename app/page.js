"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="animate-fade-in" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 40,
    }}>
      {/* Logo / Title */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, margin: "0 auto 20px",
          background: "var(--accent)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 32,
        }}>
          🃏
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 3,
          color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8,
        }}>
          Salon de cartes 2026
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Programme fidélité
        </h1>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 320 }}>
        <button
          onClick={() => router.push("/vendeur")}
          style={{
            padding: "18px 24px", borderRadius: 14, border: "none",
            background: "var(--accent)", color: "#fff",
            fontSize: 17, fontWeight: 600, cursor: "pointer",
            transition: "transform 0.15s, background 0.2s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          Je suis vendeur
        </button>
        <button
          onClick={() => router.push("/acheteur")}
          style={{
            padding: "18px 24px", borderRadius: 14,
            border: "2px solid var(--border)", background: "transparent",
            color: "var(--text)", fontSize: 17, fontWeight: 600, cursor: "pointer",
            transition: "transform 0.15s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          Je suis acheteur
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 280 }}>
        Vendeurs : affichez votre QR code.<br />
        Acheteurs : scannez et cumulez vos points.
      </p>
    </div>
  );
}
