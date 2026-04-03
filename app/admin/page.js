"use client";
import { useState, useEffect, useRef } from "react";
import { supabase, ADMIN_CODE } from "@/lib/supabase";

export default function AdminPage() {
  const [step, setStep] = useState("login");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [vendeurs, setVendeurs] = useState([]);
  const [acheteurs, setAcheteurs] = useState([]);

  // Scanner admin
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const html5QrRef = useRef(null);

  const handleLogin = () => {
    if (pwd === ADMIN_CODE) {
      setStep("dashboard");
      loadData();
    } else {
      setError("Code incorrect");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les vendeurs et leurs ventes
      const { data: vData } = await supabase.from("vendeurs").select("*, ventes(nombre_cartes, montant)");
      const vStats = (vData || []).map(v => ({
        ...v,
        totalCards: v.ventes.reduce((sum, x) => sum + x.nombre_cartes, 0),
        totalRevenue: v.ventes.reduce((sum, x) => sum + Number(x.montant), 0)
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);
      setVendeurs(vStats);

      // 2. Récupérer les acheteurs et leurs ventes
      const { data: aData } = await supabase.from("acheteurs").select("*, ventes(nombre_cartes, montant)");
      const aStats = (aData || []).map(a => ({
        ...a,
        totalCards: a.ventes.reduce((sum, x) => sum + x.nombre_cartes, 0),
        totalSpent: a.ventes.reduce((sum, x) => sum + Number(x.montant), 0)
      })).sort((a, b) => b.total_points - a.total_points);
      setAcheteurs(aStats);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // --- SCANNER ADMIN ---
  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("admin-qr-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          // On vérifie si c'est bien l'URL d'un acheteur (qui contient ?buyer=)
          if (!decodedText.includes("?buyer=")) {
            setScanResult({ error: "Ce n'est pas un QR Code Acheteur valide." });
            return;
          }

          // On extrait l'ID
          const urlParams = new URLSearchParams(decodedText.split("?")[1]);
          const buyerId = urlParams.get("buyer");

          if (buyerId) {
            const { data: acheteur } = await supabase.from("acheteurs").select("*").eq("id", buyerId).single();
            if (acheteur) {
              setScanResult({ acheteur });
              try { await scanner.stop(); } catch (e) {}
            } else {
              setScanResult({ error: "Acheteur introuvable en base de données." });
            }
          }
        },
        () => {}
      );
    } catch (err) {
      setScanResult({ error: "Impossible d'accéder à la caméra." });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch (e) {}
      html5QrRef.current = null;
    }
    setScanning(false);
    setScanResult(null);
  };

  const confirmReset = async (acheteurId) => {
    // Remise à zéro des points en BDD
    const { error } = await supabase.from("acheteurs").update({ total_points: 0 }).eq("id", acheteurId);
    if (!error) {
      setScanResult({ success: "Points réinitialisés avec succès !" });
      loadData(); // Rafraichir les tableaux
      setTimeout(stopScanner, 2000);
    } else {
      setScanResult({ error: "Erreur lors de la réinitialisation." });
    }
  };

  // =============================================
  // RENDER : LOGIN
  // =============================================
  if (step === "login") {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: "center" }}>Accès Admin</h1>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Code secret..." style={inputStyle} />
        {error && <div style={{ color: "#E24B4A", fontSize: 13, textAlign: "center" }}>{error}</div>}
        <button onClick={handleLogin} style={btnPrimary}>Se connecter</button>
      </div>
    );
  }

  // =============================================
  // RENDER : DASHBOARD ADMIN
  // =============================================
  return (
    <div className="animate-fade-in" style={{ padding: "32px 24px", paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Admin</h1>
        <button onClick={() => setStep("login")} style={{ ...btnLink, color: "#E24B4A" }}>Quitter</button>
      </div>

      <button onClick={startScanner} style={{ ...btnPrimary, width: "100%", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--success)" }}>
        📷 Scanner un Acheteur (Reset Points)
      </button>

      {/* OVERLAY SCANNER */}
      {scanning && (
        <div style={overlayStyle}>
          <div className="animate-slide-up" style={{ ...popupStyle, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Reset Acheteur</h3>
              <button onClick={stopScanner} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            
            <div id="admin-qr-reader" style={{ width: "100%", borderRadius: 16, overflow: "hidden", background: "#000", minHeight: 280 }} />
            
            {scanResult?.error && <div style={errorMsg}>{scanResult.error}</div>}
            {scanResult?.success && <div style={successMsg}>{scanResult.success}</div>}
            
            {scanResult?.acheteur && !scanResult.success && (
              <div style={{ textAlign: "center", padding: 16, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{scanResult.acheteur.pseudo}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>{scanResult.acheteur.total_points} points actuels</div>
                <button onClick={() => confirmReset(scanResult.acheteur.id)} style={{ ...btnPrimary, width: "100%", background: "#E24B4A" }}>
                  Confirmer le Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? <p>Chargement des données...</p> : (
        <>
          {/* STATS GLOBALES */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{vendeurs.length}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Vendeurs inscrits</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{acheteurs.length}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Acheteurs inscrits</div>
            </div>
          </div>

          {/* TABLEAU VENDEURS */}
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Classement Vendeurs</h2>
          <div style={{ overflowX: "auto", marginBottom: 32, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Table</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Cartes</th>
                  <th style={thStyle}>Total €</th>
                </tr>
              </thead>
              <tbody>
                {vendeurs.map(v => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}><strong>{v.numero_table}</strong></td>
                    <td style={tdStyle}>{v.email}</td>
                    <td style={tdStyle}>{v.totalCards}</td>
                    <td style={tdStyle}><span style={{ color: "var(--success)", fontWeight: 600 }}>{v.totalRevenue}€</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TABLEAU ACHETEURS */}
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Classement Acheteurs</h2>
          <div style={{ overflowX: "auto", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Pseudo</th>
                  <th style={thStyle}>Pts actuels</th>
                  <th style={thStyle}>Cartes</th>
                  <th style={thStyle}>Dépensé</th>
                </tr>
              </thead>
              <tbody>
                {acheteurs.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}><strong>{a.pseudo}</strong></td>
                    <td style={tdStyle}><span style={{ color: "var(--accent)", fontWeight: 600 }}>{a.total_points}</span></td>
                    <td style={tdStyle}>{a.totalCards}</td>
                    <td style={tdStyle}>{a.totalSpent}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// --- SHARED STYLES ---
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 15, outline: "none" };
const btnPrimary = { padding: "16px 24px", borderRadius: 14, border: "none", background: "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" };
const btnLink = { padding: 0, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 };
const popupStyle = { width: "100%", maxWidth: 420, padding: 24, borderRadius: 20, background: "var(--bg)", border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" };
const errorMsg = { padding: "12px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 14, fontWeight: 500, textAlign: "center" };
const successMsg = { padding: "12px", borderRadius: 10, background: "rgba(29,158,117,0.1)", color: "var(--success)", fontSize: 14, fontWeight: 500, textAlign: "center" };

// Table styles
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" };
const thStyle = { padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11, borderBottom: "1px solid var(--border)" };
const tdStyle = { padding: "14px 16px" };