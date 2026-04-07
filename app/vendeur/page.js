"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const translations = {
  FR: {
    loading: "Chargement...", back: "← Retour",
    authTitle: "INSCRIPTION EXPOSANT",
    nom: "Nom de l'exposant", email: "Email", pwd: "Mot de passe",
    tableBtn: "Choisir un Numéro de Table", tableNum: "Table N°", gridTitle: "GRILLE DES TABLES",
    news: "J'accepte de recevoir des news sur les prochains events.",
    btnReg: "OUVRIR MA TABLE",
    vertTxt: "EXPOSANT", logout: "DÉCONNEXION",
    tabQR: "QR CODE", tabStats: "MES CHIFFRES",
    sales: "Ventes", revenue: "CA",
    historyTitle: "HISTORIQUE", emptyHist: "Aucune vente enregistrée.",
    c: "C", s: "S", // C pour Cartes, S pour Scellés en format court
    buyer: "ACHETEUR",
    nbC: "Nb Cartes", eurC: "€ Cartes", nbS: "Nb Scellés", eurS: "€ Scellés",
    btnValider: "VALIDER", btnCancel: "Annuler",
    errEmpty: "Remplis tous les champs !", errUsed: "Cet email est déjà utilisé. Connecte-toi depuis l'accueil !"
  },
  EN: {
    loading: "Loading...", back: "← Back",
    authTitle: "EXHIBITOR REGISTRATION",
    nom: "Exhibitor Name", email: "Email", pwd: "Password",
    tableBtn: "Choose a Table Number", tableNum: "Table N°", gridTitle: "TABLE GRID",
    news: "I agree to receive news about future events.",
    btnReg: "OPEN MY TABLE",
    vertTxt: "EXHIBITOR", logout: "LOGOUT",
    tabQR: "QR CODE", tabStats: "MY STATS",
    sales: "Sales", revenue: "Rev",
    historyTitle: "HISTORY", emptyHist: "No sales recorded.",
    c: "C", s: "S",
    buyer: "BUYER",
    nbC: "Qty Cards", eurC: "$ Cards", nbS: "Qty Sealed", eurS: "$ Sealed",
    btnValider: "CONFIRM", btnCancel: "Cancel",
    errEmpty: "Fill all fields!", errUsed: "This email is already used. Login from home!"
  }
};

