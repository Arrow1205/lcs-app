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
  const [activeTab, setActiveTab] = useState("qr");

  // State pour gérer la popin entrante
  const [demandeAchat, setDemandeAchat] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_vendor");
    if (saved) { loadVendorData(JSON.parse(saved).email); } 
    else { setStep("login"); }
  }, []);

  const loadVendorData = async (mail) => {
    const { data: vData } = await supabase.from("vendeurs").select("*").eq("email", mail).maybeSingle();
    if (vData) {
      setVendor(vData);
      localStorage.setItem("lcs_vendor", JSON.stringify(vData));
      const { data: sales } = await supabase.from("ventes").select("*, acheteurs(pseudo)").eq("vendeur_id", vData.id).order("created_at", { ascending: false });
      setVentes(sales || []);
      setStep("main");
    } else { setStep("login"); }
  };

  const handleLogin = async () => {
    if (!email || !table) return alert("Email et Numéro de table requis");
    let { data } = await supabase.from("vendeurs").select("*").eq("email", email).maybeSingle();
    if (!data) {
      const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const { data: nv, error } = await supabase.from("vendeurs").insert({ email, zone, numero_table: parseInt(table), qr_code: qr }).select().single();
      if (error) return alert("Erreur lors de l'inscription.");
      data = nv;
    }
    loadVendorData(data.email);
  };

  // ÉCOUTE DES DEMANDES ENTRANTES
  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel('vendor-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans', filter: `vendeur_id=eq.${vendor.id}` }, 
      async (payload) => {
        // Un acheteur vient de scanner le QR code de ce vendeur !
        if (payload.new.status === 'pending') {
          // On récupère le pseudo de l'acheteur
          const { data: acheteur } = await supabase.from("acheteurs").select("*").eq("id", payload.new.acheteur_id).single();
          setDemandeAchat({ scanId: payload.new.id, acheteur });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

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

  return (
    <div style={{ padding: "24px 20px", paddingBottom: 100, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Table {vendor?.numero_table}</h2>
          <span style={{ fontSize: 13, color: "#666" }}>Zone {vendor?.zone}</span>
        </div>
        <button onClick={() => { localStorage.clear(); setStep("login"); setActiveTab("qr"); }} style={btnLink}>Déconnexion</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>Mon QR Code</button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? activeTabStyle : inactiveTabStyle}>Mes Chiffres</button>
      </div>

      {activeTab === "qr" ? (
        <div style={{ textAlign: "center", marginTop: 30, marginBottom: 30 }}>
          <div style={{ background: "#fff", padding: 20, display: "inline-block", borderRadius: 20, border: "1px solid #eee" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{ width: 200, height: 200 }} />
          </div>
          <p style={{ color: "#666", fontSize: 14, marginTop: 20 }}>Laissez ce QR Code visible pour que les acheteurs le scannent.</p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--accent)" }}>{ventes.length}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Ventes totales</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--success, #1D9E75)" }}>{ventes.reduce((s, v) => s + Number(v.montant), 0)}€</div>
              <div style={{ fontSize: 12, color: "#666" }}>Chiffre d'Affaires</div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, color: "#666", textTransform: "uppercase" }}>Historique de vos ventes</h3>
          {ventes.length === 0 ? <p style={{color: "#888", fontSize: 14}}>Aucune vente enregistrée.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ventes.map(v => (
                <div key={v.id} style={{ padding: 15, background: "#f9f9f9", borderRadius: 12, display: "flex", justifyContent: "space-between", color: "#000" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>Acheteur : {v.acheteurs?.pseudo}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>Cartes: {v.nombre_cartes} | Scellés: {v.nombre_scelles||0}</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "var(--success, #1D9E75)" }}>{v.montant}€</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POPIN VENDEUR : SAISIE DE LA VENTE */}
      {demandeAchat && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <h3 style={{ marginTop: 0, color: "#000" }}>Validation de l'achat</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>Acheteur : <strong style={{ color: "#000" }}>{demandeAchat.acheteur?.pseudo}</strong></p>
            
            <FormulaireVente 
              vendorId={vendor.id} 
              acheteurId={demandeAchat.acheteur?.id} 
              scanId={demandeAchat.scanId}
              onDone={() => { setDemandeAchat(null); loadVendorData(vendor.email); }} 
              onCancel={async () => {
                await supabase.from("scans").update({ status: 'rejected' }).eq("id", demandeAchat.scanId);
                setDemandeAchat(null);
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// COMPOSANT SAISIE VENTE (Côté Vendeur)
// =============================================
function FormulaireVente({ vendorId, acheteurId, scanId, onDone, onCancel }) {
  const [cartes, setCartes] = useState("");
  const [scelles, setScelles] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    // On appelle la fonction SQL pour créer la vente et donner les points
    const { error } = await supabase.rpc("enregistrer_vente", {
      p_vendeur_id: vendorId,
      p_acheteur_id: acheteurId,
      p_nombre_cartes: parseInt(cartes) || 0,
      p_nombre_scelles: parseInt(scelles) || 0,
      p_montant: parseFloat(montant) || 0
    });
    
    if (!error) {
      // Si la vente passe, on valide le status du scan pour que le téléphone de l'acheteur l'affiche
      await supabase.from("scans").update({ status: 'accepted' }).eq("id", scanId);
      onDone();
    } else {
      alert(`Erreur : ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: "bold", color: "#666" }}>Nb. Cartes</label>
          <input type="number" value={cartes} onChange={e => setCartes(e.target.value)} placeholder="Ex: 2" style={{...inputStyle, marginTop: 5}} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: "bold", color: "#666" }}>Nb. Scellés</label>
          <input type="number" value={scelles} onChange={e => setScelles(e.target.value)} placeholder="Ex: 1" style={{...inputStyle, marginTop: 5}} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: "bold", color: "#666" }}>Montant total (€)</label>
        <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="Ex: 45" style={{...inputStyle, marginTop: 5}} />
      </div>
      
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Refuser</button>
        <button onClick={handleConfirm} disabled={loading} style={{ ...btnPrimary, flex: 2, background: "var(--success, #1D9E75)" }}>
          {loading ? "..." : "Valider et donner les points"}
        </button>
      </div>
    </div>
  );
}

// --- STYLES PARTAGÉS ---
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#666", marginBottom: -10, zIndex: 1 };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 15, borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid #ccc", background: "none", color: "#000", cursor: "pointer" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "#f9f9f9", border: "1px solid #eee", textAlign: "center" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", color: "#000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };

const tabsContainer = { display: "flex", gap: 10, marginBottom: 20, background: "#f5f5f5", padding: 6, borderRadius: 50 };
const activeTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "var(--accent)", color: "#fff", transition: "all 0.2s" };
const inactiveTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "transparent", color: "#666", transition: "all 0.2s" };