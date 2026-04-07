"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const TAGS_DISPO = ["BASKET", "FOOTBALL", "BASEBALL", "NHL", "POKEMON", "COMICS", "NFL", "TCG"];

const PALIERS = [
  { name: "ROOKIE", min: 0, max: 50 },
  { name: "STAR MONTANTE", min: 51, max: 100 },
  { name: "MVP", min: 101, max: 150 },
  { name: "MAN OF THE MATCH", min: 151, max: 250 },
  { name: "HERO", min: 251, max: 500 },
  { name: "ICONE", min: 501, max: 1000 },
  { name: "GOAT", min: 1001, max: 999999 }
];

export default function AcheteurPage() {
  const [step, setStep] = useState("loading");
  const [pseudo, setPseudo] = useState("");
  const [age, setAge] = useState("");
  const [interets, setInterets] = useState([]);
  const [user, setUser] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("statut");
  const [scanning, setScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [lastPointsGained, setLastPointsGained] = useState(0);
  const html5QrRef = useRef(null);

  const GlobalStyles = () => (
    <style dangerouslySetInnerHTML={{__html: `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap');
      .fugaz { font-family: 'Fugaz One', sans-serif; text-transform: uppercase; font-style: italic; }
      .dm { font-family: 'DM Sans', sans-serif; }
      body { background-color: #01011e; margin: 0; overflow-x: hidden; }
    `}} />
  );

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) { loadUserData(saved); } else { setStep("auth"); }
  }, []);

  const loadUserData = async (name) => {
    const upperName = name.toUpperCase();
    const { data } = await supabase.from("acheteurs").select("*").eq("pseudo", upperName).maybeSingle();
    if (data) {
      setUser(data);
      localStorage.setItem("lcs_pseudo", data.pseudo);
      const { data: v } = await supabase.from("ventes").select("*, vendeurs(numero_table, zone)").eq("acheteur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
    } else {
      localStorage.removeItem("lcs_pseudo");
      setStep("auth");
    }
  };

  const handleAuth = async () => {
    const upperPseudo = pseudo.trim().toUpperCase();
    if (!upperPseudo) return alert("Pseudo requis");
    const { data: existing } = await supabase.from("acheteurs").select("*").eq("pseudo", upperPseudo).maybeSingle();
    if (existing) { 
      loadUserData(upperPseudo); 
    } else {
      if (!age) return alert("Ton âge est requis pour t'inscrire");
      const { data, error } = await supabase.from("acheteurs").insert({ pseudo: upperPseudo, age: parseInt(age), interets, total_points: 0, total_achats: 0 }).select().single();
      if (error) return alert(error.message);
      loadUserData(upperPseudo);
    }
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
              setTimeout(() => { setStep("main"); loadUserData(user.pseudo); }, 3500);
            });
        } else if (payload.new.status === 'rejected') {
          alert("L'exposant a annulé la demande");
          setStep("main");
          setCurrentScanId(null);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentScanId]);

  const toggleTag = (tag) => setInterets(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

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
        setCurrentScanId(s.id);
        setStep("attente");
      }
    }, () => {});
  };

  const getCurrentPalier = (pts) => {
    const palier = PALIERS.find(p => pts >= p.min && pts <= p.max) || PALIERS[0];
    const next = PALIERS[PALIERS.indexOf(palier) + 1];
    return { current: palier.name, next: next ? `${next.name} DANS ${next.min - pts} PTS` : "NIVEAU MAX ATTEINT" };
  };

  if (step === "loading") return <div style={containerStyle}><GlobalStyles/>Chargement...</div>;

  if (step === "merci") return (
    <div className="animate-fade-in" style={{...containerStyle, justifyContent: "center", alignItems: "center", textAlign: "center"}}>
       <GlobalStyles/>
       <div style={verticalText}>VISITEUR</div>
       <h1 className="fugaz" style={{fontSize: 60, margin: 0}}>MERCI</h1>
       <div className="fugaz" style={{fontSize: 24, color: "#F06A2A"}}>+ {lastPointsGained} POINTS</div>
    </div>
  );

  if (step === "auth") return (
    <div style={{...containerStyle, padding: "40px 20px", alignItems: "center"}}>
      <GlobalStyles/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", alignItems: "center" }}>
        <h1 className="fugaz" style={{ textAlign: "center", fontSize: 26, marginBottom: 10 }}>INSCRIPTION VISITEUR</h1>
        <p className="dm" style={{ textAlign: "center", fontSize: 13, color: "#ccc", marginBottom: 40 }}>
          Crée ton profil pour cumuler des points à chaque achat et débloquer des récompenses !
        </p>
        
        <input className="dm" type="text" placeholder="Pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyleCenter} />
        <input className="dm" type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} style={inputStyleCenter} />
        
        <p className="dm" style={{ margin: "15px 0 15px", fontSize: 14, textAlign: "center" }}>Que collectionnes-tu ?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 30, justifyContent: "center" }}>
          {TAGS_DISPO.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)} className="fugaz" style={{
              padding: "8px 16px", borderRadius: 50, transition: "0.2s",
              background: interets.includes(tag) ? "#F06A2A" : "rgba(255,255,255,0.1)", 
              color: "#fff", border: "none", cursor: "pointer", fontSize: 12
            }}>{tag}</button>
          ))}
        </div>
      </div>
      
      {/* Bouton fixé en bas */}
      <button onClick={handleAuth} className="fugaz" style={{...btnPrimary, marginTop: "auto"}}>CONTINUER</button>
    </div>
  );

  const statusInfo = getCurrentPalier(user?.total_points || 0);
  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;

  return (
    <div style={{ ...containerStyle, paddingBottom: 120 }}>
      <GlobalStyles/>
      <div style={verticalText}>VISITEUR</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="dm" style={logoutBtn}>DECONNEXION</button>

      <div style={{ marginBottom: 20, zIndex: 1, position: "relative" }}>
        <div className="fugaz" style={{ fontSize: 16 }}>BIENVENUE</div>
        <div className="fugaz" style={{ fontSize: 32, color: "#F06A2A" }}>{user?.pseudo}</div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("statut")} style={activeTab === "statut" ? activeTabStyle : inactiveTabStyle}>STATUT</button>
        <button onClick={() => setActiveTab("historique")} style={activeTab === "historique" ? activeTabStyle : inactiveTabStyle}>HISTORIQUE</button>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
      </div>

      {activeTab === "statut" && (
        <div className="animate-fade-in" style={{ zIndex: 1, position: "relative" }}>
          <div style={{ background: "#1A0DFF", borderRadius: 20, padding: "30px 20px", textAlign: "center", marginBottom: 20, position: "relative" }}>
            <div className="dm" style={infoTooltip}>ⓘ 1€ Carte = 1pt / 2€ Scellé = 1pt</div>
            <div className="dm" style={{ fontSize: 12 }}>Level</div>
            <div className="fugaz" style={{ fontSize: 32, margin: "5px 0" }}>{statusInfo.current}</div>
            <div className="dm" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>PROCHAIN STATUT : {statusInfo.next}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_points}</div><div className="dm" style={{fontSize: 12}}>Points</div></div>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_achats}</div><div className="dm" style={{fontSize: 12}}>Achats</div></div>
          </div>
        </div>
      )}

      {activeTab === "historique" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 10, zIndex: 1, position: "relative" }}>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>Aucun achat pour le moment.</p> : (
            ventes.map(v => (
              <div key={v.id} style={historyItem}>
                <div>
                  <div className="dm" style={{ fontWeight: "bold", fontSize: 12, color: "#F06A2A", textTransform: "uppercase" }}>TABLE N°{v.vendeurs?.numero_table} - {v.vendeurs?.zone}</div>
                  <div className="dm" style={{ fontSize: 10, color: "#ccc", marginTop: 4 }}>{v.nombre_cartes} CARTES / {v.nombre_scelles||0} SCELLÉS</div>
                </div>
                <div className="fugaz" style={{ fontSize: 18 }}>{v.points_gagnes} Pts</div>
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

      <button onClick={startScanner} className="fugaz" style={{...btnPrimary, position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 460, zIndex: 10 }}>
        SCANNER UN EXPOSANT
      </button>

      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 className="fugaz" style={{ margin: 0, color: "#000" }}>Scanner Exposant</h3>
              <button onClick={() => { if(html5QrRef.current) html5QrRef.current.stop(); setScanning(false); }} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div id="qr-reader" style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} />
          </div>
        </div>
      )}

      {step === "attente" && (
        <div style={overlayStyle}>
          <div style={{...popupStyle, textAlign: "center"}}>
            <h2 className="fugaz" style={{ margin: "0 0 10px 0", color: "#fff" }}>EN ATTENTE</h2>
            <p className="dm" style={{ color: "#ccc", fontSize: 14 }}>L'exposant valide ton panier...</p>
            <div className="animate-pulse-soft" style={{ fontSize: 40, margin: "20px 0" }}>⏳</div>
            <button onClick={async () => {
              await supabase.from("scans").update({ status: 'rejected' }).eq("id", currentScanId);
              setStep("main");
              setCurrentScanId(null);
            }} className="fugaz" style={{...btnPrimary, background: "rgba(255,255,255,0.1)", border: "none"}}>ANNULER</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#01011e", color: "#fff", padding: "30px 20px", maxWidth: 500, margin: "0 auto", position: "relative", overflowX: "hidden" };
const inputStyleCenter = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15, boxSizing: "border-box", fontSize: 14, textAlign: "center" };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer", fontSize: 16, width: "100%" };
const logoutBtn = { position: "absolute", top: 30, right: 20, background: "none", border: "none", color: "#888", fontSize: 11, fontWeight: "bold", cursor: "pointer", zIndex: 10 };
const verticalText = { position: "absolute", bottom: 100, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontSize: 80, zIndex: 0, pointerEvents: "none", opacity: 0.5 };

const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, zIndex: 1, position: "relative" };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5, cursor: "pointer" };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer" };

const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center", background: "transparent" };
const statVal = { fontSize: 36, color: "#F06A2A", marginBottom: 5 };
const infoTooltip = { position: "absolute", top: 15, right: 15, fontSize: 9, color: "rgba(255,255,255,0.4)" };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent" };

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#01011e", border: "1px solid #1A0DFF", padding: 24, borderRadius: 24, width: "100%", maxWidth: 400, color: "#fff" };