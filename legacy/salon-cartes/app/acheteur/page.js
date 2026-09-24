"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const TAGS_DISPO = ["BASKET", "FOOTBALL", "BASEBALL", "NHL", "POKEMON", "COMICS", "NFL", "TCG"];
const PALIERS = [ { name: "ROOKIE", min: 0, max: 50 }, { name: "STAR MONTANTE", min: 51, max: 100 }, { name: "MVP", min: 101, max: 150 }, { name: "MAN OF THE MATCH", min: 151, max: 250 }, { name: "HERO", min: 251, max: 500 }, { name: "ICONE", min: 501, max: 1000 }, { name: "GOAT", min: 1001, max: 999999 } ];

const translations = {
  FR: {
    loading: "Chargement...", back: "← Retour",
    authTitle: "INSCRIPTION VISITEUR", authDesc: "Crée ton profil pour cumuler des points !",
    pseudo: "Pseudo", email: "Email", pwd: "Mot de passe", age: "Age",
    interests: "Que collectionnes-tu ?", news: "J'accepte de recevoir des news sur les prochains events.",
    btnReg: "CRÉER MON COMPTE",
    vertTxt: "VISITEUR", logout: "DÉCONNEXION", welcome: "BIENVENUE",
    tabStat: "STATUT", tabHist: "HISTORIQUE", tabQR: "QR CODE",
    tooltip: "ⓘ 1€ Carte = 1pt / 2€ Scellé = 1pt", level: "Level", nextLvl: "PROCHAIN STATUT", maxLvl: "NIVEAU MAX ATTEINT",
    in: "DANS", pts: "PTS", points: "Points", achats: "Achats",
    emptyHist: "Aucun achat pour le moment.", table: "TABLE N°", cards: "CARTES", sealed: "SCELLÉS",
    btnScan: "SCANNER UN EXPOSANT",
    scanTitle: "Scanner Exposant",
    waitTitle: "EN ATTENTE", waitDesc: "L'exposant valide ton panier...", btnCancel: "ANNULER",
    merci: "MERCI", errEmpty: "Remplis tous les champs !", errUsed: "Cet email est déjà utilisé. Connecte-toi depuis l'accueil !",
    errCancel: "L'exposant a annulé la demande"
  },
  EN: {
    loading: "Loading...", back: "← Back",
    authTitle: "VISITOR REGISTRATION", authDesc: "Create your profile to earn points!",
    pseudo: "Username", email: "Email", pwd: "Password", age: "Age",
    interests: "What do you collect?", news: "I agree to receive news about future events.",
    btnReg: "CREATE MY ACCOUNT",
    vertTxt: "VISITOR", logout: "LOGOUT", welcome: "WELCOME",
    tabStat: "STATUS", tabHist: "HISTORY", tabQR: "QR CODE",
    tooltip: "ⓘ 1€ Card = 1pt / 2€ Sealed = 1pt", level: "Level", nextLvl: "NEXT STATUS", maxLvl: "MAX LEVEL REACHED",
    in: "IN", pts: "PTS", points: "Points", achats: "Purchases",
    emptyHist: "No purchases yet.", table: "TABLE N°", cards: "CARDS", sealed: "SEALED",
    btnScan: "SCAN AN EXHIBITOR",
    scanTitle: "Scan Exhibitor",
    waitTitle: "WAITING", waitDesc: "The exhibitor is validating your cart...", btnCancel: "CANCEL",
    merci: "THANK YOU", errEmpty: "Fill all fields!", errUsed: "This email is already used. Login from home!",
    errCancel: "The exhibitor cancelled the request"
  }
};

