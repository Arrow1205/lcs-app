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

  useEffect(() => {
    const saved = localStorage.getItem("lcs_vendor");
    if (saved) { loadVendorData(JSON.parse(saved).email); } else { setStep("login"); }
  }, []);

  const loadVendorData = async (mail) => {
    const { data } = await supabase.from("vendeurs").select("*").eq("email", mail).maybeSingle();
    if (data) {
      setVendor(data);
      localStorage.setItem("lcs_vendor", JSON.stringify(data));
      const { data: v } = await supabase.from("ventes").select("*, acheteurs(pseudo)").eq("vendeur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
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

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  if (step === "login") return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      <h1 className="fugaz" style={{ textAlign: "center", marginBottom: 30 }}>INSCRIPTION EXPOSANT</h1>
      <input className="dm" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <select className="dm" value={zone} onChange={e => setZone(e.target.value)} style={inputStyle}>
        {["BASKET", "SPORT US", "SOCCER", "TCG"].map(z => <option key={z} value={z}>{z}</option>)}
      </select>
      <input className="dm" type="number" placeholder="N° Table" value={table} onChange={e => setTable(e.target.value)} style={inputStyle} />
      <button onClick={async () => {
         const upper = email.toUpperCase();
         const { data: ex } = await supabase.from("vendeurs").select("*").eq("email", upper).maybeSingle();
         if (ex) loadVendorData(upper);
         else {
           const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
           await supabase.from("vendeurs").insert({ email: upper, zone, numero_table: parseInt(table), qr_code: qr });
           loadVendorData(upper);
         }
      }} className="fugaz" style={btnPrimary}>OUVRIR MA TABLE</button>
    </div>
  );

  return (
    <div style={{ ...containerStyle, paddingBottom: 100 }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      <div style={verticalText}>EXPOSANT</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={logoutBtn}>DECONNEXION</button>

      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1 className="fugaz" style={{ color: "#F06A2A", fontSize: 40, margin: 0 }}>{vendor?.email.split('@')[0]}</h1>
        <div className="fugaz" style={{ display: "inline-block", background: "rgba(255,255,255,0.1)", padding: "5px 15px", borderRadius: 20, fontSize: 10 }}>TABLE N°{vendor?.numero_table} — {vendor?.zone}</div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? activeTabStyle : inactiveTabStyle}>MES CHIFFRES</button>
      </div>

      {activeTab === "qr" ? (
        <div style={{ textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <div style={{ background: "#fff", padding: 30, borderRadius: 30, boxShadow: "0 0 40px #1A0DFF66" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=LCS-APP:${vendor?.qr_code}`} alt="QR" />
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 30 }}>
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.length}</div><div className="dm">Ventes</div></div>
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.reduce((s,v)=>s+Number(v.montant),0)}€</div><div className="dm">CA</div></div>
          </div>
          <h3 className="fugaz" style={{fontSize: 12, color: "#444"}}>HISTORIQUE</h3>
          {ventes.map(v => (
            <div key={v.id} style={historyItem}>
              <div><div className="dm" style={{fontWeight: "bold", fontSize: 11}}>{v.acheteurs?.pseudo}</div><div className="dm" style={{fontSize: 9}}>{v.nombre_cartes}C / {v.nombre_scelles}S</div></div>
              <div className="fugaz">{v.montant}€</div>
            </div>
          ))}
        </div>
      )}

      {demande && (
        <div style={overlayStyle}>
          <div style={{...popupStyle, background: "#050514", border: "1px solid #1A0DFF", padding: 0, overflow: "hidden"}}>
            <div style={{background: "#1A0DFF", padding: 20, textAlign: "center"}}><div className="dm" style={{fontSize: 12, marginBottom: 5}}>ACHETEUR</div><div className="fugaz" style={{fontSize: 24}}>{demande.acheteur.pseudo}</div></div>
            <div style={{padding: 20}}>
               <PanierForm scanId={demande.scanId} vendorId={vendor.id} acheteurId={demande.acheteur.id} onDone={()=>{setDemande(null); loadVendorData(vendor.email);}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanierForm({ scanId, vendorId, acheteurId, onDone }) {
  const [c, setC] = useState(""); const [s, setS] = useState(""); const [mc, setMc] = useState(""); const [ms, setMs] = useState("");
  return (
    <div style={{display: "flex", flexDirection: "column", gap: 10}}>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder="Nb Cartes" value={c} onChange={e=>setC(e.target.value)} style={inputStyle} />
        <input className="dm" type="number" placeholder="€ Cartes" value={mc} onChange={e=>setMc(e.target.value)} style={inputStyle} />
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder="Nb Scellés" value={s} onChange={e=>setS(e.target.value)} style={inputStyle} />
        <input className="dm" type="number" placeholder="€ Scellés" value={ms} onChange={e=>setMs(e.target.value)} style={inputStyle} />
      </div>
      <button onClick={async ()=>{
        await supabase.rpc("enregistrer_vente", { p_vendeur_id: vendorId, p_acheteur_id: acheteurId, p_nombre_cartes: parseInt(c)||0, p_nombre_scelles: parseInt(s)||0, p_montant_cartes: parseFloat(mc)||0, p_montant_scelles: parseFloat(ms)||0 });
        await supabase.from("scans").update({ status: 'accepted' }).eq("id", scanId);
        onDone();
      }} className="fugaz" style={btnPrimary}>VALIDER</button>
    </div>
  );
}

// --- STYLES ---
const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#050514", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: 30, maxWidth: 500, margin: "0 auto" };
const inputStyle = { width: "100%", padding: "16px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15 };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer", width: "100%", fontSize: 16 };
const logoutBtn = { position: "absolute", top: 25, right: 20, background: "none", border: "none", color: "#666", fontSize: 10, fontWeight: "bold", cursor: "pointer", zIndex: 10 };
const verticalText = { position: "fixed", bottom: 60, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontFamily: "Fugaz One", fontSize: 70, zIndex: 0, pointerEvents: "none", opacity: 0.4 };
const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, zIndex: 1 };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5, cursor: "pointer" };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer" };
const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center" };
const statVal = { fontSize: 32, color: "#F06A2A" };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#fff", padding: 20, borderRadius: 24, width: "100%", maxWidth: 400 };