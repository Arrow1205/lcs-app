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