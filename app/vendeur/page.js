"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function VendeurPage() {
  const [step, setStep] = useState("loading");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState("");
  const [zone, setZone] = useState("BASKET");
  const [vendor, setVendor] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("qr");
  const [demande, setDemande] = useState(null);

  const GlobalStyles = () => (
    <style dangerouslySetInnerHTML={{__html: `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap');
      .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; }
      .dm { font-family: 'DM Sans', sans-serif; }
      body { background-color: #01011e; margin: 0; overflow-x: hidden; }
    `}} />
  );

  useEffect(() => {
    const saved = localStorage.getItem("lcs_vendor");
    if (saved) { loadVendorData(JSON.parse(saved).email); } else { setStep("login"); }
  }, []);

  const loadVendorData = async (mail) => {
    const upperMail = mail.toUpperCase();
    const { data } = await supabase.from("vendeurs").select("*").eq("email", upperMail).maybeSingle();
    if (data) {
      setVendor(data);
      localStorage.setItem("lcs_vendor", JSON.stringify(data));
      const { data: v } = await supabase.from("ventes").select("*, acheteurs(pseudo)").eq("vendeur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
    } else {
      localStorage.removeItem("lcs_vendor");
      setStep("login");
    }
  };

  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel('v-requests').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans', filter: `vendeur_id=eq.${vendor.id}` }, 
      async (p) => {
        const { data: a } = await supabase.from("acheteurs").select("*").eq("id", p.new.acheteur_id).single();
        setDemande({ scanId: p.new.id, acheteur: a });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  if (step === "loading") return <div style={containerStyle}><GlobalStyles/>Chargement...</div>;

  if (step === "login") return (
    <div style={{...containerStyle, padding: "40px 20px", alignItems: "center"}}>
      <GlobalStyles/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", alignItems: "center" }}>
        <h1 className="fugaz" style={{ textAlign: "center", marginBottom: 40, fontSize: 26 }}>INSCRIPTION EXPOSANT</h1>
        
        <input className="dm" type="text" placeholder="Pseudo / Nom" value={email} onChange={e => setEmail(e.target.value)} style={inputStyleCenter} />
        
        <select className="dm" value={zone} onChange={e => setZone(e.target.value)} style={{...inputStyleCenter, textAlignLast: "center"}}>
          {["BASKET", "SPORT US", "SOCCER", "TCG", "FOOTBALL", "BASEBALL", "NHL", "POKEMON", "COMICS", "NFL"].map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        
        <input className="dm" type="number" placeholder="N° Table" value={table} onChange={e => setTable(e.target.value)} style={inputStyleCenter} />
      </div>

      <button onClick={async () => {
         const upper = email.trim().toUpperCase();
         if(!upper || !table) return alert("Nom et N° Table requis !");
         const { data: ex } = await supabase.from("vendeurs").select("*").eq("email", upper).maybeSingle();
         if (ex) loadVendorData(upper);
         else {
           const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
           await supabase.from("vendeurs").insert({ email: upper, zone, numero_table: parseInt(table), qr_code: qr });
           loadVendorData(upper);
         }
      }} className="fugaz" style={{...btnPrimary, marginTop: "auto"}}>OUVRIR MA TABLE</button>
    </div>
  );

  return (
    <div style={{ ...containerStyle, paddingBottom: 100 }}>
      <GlobalStyles/>
      
      <div style={verticalText}>EXPOSANT</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="dm" style={logoutBtn}>DECONNEXION</button>

      <div style={{ padding: "40px 20px", textAlign: "center", zIndex: 1, position: "relative" }}>
        <h1 className="fugaz" style={{ color: "#F06A2A", fontSize: 40, margin: 0 }}>{vendor?.email.split('@')[0]}</h1>
        <div className="fugaz" style={{ display: "inline-block", background: "rgba(255,255,255,0.1)", padding: "5px 15px", borderRadius: 20, fontSize: 10, marginTop: 10 }}>
          TABLE N°{vendor?.numero_table} — {vendor?.zone}
        </div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? activeTabStyle : inactiveTabStyle}>MES CHIFFRES</button>
      </div>

      {activeTab === "qr" ? (
        <div className="animate-fade-in" style={{ textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, position: "relative" }}>
          <div style={{ background: "#fff", padding: 30, borderRadius: 30, boxShadow: "0 0 40px #1A0DFF66", display: "inline-block" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=LCS-APP:${vendor?.qr_code}`} alt="QR" style={{width: 200, height: 200}} />
          </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ zIndex: 1, position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 30 }}>
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.length}</div><div className="dm" style={{fontSize: 12}}>Ventes</div></div>
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.reduce((s,v)=>s+Number(v.montant),0)}€</div><div className="dm" style={{fontSize: 12}}>CA</div></div>
          </div>
          <h3 className="fugaz" style={{fontSize: 12, color: "#fff", marginBottom: 15}}>HISTORIQUE</h3>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>Aucune vente enregistrée.</p> : (
            ventes.map(v => (
              <div key={v.id} style={historyItem}>
                <div><div className="dm" style={{fontWeight: "bold", fontSize: 12, color: "#1A0DFF"}}>{v.acheteurs?.pseudo}</div><div className="dm" style={{fontSize: 10, color: "#ccc", marginTop: 4}}>{v.nombre_cartes} CARTES / {v.nombre_scelles||0} SCELLÉS</div></div>
                <div className="fugaz" style={{fontSize: 18}}>{v.montant}€</div>
              </div>
            ))
          )}
        </div>
      )}

      {demande && (
        <div style={overlayStyle}>
          <div style={{...popupStyle, padding: 0, overflow: "hidden"}}>
            <div style={{background: "#1A0DFF", padding: 20, textAlign: "center"}}>
              <div className="dm" style={{fontSize: 12, marginBottom: 5, color: "#fff"}}>ACHETEUR</div>
              <div className="fugaz" style={{fontSize: 28, color: "#fff"}}>{demande.acheteur.pseudo}</div>
            </div>
            <div style={{padding: 25}}>
               <PanierForm scanId={demande.scanId} vendorId={vendor.id} acheteurId={demande.acheteur.id} onDone={()=>{setDemande(null); loadVendorData(vendor.email);}} onCancel={async () => {
                 await supabase.from("scans").update({ status: 'rejected' }).eq("id", demande.scanId);
                 setDemande(null);
               }}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanierForm({ scanId, vendorId, acheteurId, onDone, onCancel }) {
  const [c, setC] = useState(""); const [s, setS] = useState(""); const [mc, setMc] = useState(""); const [ms, setMs] = useState("");
  return (
    <div style={{display: "flex", flexDirection: "column", gap: 15}}>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder="Nb Cartes" value={c} onChange={e=>setC(e.target.value)} style={inputStylePanier} />
        <input className="dm" type="number" placeholder="€ Cartes" value={mc} onChange={e=>setMc(e.target.value)} style={inputStylePanier} />
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder="Nb Scellés" value={s} onChange={e=>setS(e.target.value)} style={inputStylePanier} />
        <input className="dm" type="number" placeholder="€ Scellés" value={ms} onChange={e=>setMs(e.target.value)} style={inputStylePanier} />
      </div>
      <button onClick={async ()=>{
        await supabase.rpc("enregistrer_vente", { p_vendeur_id: vendorId, p_acheteur_id: acheteurId, p_nombre_cartes: parseInt(c)||0, p_nombre_scelles: parseInt(s)||0, p_montant_cartes: parseFloat(mc)||0, p_montant_scelles: parseFloat(ms)||0 });
        await supabase.from("scans").update({ status: 'accepted' }).eq("id", scanId);
        onDone();
      }} className="fugaz" style={{...btnPrimary, marginTop: 10}}>VALIDER</button>
      <button onClick={onCancel} className="dm" style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", cursor: "pointer", padding: 10 }}>Annuler</button>
    </div>
  );
}

// --- STYLES COMPLETS ---
const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#01011e", color: "#fff", padding: "30px 20px", maxWidth: 500, margin: "0 auto", position: "relative", overflowX: "hidden" };
const inputStyleCenter = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15, boxSizing: "border-box", fontSize: 14, textAlign: "center" };
const inputStylePanier = { width: "100%", padding: "14px", borderRadius: 50, border: "none", background: "#fff", color: "#000", boxSizing: "border-box", fontSize: 13, textAlign: "center" };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer", width: "100%", fontSize: 16 };
const logoutBtn = { position: "absolute", top: 30, right: 20, background: "none", border: "none", color: "#888", fontSize: 11, fontWeight: "bold", cursor: "pointer", zIndex: 10 };
const verticalText = { position: "absolute", bottom: 100, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontSize: 80, zIndex: 0, pointerEvents: "none", opacity: 0.5 };

const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, zIndex: 1, position: "relative" };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5, cursor: "pointer" };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer" };

const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center", background: "transparent" };
const statVal = { fontSize: 36, color: "#F06A2A", marginBottom: 5 };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, background: "transparent" };

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#01011e", border: "1px solid #1A0DFF", borderRadius: 24, width: "100%", maxWidth: 400, color: "#fff" };