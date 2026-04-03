"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function VendeurPage() {
  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState("");
  const [vendor, setVendor] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_vendor");
    if (saved) {
      setVendor(JSON.parse(saved));
      setStep("main");
    }
  }, []);

  const handleLogin = async () => {
    let { data } = await supabase.from("vendeurs").select("*").eq("email", email).single();
    if (!data) {
      const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const { data: nv } = await supabase.from("vendeurs").insert({ email, numero_table: table, qr_code: qr }).select().single();
      data = nv;
    }
    setVendor(data);
    localStorage.setItem("lcs_vendor", JSON.stringify(data));
    setStep("main");
  };

  if (step === "login") return (
    <div style={containerStyle}>
      <h1>Espace Vendeur</h1>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <input type="number" placeholder="N° Table" value={table} onChange={e => setTable(e.target.value)} style={inputStyle} />
      <button onClick={handleLogin} style={btnPrimary}>Ouvrir ma table</button>
    </div>
  );

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Table {vendor?.numero_table}</h2>
      <div style={{ background: "white", padding: 20, display: "inline-block", borderRadius: 20 }}>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{ width: 250 }} />
      </div>
      <p>Faites scanner ce code aux acheteurs</p>
      <button onClick={() => { localStorage.clear(); setStep("login"); }} style={btnSecondary}>Déconnexion</button>
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