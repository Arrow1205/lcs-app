"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, QR_PREFIX, TIERS, calcPoints, getCurrentTier, getNextTier } from "@/lib/supabase";

export default function AcheteurPage() {
  // ... GARDE TES STATES ET LOGIQUES DE LOGIN (step, email, password, etc.) EXACTEMENT COMME AVANT ...

  // Nouveau State pour l'onglet actif
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "my_qr"
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    // On récupère l'URL de base du site pour la mettre dans le QR Code
    setAppUrl(window.location.origin);
  }, []);

  // =============================================
  // RENDER: MAIN
  // =============================================
  if (step === "main") {
    // L'URL magique : si scannée par qqn de normal, ça ouvre le site web. Si scannée par l'admin, ça reset.
    const myQrUrl = acheteurData ? `${appUrl}/?buyer=${acheteurData.id}` : "";
    const qrImageUrl = myQrUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(myQrUrl)}&color=07033A&bgcolor=ffffff` : "";

    return (
      <div className="animate-fade-in" style={{ padding: "24px 20px", paddingBottom: 120 }}>
        
        {/* Header (Inchagé) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Bonjour</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{acheteurData?.pseudo}</div>
          </div>
          <button onClick={handleLogout} style={btnLink}>Déconnexion</button>
        </div>

        {/* TABS (NOUVEAU) */}
        <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 12, padding: 4, marginBottom: 24, border: "1px solid var(--border)" }}>
          <button 
            onClick={() => setActiveTab("dashboard")}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: activeTab === "dashboard" ? "var(--bg)" : "transparent", color: activeTab === "dashboard" ? "var(--text)" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: activeTab === "dashboard" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
          >
            Tableau de bord
          </button>
          <button 
            onClick={() => setActiveTab("my_qr")}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: activeTab === "my_qr" ? "var(--bg)" : "transparent", color: activeTab === "my_qr" ? "var(--text)" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: activeTab === "my_qr" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
          >
            Mon QR Code
          </button>
        </div>

        {/* CONTENU : MON QR CODE */}
        {activeTab === "my_qr" ? (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "center", padding: "0 20px" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Voici ton QR personnel</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                L'organisateur le scannera pour te remettre ton lot et réinitialiser tes points.
              </p>
            </div>
            
            <div style={{ padding: 24, borderRadius: 20, background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", display: "inline-block" }}>
              <img src={qrImageUrl} alt="Mon QR Code" width={250} height={250} style={{ display: "block" }} />
            </div>

            <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(249,105,39,0.1)", color: "var(--accent)", fontSize: 13, fontWeight: 500, textAlign: "center" }}>
              ⚠️ Ne fais scanner ce QR qu'aux organisateurs !
            </div>
          </div>
        ) : (
          /* CONTENU : DASHBOARD CLASSIQUE (Ton code d'avant) */
          <>
            {/* Gamification Zone ... */}
            {/* Bouton Scanner un vendeur ... */}
            {/* Stats & Historique ... */}
            {/* NB: J'ai retiré le bouton "Admin reset" d'ici vu que l'admin a maintenant sa propre page */}
          </>
        )}

      </div>
    );
  }

  // ... GARDE TES AUTRES RENDERS (loading, login, setup) ...
}

// ... SHARED STYLES ...