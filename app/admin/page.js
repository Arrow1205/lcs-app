"use client";
import { useState, useEffect, useRef } from "react";
import { supabase, ADMIN_CODE } from "@/lib/supabase";

export default function AdminPage() {
  const [step, setStep] = useState("login");
  const [pwd, setPwd] = useState("");
  const [activeTab, setActiveTab] = useState("vendeurs");
  const [vendeurs, setVendeurs] = useState([]);
  const [acheteurs, setAcheteurs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const html5QrRef = useRef(null);

  const handleLogin = () => {
    if (pwd === ADMIN_CODE) { 
      setStep("dashboard"); 
      loadData(); 
    } else { 
      alert("Code incorrect"); 
    }
  };

  const loadData = async () => {
    setLoading(true);
    // Vendeurs
    const { data: vData } = await supabase.from("vendeurs").select("*, ventes(nombre_cartes, montant)");
    setVendeurs((vData || []).map(v => ({
      ...v,
      totalCards: v.ventes?.reduce((sum, x) => sum + x.nombre_cartes, 0) || 0,
      totalRevenue: v.ventes?.reduce((sum, x) => sum + Number(x.montant), 0) || 0
    })));

    // Acheteurs
    const { data: aData } = await supabase.from("acheteurs").select("*, ventes(nombre_cartes, montant)");
    setAcheteurs((aData || []).map(a => ({
      ...a,
      totalCards: a.ventes?.reduce((sum, x) => sum + x.nombre_cartes, 0) || 0,
      totalSpent: a.ventes?.reduce((sum, x) => sum + Number(x.montant), 0) || 0
    })));
    setLoading(false);
  };

  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("admin-qr-reader");
    html5QrRef.current = scanner;
    
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const buyerId = new URLSearchParams(txt.split("?")[1])?.get("buyer");
      if (buyerId) {
        const { data } = await supabase.from("acheteurs").select("*").eq("id", buyerId).maybeSingle();
        setScanResult({ acheteur: data });
        await scanner.stop();
      }
    }, () => {});
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch(e) {}
    }
    setScanning(false);
    setScanResult(null);
  }

  // RENDER : LOGIN
  if (step === "login") return (
    <div style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <h1 style={{ margin: 0 }}>Accès Admin</h1>
      </div>
      
      <input 
        type="password" 
        value={pwd} 
        onChange={e => setPwd(e.target.value)} 
        placeholder="Entrez le code secret..." 
        style={inputStyle} 
      />
      <button onClick={handleLogin} style={btnPrimary}>Se connecter</button>
    </div>
  );

  // RENDER : DASHBOARD
  return (
    <div style={{ padding: "20px 20px 120px 20px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
        <button onClick={() => { setStep("login"); setPwd(""); }} style={btnLink}>Quitter</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("vendeurs")} style={{...tabBtn, background: activeTab === "vendeurs" ? "#ddd" : "#f5f5f5", color: "#000"}}>Vendeurs</button>
        <button onClick={() => setActiveTab("acheteurs")} style={{...tabBtn, background: activeTab === "acheteurs" ? "#ddd" : "#f5f5f5", color: "#000"}}>Acheteurs</button>
      </div>

      {loading ? <p style={{textAlign: "center"}}>Chargement des données...</p> : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: 10 }}>
          {activeTab === "vendeurs" ? (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Table</th><th style={thStyle}>Zone</th><th style={thStyle}>Vendeur</th><th style={thStyle}>Cartes</th><th style={thStyle}>€</th></tr></thead>
              <tbody>
                {vendeurs.sort((a,b) => b.totalRevenue - a.totalRevenue).map(v => (
                  <tr key={v.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tdStyle}><strong>{v.numero_table}</strong></td>
                    <td style={tdStyle}>{v.zone || "-"}</td>
                    <td style={tdStyle}>{v.email}</td>
                    <td style={tdStyle}>{v.totalCards}</td>
                    <td style={tdStyle}><span style={{ color: "var(--success, #1D9E75)", fontWeight: "bold" }}>{v.totalRevenue}€</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Pseudo</th><th style={thStyle}>Points</th><th style={thStyle}>Cartes</th><th style={thStyle}>Dépensé</th></tr></thead>
              <tbody>
                {acheteurs.sort((a,b) => b.total_points - a.total_points).map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tdStyle}><strong>{a.pseudo}</strong></td>
                    <td style={tdStyle}><span style={{ color: "var(--accent, #F96927)", fontWeight: "bold" }}>{a.total_points}</span></td>
                    <td style={tdStyle}>{a.totalCards}</td>
                    <td style={tdStyle}>{a.totalSpent}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* BOUTON SCAN FIXÉ EN BAS */}
      <div style={{ position: "fixed", bottom: 24, left: 24, right: 24, maxWidth: 800, margin: "0 auto" }}>
        <button onClick={startScanner} style={{...btnPrimary, background: "var(--success, #1D9E75)"}}>
          📷 Scanner un acheteur (Remise de lot)
        </button>
      </div>

      {/* POPUP SCANNER ADMIN */}
      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0 }}>Scanner Acheteur</h3>
              <button onClick={stopScanner} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#000" }}>✕</button>
            </div>
            
            <div id="admin-qr-reader" style={{ width: "100%", minHeight: 250, background: "#000", borderRadius: 12, overflow: "hidden" }} />
            
            {scanResult?.acheteur && (
              <div style={{ marginTop: 15, textAlign: "center", padding: 15, background: "#f9f9f9", borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#000" }}>{scanResult.acheteur.pseudo}</div>
                <div style={{ fontSize: 14, color: "#666", marginBottom: 15 }}>{scanResult.acheteur.total_points} points actuels</div>
                
                <button onClick={async () => {
                   await supabase.from("acheteurs").update({ total_points: 0 }).eq("id", scanResult.acheteur.id);
                   setScanResult(null);
                   stopScanner(); 
                   loadData();
                   alert(`Les points de ${scanResult.acheteur.pseudo} ont été remis à zéro !`);
                }} style={{ ...btnPrimary, background: "#E24B4A" }}>
                  Confirmer la remise à zéro
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES PARTAGÉS ---
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh", maxWidth: 400, margin: "0 auto" };
// ⚠️ CORRECTION DU DARK MODE ICI : backgroundColor et color forcés
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 16, borderRadius: 12, border: "none", background: "#000", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20 };
const tabBtn = { flex: 1, padding: 10, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold", fontSize: 14 };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
// ⚠️ CORRECTION DU DARK MODE ICI AUSSI
const popupStyle = { background: "#ffffff", color: "#000000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };

// Table styles
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left", color: "#000" };
const thStyle = { padding: "12px 10px", color: "#666", fontWeight: "bold", borderBottom: "2px solid #eee" };
const tdStyle = { padding: "12px 10px" };