export default function AcheteurPage() {
  const router = useRouter();
  const [step, setStep] = useState("loading");
  const [lang, setLang] = useState("FR");
  
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [age, setAge] = useState("");
  const [interets, setInterets] = useState([]);
  const [newsletter, setNewsletter] = useState(false);

  const [user, setUser] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("statut");
  const [scanning, setScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [lastPointsGained, setLastPointsGained] = useState(0);
  const html5QrRef = useRef(null);

  useEffect(() => {
    const savedLang = localStorage.getItem("lcs_lang");
    if (savedLang) setLang(savedLang);
    const savedMail = localStorage.getItem("lcs_acheteur_mail");
    if (savedMail) { loadUserData(savedMail); } else { setStep("auth"); }
  }, []);

  const t = translations[lang];

  const loadUserData = async (mail) => {
    const upperMail = mail.toUpperCase();
    const { data } = await supabase.from("acheteurs").select("*").eq("email", upperMail).maybeSingle();
    if (data) {
      setUser(data);
      localStorage.setItem("lcs_acheteur_mail", data.email);
      const { data: v } = await supabase.from("ventes").select("*, vendeurs(numero_table, zone)").eq("acheteur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
    } else {
      localStorage.removeItem("lcs_acheteur_mail");
      setStep("auth");
    }
  };

  const handleRegister = async () => {
    if (!pseudo || !email || !pwd || !age) return alert(t.errEmpty);
    const upperMail = email.trim().toUpperCase();
    
    const { data: existing } = await supabase.from("acheteurs").select("*").eq("email", upperMail).maybeSingle();
    if (existing) return alert(t.errUsed);

    const { data, error } = await supabase.from("acheteurs").insert({ 
      pseudo: pseudo.trim().toUpperCase(), email: upperMail, mot_de_passe: pwd, age: parseInt(age), interets, newsletter, total_points: 0, total_achats: 0 
    }).select().single();
    
    if (error) return alert(error.message);
    loadUserData(upperMail);
  };

  useEffect(() => {
    if (!user || !currentScanId) return;
    const channel = supabase.channel('buyer-notif').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scans', filter: `id=eq.${currentScanId}` }, 
      (payload) => {
        if (payload.new.status === 'accepted') {
          supabase.from("ventes").select("points_gagnes").eq("acheteur_id", user.id).order("created_at", { ascending: false }).limit(1).single()
            .then(({data}) => {
              setLastPointsGained(data?.points_gagnes || 0);
              setStep("merci");
              setCurrentScanId(null);
              setTimeout(() => { setStep("main"); loadUserData(user.email); }, 3500);
            });
        } else if (payload.new.status === 'rejected') {
          alert(t.errCancel);
          setStep("main"); setCurrentScanId(null);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentScanId, t]);

  const startScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    html5QrRef.current = scanner;
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const qrCode = txt.replace("LCS-APP:", "");
      const { data: v } = await supabase.from("vendeurs").select("*").eq("qr_code", qrCode).maybeSingle();
      if (v) {
        await scanner.stop();
        setScanning(false);
        const { data: s } = await supabase.from("scans").insert({ vendeur_id: v.id, acheteur_id: user.id, status: 'pending' }).select().single();
        setCurrentScanId(s.id); setStep("attente");
      }
    }, () => {});
  };

  if (step === "loading") return <div style={containerStyle}>{t.loading}</div>;

  if (step === "merci") return (
    <div className="animate-fade-in" style={{...containerStyle, justifyContent: "center", alignItems: "center", textAlign: "center"}}>
       <div style={verticalText}>{t.vertTxt}</div>
       <h1 className="fugaz" style={{fontSize: 60, margin: 0}}>{t.merci}</h1>
       <div className="fugaz" style={{fontSize: 24, color: "#F06A2A"}}>+ {lastPointsGained} {t.points.toUpperCase()}</div>
    </div>
  );

  if (step === "auth") return (
    <div style={{...containerStyle, padding: "40px 20px"}}>
      <button onClick={() => router.push("/")} className="dm" style={backBtn}>{t.back}</button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
        <h1 className="fugaz" style={{ textAlign: "center", fontSize: 26, marginBottom: 10 }}>{t.authTitle}</h1>
        <p className="dm" style={{ textAlign: "center", fontSize: 13, color: "#ccc", marginBottom: 30 }}>{t.authDesc}</p>
        
        <input className="dm" type="text" placeholder={t.pseudo} value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="password" placeholder={t.pwd} value={pwd} onChange={e => setPwd(e.target.value)} style={inputStyleLeft} />
        <input className="dm" type="number" placeholder={t.age} value={age} onChange={e => setAge(e.target.value)} style={inputStyleLeft} />
        
        <p className="dm" style={{ margin: "5px 0 15px", fontSize: 14 }}>{t.interests}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {TAGS_DISPO.map(tag => (
            <button key={tag} onClick={() => setInterets(p => p.includes(tag)?p.filter(x=>x!==tag):[...p,tag])} className="fugaz" style={{
              padding: "8px 16px", borderRadius: 50, background: interets.includes(tag) ? "#F06A2A" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontSize: 12
            }}>{tag}</button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#ccc", cursor: "pointer" }}>
          <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} style={{ width: 18, height: 18 }} />
          {t.news}
        </label>
      </div>
      
      <button onClick={handleRegister} className="fugaz" style={{...btnPrimary, marginTop: "auto"}}>{t.btnReg}</button>
    </div>
  );

  const statusInfo = PALIERS.find(p => (user?.total_points||0) >= p.min && (user?.total_points||0) <= p.max) || PALIERS[0];
  const nextPalier = PALIERS[PALIERS.indexOf(statusInfo) + 1];
  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;

  return (
    <div style={{ ...containerStyle, paddingBottom: 120 }}>
      <div style={verticalText}>{t.vertTxt}</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="dm" style={logoutBtn}>{t.logout}</button>

      <div style={{ marginBottom: 20, zIndex: 1, position: "relative" }}>
        <div className="fugaz" style={{ fontSize: 16 }}>{t.welcome}</div>
        <div className="fugaz" style={{ fontSize: 32, color: "#F06A2A" }}>{user?.pseudo}</div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("statut")} style={activeTab === "statut" ? activeTabStyle : inactiveTabStyle}>{t.tabStat}</button>
        <button onClick={() => setActiveTab("historique")} style={activeTab === "historique" ? activeTabStyle : inactiveTabStyle}>{t.tabHist}</button>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>{t.tabQR}</button>
      </div>

      {activeTab === "statut" && (
        <div className="animate-fade-in" style={{ zIndex: 1, position: "relative" }}>
          <div style={{ background: "#1A0DFF", borderRadius: 20, padding: "30px 20px", textAlign: "center", marginBottom: 20, position: "relative" }}>
            <div className="dm" style={infoTooltip}>{t.tooltip}</div>
            <div className="dm" style={{ fontSize: 12 }}>{t.level}</div>
            <div className="fugaz" style={{ fontSize: 32, margin: "5px 0" }}>{statusInfo.name}</div>
            <div className="dm" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t.nextLvl} : {nextPalier ? `${nextPalier.name} ${t.in} ${nextPalier.min - user.total_points} ${t.pts}` : t.maxLvl}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_points}</div><div className="dm" style={{fontSize: 12}}>{t.points}</div></div>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_achats}</div><div className="dm" style={{fontSize: 12}}>{t.achats}</div></div>
          </div>
        </div>
      )}

      {activeTab === "historique" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 10, zIndex: 1, position: "relative" }}>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>{t.emptyHist}</p> : (
            ventes.map(v => (
              <div key={v.id} style={historyItem}>
                <div>
                  <div className="dm" style={{ fontWeight: "bold", fontSize: 12, color: "#F06A2A" }}>{t.table}{v.vendeurs?.numero_table} - {v.vendeurs?.zone}</div>
                  <div className="dm" style={{ fontSize: 10, color: "#ccc", marginTop: 4 }}>{v.nombre_cartes} {t.cards} / {v.nombre_scelles||0} {t.sealed}</div>
                </div>
                <div className="fugaz" style={{ fontSize: 18 }}>{v.points_gagnes} {t.pts}</div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "qr" && (
        <div className="animate-fade-in" style={{ textAlign: "center", padding: 20, zIndex: 1, position: "relative" }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 20, display: "inline-block" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(myQrUrl)}`} alt="QR" />
          </div>
        </div>
      )}

      <button onClick={startScanner} className="fugaz" style={{...btnPrimary, position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 460, zIndex: 10 }}>{t.btnScan}</button>

      {scanning && <div style={overlayStyle}><div style={popupStyle}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}><h3 className="fugaz" style={{ margin: 0, color: "#000" }}>{t.scanTitle}</h3><button onClick={() => { if(html5QrRef.current) html5QrRef.current.stop(); setScanning(false); }} style={{ background: "none", border: "none", color: "#000", fontSize: 20 }}>✕</button></div><div id="qr-reader" style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} /></div></div>}
      {step === "attente" && <div style={overlayStyle}><div style={{...popupStyle, background: "#01011e", border: "1px solid #1A0DFF", textAlign: "center"}}><h2 className="fugaz" style={{ margin: "0 0 10px 0", color: "#fff" }}>{t.waitTitle}</h2><p className="dm" style={{ color: "#ccc", fontSize: 14 }}>{t.waitDesc}</p><div className="animate-pulse-soft" style={{ fontSize: 40, margin: "20px 0" }}>⏳</div><button onClick={async () => { await supabase.from("scans").update({ status: 'rejected' }).eq("id", currentScanId); setStep("main"); setCurrentScanId(null); }} className="fugaz" style={{...btnPrimary, background: "rgba(255,255,255,0.1)", border: "none"}}>{t.btnCancel}</button></div></div>}
    </div>
  );
}

const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#01011e", color: "#fff", padding: "30px 20px", maxWidth: 500, margin: "0 auto", position: "relative", overflowX: "hidden" };
const inputStyleLeft = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15, boxSizing: "border-box", fontSize: 14, textAlign: "left" };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer", fontSize: 16, width: "100%" };
const logoutBtn = { position: "absolute", top: 30, right: 20, background: "none", border: "none", color: "#888", fontSize: 11, fontWeight: "bold", cursor: "pointer", zIndex: 10 };
const backBtn = { position: "absolute", top: 30, left: 20, background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", zIndex: 10 };
const verticalText = { position: "absolute", bottom: 100, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontSize: 80, zIndex: 0, pointerEvents: "none", opacity: 0.5 };

const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, zIndex: 1, position: "relative" };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5, cursor: "pointer" };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer" };

const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center", background: "transparent" };
const statVal = { fontSize: 36, color: "#F06A2A", marginBottom: 5 };
const infoTooltip = { position: "absolute", top: 15, right: 15, fontSize: 9, color: "rgba(255,255,255,0.4)" };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent" };

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#fff", padding: 24, borderRadius: 24, width: "100%", maxWidth: 400, color: "#000" };