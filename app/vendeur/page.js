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

  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel('vendor-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans', filter: `vendeur_id=eq.${vendor.id}` }, 
      async (payload) => {
        if (payload.new.status === 'pending') {
          const { data: acheteur } = await supabase.from("acheteurs").select("*").eq("id", payload.new.acheteur_id).single();
          setDemandeAchat({ scanId: payload.new.id, acheteur });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  if (step === "loading") return <div style={containerLoginStyle}>Chargement...</div>;

  if (step === "login") return (
    <div style={containerLoginStyle}>
      <div style={{ background: "#fff", padding: 30, borderRadius: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
        <h1 style={{ textAlign: "center", color: "#000", marginTop: 0 }}>Espace Vendeur</h1>
        <label style={labelStyle}>Email :</label>
        <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Zone du stand :</label>
        <select value={zone} onChange={e => setZone(e.target.value)} style={inputStyle}>
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <label style={labelStyle}>Numéro de table :</label>
        <input type="number" placeholder="Ex: 14" value={table} onChange={e => setTable(e.target.value)} style={inputStyle} />
        <button onClick={handleLogin} style={{...btnPrimary, marginTop: 10}}>Ouvrir ma table</button>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#2563EB", minHeight: "100dvh", display: "flex", flexDirection: "column", color: "#fff", position: "relative", paddingBottom: 100 }}>
      
      {/* HEADER : NOM DU VENDEUR EN GRAND */}
      <div style={{ padding: "50px 20px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: "bold", margin: 0, letterSpacing: "-1px" }}>
          {vendor?.email.split('@')[0].toUpperCase()}
        </h1>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", padding: "6px 16px", borderRadius: 20, marginTop: 10, fontSize: 14, fontWeight: "600" }}>
          Table {vendor?.numero_table} • Zone {vendor?.zone}
        </div>
      </div>

      {activeTab === "qr" ? (
        
        /* ONGLET QR CODE (STYLE MAQUETTE) */
        <div className="animate-fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, marginTop: "-40px" }}>
          <div style={{ background: "#fff", padding: 35, borderRadius: 40, boxShadow: "0 15px 35px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{ width: 220, height: 220 }} />
          </div>
          <p style={{ marginTop: 40, fontSize: 18, fontWeight: "600", textAlign: "center", maxWidth: 260, lineHeight: 1.4, opacity: 0.9 }}>
            Faites scanner ce code pour attribuer les points.
          </p>
        </div>

      ) : (

        /* ONGLET CHIFFRES (ADAPTÉ AU FOND BLEU) */
        <div className="animate-fade-in" style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCardDark}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#fff" }}>{ventes.length}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Ventes totales</div>
            </div>
            <div style={statCardDark}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#10B981" }}>{ventes.reduce((s, v) => s + Number(v.montant), 0)}€</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Chiffre d'Affaires</div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "1px" }}>Historique des ventes</h3>
          {ventes.length === 0 ? <p style={{color: "rgba(255,255,255,0.5)", fontSize: 14}}>Aucune vente enregistrée.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ventes.map(v => (
                <div key={v.id} style={{ padding: 15, background: "rgba(255,255,255,0.1)", borderRadius: 16, display: "flex", justifyContent: "space-between", color: "#fff", backdropFilter: "blur(10px)" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 15 }}>Acheteur : {v.acheteurs?.pseudo}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Cartes: {v.nombre_cartes} | Scellés: {v.nombre_scelles||0}</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "#10B981", fontSize: 16 }}>{v.montant}€</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM NAVIGATION (EN BAS DE PAGE) */}
      <div style={bottomNavContainer}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? bottomNavBtnActive : bottomNavBtnInactive}>
          Mon QR Code
        </button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? bottomNavBtnActive : bottomNavBtnInactive}>
          Mes Chiffres
        </button>
      </div>

      {/* POPIN VENDEUR (STYLE CLAIR POUR ÊTRE LISIBLE) */}
      {demandeAchat && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <h3 style={{ marginTop: 0, color: "#000", fontSize: 22 }}>Validation de l'achat</h3>
            <p style={{ color: "#666", fontSize: 15, marginBottom: 20 }}>Acheteur : <strong style={{ color: "var(--accent)", fontSize: 18 }}>{demandeAchat.acheteur?.pseudo}</strong></p>
            
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

      {/* BOUTON DÉCONNEXION (DISCRET EN HAUT À GAUCHE) */}
      <button onClick={() => { localStorage.clear(); setStep("login"); setActiveTab("qr"); }} style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.2)", color: "white", border: "none", padding: "8px 16px", borderRadius: 20, fontSize: 12, cursor: "pointer", backdropFilter: "blur(5px)" }}>
        Déconnexion
      </button>
    </div>
  );
}

// =============================================
// COMPOSANT SAISIE VENTE (Inchangé)
// =============================================
function FormulaireVente({ vendorId, acheteurId, scanId, onDone, onCancel }) {
  const [cartes, setCartes] = useState("");
  const [scelles, setScelles] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("enregistrer_vente", {
      p_vendeur_id: vendorId,
      p_acheteur_id: acheteurId,
      p_nombre_cartes: parseInt(cartes) || 0,
      p_nombre_scelles: parseInt(scelles) || 0,
      p_montant: parseFloat(montant) || 0
    });
    
    if (!error) {
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
          {loading ? "..." : "Valider !"}
        </button>
      </div>
    </div>
  );
}

// --- STYLES PARTAGÉS ---
const containerLoginStyle = { display: "flex", flexDirection: "column", padding: 20, justifyContent: "center", minHeight: "100dvh", backgroundColor: "#2563EB" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#666", marginBottom: -10, zIndex: 1, display: "block", marginTop: 15 };
const inputStyle = { width: "100%", padding: "16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", boxSizing: "border-box" };
const btnPrimary = { padding: 16, borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontWeight: "bold", cursor: "pointer", width: "100%", fontSize: 16 };
const btnSecondary = { padding: 14, borderRadius: 12, border: "1px solid #ccc", background: "none", color: "#000", cursor: "pointer", fontWeight: "bold" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", color: "#000", padding: 30, borderRadius: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" };

const statCardDark = { padding: "20px", borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center", backdropFilter: "blur(10px)" };

// Styles de la navigation en bas de l'écran
const bottomNavContainer = { position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", display: "flex", padding: "10px 20px 30px", borderTopLeftRadius: 30, borderTopRightRadius: 30, boxShadow: "0 -5px 20px rgba(0,0,0,0.15)", gap: 10 };
const bottomNavBtnActive = { flex: 1, padding: "16px", background: "var(--accent)", color: "#fff", borderRadius: 16, fontWeight: "bold", border: "none", fontSize: 15, transition: "0.2s" };
const bottomNavBtnInactive = { flex: 1, padding: "16px", background: "#f5f5f5", color: "#888", borderRadius: 16, fontWeight: "bold", border: "none", fontSize: 15, transition: "0.2s" };