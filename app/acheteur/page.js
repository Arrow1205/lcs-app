"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AcheteurPage() {
  const [step, setStep] = useState("login");
  const [pseudo, setPseudo] = useState("");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dash");

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) handleLogin(saved);
  }, []);

  const handleLogin = async (p) => {
    const loginName = p || pseudo;
    if (!loginName) return;
    
    let { data } = await supabase.from("acheteurs").select("*").eq("pseudo", loginName).single();
    
    if (!data) {
      const { data: newUser } = await supabase.from("acheteurs").insert({ pseudo: loginName, total_points: 0 }).select().single();
      data = newUser;
    }
    
    setUser(data);
    localStorage.setItem("lcs_pseudo", loginName);
    setStep("main");
  };

  if (step === "login") return (
    <div style={containerStyle}>
      <h1>Bienvenue Acheteur</h1>
      <input type="text" placeholder="Ton Pseudo..." value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle} />
      <button onClick={() => handleLogin()} style={btnPrimary}>Se connecter</button>
    </div>
  );

  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h3>Salut {user?.pseudo}</h3>
        <button onClick={() => { localStorage.clear(); setStep("login"); }} style={btnLink}>Quitter</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("dash")} style={{...tabBtn, background: activeTab === "dash" ? "#ddd" : "transparent"}}>Points</button>
        <button onClick={() => setActiveTab("qr")} style={{...tabBtn, background: activeTab === "qr" ? "#ddd" : "transparent"}}>Mon QR</button>
      </div>

      {activeTab === "qr" ? (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${myQrUrl}`} alt="QR" style={{ width: 250 }} />
          <p>Montre ce code à l'Admin pour tes cadeaux</p>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40, background: "#f9f9f9", borderRadius: 20 }}>
          <h1 style={{ fontSize: 60, margin: 0 }}>{user?.total_points}</h1>
          <p>POINTS CUMULÉS</p>
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