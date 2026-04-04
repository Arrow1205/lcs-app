"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ZONES = ["Basket", "Sport US", "Soccer", "TCG"];

export default function VendeurPage() {
  const [step, setStep] = useState("loading");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  
  const [vendor, setVendor] = useState(null);
  const [ventes, setVentes] = useState([]);
  
  // NOUVEAU STATE POUR LES ONGLETS
  const [activeTab, setActiveTab] = useState("qr"); // "qr" | "chiffres"

  useEffect(() => {
    const saved = localStorage.getItem("lcs_vendor");
    if (saved) {
      loadVendorData(JSON.parse(saved).email);
    } else {
      setStep("login");
    }
  }, []);

  const loadVendorData = async (mail) => {
    const { data: vData } = await supabase.from("vendeurs").select("*").eq("email", mail).maybeSingle();
    
    if (vData) {
      setVendor(vData);
      localStorage.setItem("lcs_vendor", JSON.stringify(vData));
      
      // Charger l'historique de ses ventes
      const { data: sales } = await supabase.from("ventes").select("*, acheteurs(pseudo)").eq("vendeur_id", vData.id).order("created_at", { ascending: false });
      setVentes(sales || []);
      setStep("main");
    } else {
      setStep("login"); 
    }
  };

  const handleLogin = async () => {
    if (!email || !table) return alert("Email et Numéro de table requis");
    
    // On cherche si le vendeur existe déjà
    let { data } = await supabase.from("vendeurs").select("*").eq("email", email).maybeSingle();
    
    // S'il n'existe pas, on le crée
    if (!data) {
      const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const { data: nv, error } = await supabase.from("vendeurs").insert({ 
        email, 
        zone, 
        numero_table: parseInt(table), 
        qr_code: qr 
      }).select().single();
      
      if (error) return alert("Erreur lors de l'inscription.");
      data = nv;
    }
    loadVendorData(data.email);
  };

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  // =============================================
  // RENDER : LOGIN
  // =============================================
  if (step === "login") return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: "center" }}>Espace Vendeur</h1>
      
      <label style={labelStyle}>Email :</label>
      <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      
      <label style={labelStyle}>Zone du stand :</label>
      <select value={zone} onChange={e => setZone(e.target.value)} style={inputStyle}>
        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
      </select>

      <label style={labelStyle}>Numéro de table :</label>
      <input type="number" placeholder="Ex: 14" value={table} onChange={e => setTable(e.target.value)} style={inputStyle} />

      <button onClick={handleLogin} style={btnPrimary}>Ouvrir ma table</button>
    </div>
  );

  // =============================================
  // RENDER : DASHBOARD (Main)
  // =============================================
  return (
    <div style={{ padding: "24px 20px", paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Table {vendor?.numero_table}</h2>
          <span style={{ fontSize: 13, color: "#666" }}>Zone {vendor?.zone}</span>
        </div>
        <button onClick={() => { localStorage.clear(); setStep("login"); setActiveTab("qr"); }} style={btnLink}>Déconnexion</button>
      </div>

      {/* SYSTÈME D'ONGLETS */}
      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("qr")} style={{...tabBtn, background: activeTab === "qr" ? "#e0e0e0" : "#f5f5f5", color: "#000"}}>
          Mon QR Code
        </button>
        <button onClick={() => setActiveTab("chiffres")} style={{...tabBtn, background: activeTab === "chiffres" ? "#e0e0e0" : "#f5f5f5", color: "#000"}}>
          Mes Chiffres
        </button>
      </div>

      {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}
      {activeTab === "qr" ? (
        
        /* ONGLET 1 : QR CODE */
        <div style={{ textAlign: "center", marginTop: 30, marginBottom: 30 }}>
          <div style={{ background: "#fff", padding: 20, display: "inline-block", borderRadius: 20, border: "1px solid #eee" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{ width: 200, height: 200 }} />
          </div>
          <p style={{ color: "#666", fontSize: 14, marginTop: 20 }}>
            Faites scanner ce code aux acheteurs après chaque vente pour leur donner des points.
          </p>
        </div>

      ) : (

        /* ONGLET 2 : CHIFFRES ET HISTORIQUE */
        <div className="animate-fade-in" style={{ marginTop: 20 }}>
          {/* KPI DU VENDEUR */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--accent, #F96927)" }}>{ventes.length}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Ventes totales</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--success, #1D9E75)" }}>{ventes.reduce((s, v) => s + Number(v.montant), 0)}€</div>
              <div style={{ fontSize: 12, color: "#666" }}>Chiffre d'Affaires</div>
            </div>
          </div>

          {/* HISTORIQUE */}
          <h3 style={{ fontSize: 14, color: "#666", textTransform: "uppercase" }}>Historique de vos ventes</h3>
          {ventes.length === 0 ? <p style={{color: "#888", fontSize: 14}}>Aucune vente enregistrée pour le moment.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ventes.map(v => (
                <div key={v.id} style={{ padding: 15, background: "#f9f9f9", borderRadius: 12, display: "flex", justifyContent: "space-between", color: "#000" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>Acheteur : {v.acheteurs?.pseudo}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{v.type_produit} - {v.nombre_cartes} art.</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "var(--success, #1D9E75)" }}>{v.montant}€</div>
                </div>
              ))}
            </div>
          )}
        </div>

      )}
    </div>
  );
}

// --- STYLES PARTAGÉS ---
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#666", marginBottom: -10, zIndex: 1 };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 15, borderRadius: 10, border: "none", background: "#000", color: "#fff", fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "#f9f9f9", border: "1px solid #eee", textAlign: "center" };
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20 };
const tabBtn = { flex: 1, padding: 10, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold", fontSize: 14 };