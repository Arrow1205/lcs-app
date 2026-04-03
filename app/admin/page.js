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
    if (pwd === ADMIN_CODE) { setStep("dashboard"); loadData(); }
    else { alert("Code incorrect"); }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: vData } = await supabase.from("vendeurs").select("*, ventes(nombre_cartes, montant)");
    setVendeurs((vData || []).map(v => ({
      ...v,
      totalCards: v.ventes?.reduce((sum, x) => sum + x.nombre_cartes, 0) || 0,
      totalRevenue: v.ventes?.reduce((sum, x) => sum + Number(x.montant), 0) || 0
    })));

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
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("admin-qr-reader");
    html5QrRef.current = scanner;
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const buyerId = new URLSearchParams(txt.split("?")[1]).get("buyer");
      if (buyerId) {
        const { data } = await supabase.from("acheteurs").select("*").eq("id", buyerId).single();
        setScanResult({ acheteur: data });
        await scanner.stop();
      }
    }, () => {});
  };

  if (step === "login") return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: "center" }}>Admin Login</h1>
      <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Code..." style={inputStyle} />
      <button onClick={handleLogin} style={btnPrimary}>Entrer</button>
    </div>
  );

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>Admin Dashboard</h2>
        <button onClick={() => setStep("login")} style={btnLink}>Quitter</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("vendeurs")} style={{...tabBtn, background: activeTab === "vendeurs" ? "#ddd" : "transparent"}}>Vendeurs</button>
        <button onClick={() => setActiveTab("acheteurs")} style={{...tabBtn, background: activeTab === "acheteurs" ? "#ddd" : "transparent"}}>Acheteurs</button>
      </div>

      {activeTab === "vendeurs" ? (
        <table style={tableStyle}>
          <thead><tr><th>Table</th><th>Vendeur</th><th>Cartes</th><th>€</th></tr></thead>
          <tbody>{vendeurs.map(v => <tr key={v.id}><td>{v.numero_table}</td><td>{v.email}</td><td>{v.totalCards}</td><td>{v.totalRevenue}€</td></tr>)}</tbody>
        </table>
      ) : (
        <table style={tableStyle}>
          <thead><tr><th>Pseudo</th><th>Points</th><th>Cartes</th><th>€</th></tr></thead>
          <tbody>{acheteurs.map(a => <tr key={a.id}><td>{a.pseudo}</td><td>{a.total_points}</td><td>{a.totalCards}</td><td>{a.totalSpent}€</td></tr>)}</tbody>
        </table>
      )}

      {/* Bouton Scan tout en bas */}
      <div style={{ position: "fixed", bottom: 20, left: 20, right: 20 }}>
        <button onClick={startScanner} style={{...btnPrimary, background: "var(--success)"}}>📷 Scanner un acheteur</button>
      </div>

      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div id="admin-qr-reader" style={{ width: "100%", minHeight: 250 }} />
            {scanResult?.acheteur && (
              <div style={{ marginTop: 15, textAlign: "center" }}>
                <p>Acheteur : <strong>{scanResult.acheteur.pseudo}</strong></p>
                <button onClick={async () => {
                   await supabase.from("acheteurs").update({ total_points: 0 }).eq("id", scanResult.acheteur.id);
                   setScanning(false); loadData();
                }} style={btnPrimary}>Confirmer Reset Points</button>
              </div>
            )}
            <button onClick={() => setScanning(false)} style={btnSecondary}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
// --- SHARED STYLES ---
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh" };
const inputStyle = { padding: 15, borderRadius: 10, border: "1px solid #ddd", fontSize: 16 };
const btnPrimary = { padding: 15, borderRadius: 10, border: "none", background: "#000", color: "#fff", fontWeight: "bold", cursor: "pointer" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "none", cursor: "pointer" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20 };
const tabBtn = { flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginTop: 10 };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", padding: 20, borderRadius: 20, width: "100%", maxWidth: 400 };