export default function VendeurPage() {
  const router = useRouter();
  const [step, setStep] = useState("loading");
  const [lang, setLang] = useState("FR");
  
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [zone, setZone] = useState("BASKET");
  const [table, setTable] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const [vendor, setVendor] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("qr");
  const [demande, setDemande] = useState(null);

  useEffect(() => {
    const savedLang = localStorage.getItem("lcs_lang");
    if (savedLang) setLang(savedLang);
    const savedMail = localStorage.getItem("lcs_vendor_mail");
    if (savedMail) { loadVendorData(savedMail); } else { setStep("login"); }
  }, []);

  const t = translations[lang];

  const loadVendorData = async (mail) => {
    const upperMail = mail.toUpperCase();
    const { data } = await supabase.from("vendeurs").select("*").eq("email", upperMail).maybeSingle();
    if (data) {
      setVendor(data);
      localStorage.setItem("lcs_vendor_mail", data.email);
      const { data: v } = await supabase.from("ventes").select("*, acheteurs(pseudo)").eq("vendeur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
    } else {
      localStorage.removeItem("lcs_vendor_mail");
      setStep("login");
    }
  };

  const handleRegister = async () => {
    if(!nom || !email || !pwd || !table) return alert(t.errEmpty);
    const upperMail = email.trim().toUpperCase();
    
    const { data: ex } = await supabase.from("vendeurs").select("*").eq("email", upperMail).maybeSingle();
    if (ex) return alert(t.errUsed);

    const qr = `VND-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const { error } = await supabase.from("vendeurs").insert({ 
      nom: nom.trim().toUpperCase(), email: upperMail, mot_de_passe: pwd, zone, numero_table: parseInt(table), qr_code: qr, newsletter 
    });
    
    if (error) return alert(error.message);
    loadVendorData(upperMail);
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

  if (step === "loading") return <div style={containerStyle}>{t.loading}</div>;

  if (step === "login") return (
    <div style={{...containerStyle, padding: "40px 20px"}}>
      <button onClick={() => router.push("/")} className="dm" style={backBtn}>{t.back}</button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
        <h1 className="fugaz" style={{ textAlign: "center", marginBottom: 30, fontSize: 26 }}>{t.authTitle}</h1>
        
        <input className="dm" type="text" placeholder={t.nom} value={nom} onChange={e => setNom(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="password" placeholder={t.pwd} value={pwd} onChange={e => setPwd(e.target.value)} style={inputStyleLeft} />
        
        <select className="dm" value={zone} onChange={e => setZone(e.target.value)} style={inputStyleLeft}>
          {["BASKET", "SPORT US", "SOCCER", "TCG", "FOOTBALL", "BASEBALL", "NHL", "POKEMON", "COMICS", "NFL"].map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        
        <button onClick={() => setShowGrid(true)} className="dm" style={{...inputStyleLeft, textAlign: "left", cursor: "pointer", color: table ? "#000" : "#666"}}>
          {table ? `${t.tableNum} ${table}` : t.tableBtn}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#ccc", cursor: "pointer", marginTop: 10 }}>
          <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} style={{ width: 18, height: 18 }} />
          {t.news}
        </label>
      </div>

      <button onClick={handleRegister} className="fugaz" style={{...btnPrimary, marginTop: "auto"}}>{t.btnReg}</button>

      {/* MODAL GRILLE NUMÉROTATION */}
      {showGrid && (
        <div style={{...overlayStyle, alignItems: "flex-end", padding: 0}}>
          <div style={{ background: "#01011e", width: "100%", height: "70vh", borderTopLeftRadius: 24, borderTopRightRadius: 24, display: "flex", flexDirection: "column", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 className="fugaz" style={{margin: 0}}>{t.gridTitle}</h3>
              <button onClick={() => setShowGrid(false)} style={{background:"none", border:"none", color:"#fff", fontSize: 20}}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, paddingBottom: 20 }}>
              {Array.from({length: 99}, (_, i) => i + 1).map(num => (
                <button key={num} onClick={() => { setTable(num); setShowGrid(false); }} className="dm" style={{
                  padding: "15px 0", borderRadius: 12, background: table === num ? "#F06A2A" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontSize: 16, fontWeight: "bold"
                }}>{num.toString().padStart(2, '0')}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ ...containerStyle, paddingBottom: 100 }}>
      <div style={verticalText}>{t.vertTxt}</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="dm" style={logoutBtn}>{t.logout}</button>

      <div style={{ padding: "40px 20px", textAlign: "center", zIndex: 1, position: "relative" }}>
        <h1 className="fugaz" style={{ color: "#F06A2A", fontSize: 40, margin: 0 }}>{vendor?.nom || vendor?.email.split('@')[0]}</h1>
        <div className="fugaz" style={{ display: "inline-block", background: "rgba(255,255,255,0.1)", padding: "5px 15px", borderRadius: 20, fontSize: 10, marginTop: 10 }}>
          {t.tableNum}{vendor?.numero_table} — {vendor?.zone}
        </div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>{t.tabQR}</button>
        <button onClick={() => setActiveTab("chiffres")} style={activeTab === "chiffres" ? activeTabStyle : inactiveTabStyle}>{t.tabStats}</button>
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
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.length}</div><div className="dm" style={{fontSize: 12}}>{t.sales}</div></div>
             <div style={statBox}><div className="fugaz" style={statVal}>{ventes.reduce((s,v)=>s+Number(v.montant),0)}€</div><div className="dm" style={{fontSize: 12}}>{t.revenue}</div></div>
          </div>
          <h3 className="fugaz" style={{fontSize: 12, color: "#fff", marginBottom: 15}}>{t.historyTitle}</h3>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>{t.emptyHist}</p> : (
            ventes.map(v => (
              <div key={v.id} style={historyItem}>
                <div>
                  <div className="dm" style={{fontWeight: "bold", fontSize: 12, color: "#1A0DFF"}}>{v.acheteurs?.pseudo}</div>
                  <div className="dm" style={{fontSize: 10, color: "#ccc", marginTop: 4}}>{v.nombre_cartes}{t.c} / {v.nombre_scelles||0}{t.s}</div>
                </div>
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
              <div className="dm" style={{fontSize: 12, marginBottom: 5, color: "#fff"}}>{t.buyer}</div>
              <div className="fugaz" style={{fontSize: 28, color: "#fff"}}>{demande.acheteur.pseudo}</div>
            </div>
            <div style={{padding: 25}}>
               <PanierForm t={t} scanId={demande.scanId} vendorId={vendor.id} acheteurId={demande.acheteur.id} onDone={()=>{setDemande(null); loadVendorData(vendor.email);}} onCancel={async () => {
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

function PanierForm({ t, scanId, vendorId, acheteurId, onDone, onCancel }) {
  const [c, setC] = useState(""); const [s, setS] = useState(""); const [mc, setMc] = useState(""); const [ms, setMs] = useState("");
  return (
    <div style={{display: "flex", flexDirection: "column", gap: 15}}>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder={t.nbC} value={c} onChange={e=>setC(e.target.value)} style={inputStylePanier} />
        <input className="dm" type="number" placeholder={t.eurC} value={mc} onChange={e=>setMc(e.target.value)} style={inputStylePanier} />
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
        <input className="dm" type="number" placeholder={t.nbS} value={s} onChange={e=>setS(e.target.value)} style={inputStylePanier} />
        <input className="dm" type="number" placeholder={t.eurS} value={ms} onChange={e=>setMs(e.target.value)} style={inputStylePanier} />
      </div>
      <button onClick={async ()=>{
        await supabase.rpc("enregistrer_vente", { p_vendeur_id: vendorId, p_acheteur_id: acheteurId, p_nombre_cartes: parseInt(c)||0, p_nombre_scelles: parseInt(s)||0, p_montant_cartes: parseFloat(mc)||0, p_montant_scelles: parseFloat(ms)||0 });
        await supabase.from("scans").update({ status: 'accepted' }).eq("id", scanId);
        onDone();
      }} className="fugaz" style={{...btnPrimary, marginTop: 10}}>{t.btnValider}</button>
      <button onClick={onCancel} className="dm" style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", cursor: "pointer", padding: 10 }}>{t.btnCancel}</button>
    </div>
  );
}

const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#01011e", color: "#fff", padding: "30px 20px", maxWidth: 500, margin: "0 auto", position: "relative", overflowX: "hidden" };
const inputStyleLeft = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15, boxSizing: "border-box", fontSize: 14, textAlign: "left" };
const inputStylePanier = { width: "100%", padding: "14px", borderRadius: 50, border: "none", background: "#fff", color: "#000", boxSizing: "border-box", fontSize: 13, textAlign: "center" };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer", width: "100%", fontSize: 16 };
const logoutBtn = { position: "absolute", top: 30, right: 20, background: "none", border: "none", color: "#888", fontSize: 11, fontWeight: "bold", cursor: "pointer", zIndex: 10 };
const backBtn = { position: "absolute", top: 30, left: 20, background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", zIndex: 10 };
const verticalText = { position: "absolute", bottom: 100, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontSize: 80, zIndex: 0, pointerEvents: "none", opacity: 0.5 };

const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, zIndex: 1, position: "relative" };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5, cursor: "pointer" };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer" };

const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center", background: "transparent" };
const statVal = { fontSize: 36, color: "#F06A2A", marginBottom: 5 };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, background: "transparent" };

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#01011e", border: "1px solid #1A0DFF", borderRadius: 24, width: "100%", maxWidth: 400, color: "#fff" };