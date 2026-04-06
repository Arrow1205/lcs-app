"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ZONES = ["Basket", "Sport US", "Soccer", "TCG"];

export default function VendeurPage() {
  const [step, setStep] = useState("loading");
  
  // Inscription
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

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  if (step === "login") return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      <h1 className="fugaz" style={{ textAlign: "center", fontSize: 26, margin: "0 0 20px 0" }}>INSCRIPTION EXPOSANT</h1>
      <p className="dm" style={{ textAlign: "center", fontSize: 13, color: "#ccc", marginBottom: 40, padding: "0 20px" }}>
        Texte descriptif des avantages Texte descriptif des avantages des avantages.
      </p>

      <input className="dm" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      
      <select className="dm" value={zone} onChange={e => setZone(e.target.value)} style={inputStyle}>
        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
      </select>
      
      <input className="dm" type="number" placeholder="N° table" value={table} onChange={e => setTable(e.target.value)} style={inputStyle} />
      
      <div style={{ flex: 1 }} />
      <button onClick={handleLogin} className="fugaz" style={btnPrimary}>OUVRIR MA TABLE</button>
    </div>
  );

  return (
    <div style={{ ...containerStyle, padding: "40px 20px", justifyContent: "flex-start" }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      
      {/* TABS */}
      <div className="fugaz" style={{ display: "flex", gap: 20, marginBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10 }}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? activeTabStyle : inactiveTabStyle}>MES CHIFFRES</button>
      </div>

      {activeTab === "qr" ? (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <h2 className="fugaz" style={{ color: "#F06A2A", fontSize: 26, marginBottom: 20, textAlign: "center" }}>
            {vendor?.email.split('@')[0]}
          </h2>
          
          <div style={{ background: "#fff", padding: 20, borderRadius: 20, width: "100%", maxWidth: 300, display: "flex", justifyContent: "center" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{ width: "100%", height: "auto" }} />
          </div>
          
          <div className="dm" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "10px 20px", borderRadius: 50, marginTop: 20, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            TABLE N°{vendor?.numero_table} — {vendor?.zone}
          </div>

          <button onClick={() => { localStorage.clear(); setStep("login"); }} className="dm" style={{ marginTop: 40, background: "none", border: "none", color: "#666", textDecoration: "underline" }}>Se déconnecter</button>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 30 }}>
            <div style={statCardDark}>
              <div className="fugaz" style={{ fontSize: 36, color: "#F06A2A", lineHeight: 1 }}>{ventes.length}</div>
              <div className="dm" style={{ fontSize: 12, marginTop: 5 }}>Nb de ventes</div>
            </div>
            <div style={statCardDark}>
              <div className="fugaz" style={{ fontSize: 36, color: "#F06A2A", lineHeight: 1 }}>{ventes.reduce((s, v) => s + Number(v.montant), 0)} €</div>
              <div className="dm" style={{ fontSize: 12, marginTop: 5 }}>Chiffre d'affaires</div>
            </div>
          </div>

          <h3 className="dm" style={{ fontSize: 13, color: "#fff", marginBottom: 15 }}>Historique de ventes</h3>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>Aucune vente enregistrée.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ventes.map(v => (
                <div key={v.id} style={{ padding: "15px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="dm" style={{ fontWeight: "bold", fontSize: 11, color: "#1A0DFF", textTransform: "uppercase" }}>{v.acheteurs?.pseudo}</div>
                    <div className="dm" style={{ fontSize: 11, color: "#ccc", marginTop: 4, textTransform: "uppercase" }}>
                      {v.nombre_cartes} CARTES  {v.nombre_scelles||0} SCELLÉS
                    </div>
                  </div>
                  <div className="fugaz" style={{ color: "#fff", fontSize: 16 }}>{v.montant} €</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POPIN VENDEUR (DIVISÉE EN DEUX) */}
      {demandeAchat && (
        <div style={overlayStyle}>
          <div style={{ width: "100%", maxWidth: 350, borderRadius: 20, overflow: "hidden", background: "#050514" }}>
            
            {/* Haut Bleu */}
            <div style={{ background: "#1A0DFF", padding: "30px 20px", textAlign: "center" }}>
              <div className="dm" style={{ fontSize: 12, color: "#fff", letterSpacing: 1, marginBottom: 5 }}>ACHETEUR</div>
              <div className="fugaz" style={{ fontSize: 28, color: "#fff" }}>{demandeAchat.acheteur?.pseudo}</div>
            </div>

            {/* Bas Foncé */}
            <div style={{ padding: 30 }}>
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
        </div>
      )}
    </div>
  );
}

function FormulaireVente({ vendorId, acheteurId, scanId, onDone, onCancel }) {
  const [cartes, setCartes] = useState("");
  const [scelles, setScelles] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("enregistrer_vente", {
      p_vendeur_id: vendorId, p_acheteur_id: acheteurId, p_nombre_cartes: parseInt(cartes) || 0,
      p_nombre_scelles: parseInt(scelles) || 0, p_montant: parseFloat(montant) || 0
    });
    
    if (!error) {
      await supabase.from("scans").update({ status: 'accepted' }).eq("id", scanId);
      onDone();
    } else { alert(`Erreur : ${error.message}`); setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
      <input className="dm" type="number" value={cartes} onChange={e => setCartes(e.target.value)} placeholder="Nombre de cartes" style={inputStyle} />
      <input className="dm" type="number" value={scelles} onChange={e => setScelles(e.target.value)} placeholder="Nombre de scellés" style={inputStyle} />
      <input className="dm" type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="Montant en €" style={inputStyle} />
      
      <button onClick={handleConfirm} disabled={loading} className="fugaz" style={{...btnPrimary, marginTop: 10}}>
        {loading ? "..." : "VALIDER"}
      </button>
      <button onClick={onCancel} className="dm" style={{ background: "none", border: "none", color: "#666", textDecoration: "underline", marginTop: 5 }}>Annuler</button>
    </div>
  );
}

// STYLES
const containerStyle = { display: "flex", flexDirection: "column", padding: 30, minHeight: "100dvh", backgroundColor: "#050514", color: "#fff", maxWidth: 500, margin: "0 auto" };
const inputStyle = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", backgroundColor: "#ffffff", color: "#000000", fontSize: 14, outline: "none", marginBottom: 15 };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "none", background: "#F06A2A", color: "#fff", fontSize: 16, cursor: "pointer", width: "100%" };
const statCardDark = { padding: "20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", background: "transparent" };
const activeTabStyle = { background: "transparent", border: "none", borderBottom: "3px solid #fff", color: "#fff", paddingBottom: 5, cursor: "pointer", fontSize: 14 };
const inactiveTabStyle = { background: "transparent", border: "none", borderBottom: "3px solid transparent", color: "#666", paddingBottom: 5, cursor: "pointer", fontSize: 14 };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };