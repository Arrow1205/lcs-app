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
  { name: "GOAT", min: 1001, max: 99999 }
];

export default function AcheteurPage() {
  const [step, setStep] = useState("loading"); // loading | auth | main | merci
  const [pseudo, setPseudo] = useState("");
  const [age, setAge] = useState("");
  const [interets, setInterets] = useState([]);
  const [user, setUser] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("statut");
  const [scanning, setScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [lastPointsGained, setLastPointsGained] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) { loadUserData(saved); } else { setStep("auth"); }
  }, []);

  const loadUserData = async (name) => {
    const { data } = await supabase.from("acheteurs").select("*").eq("pseudo", name.toUpperCase()).maybeSingle();
    if (data) {
      setUser(data);
      localStorage.setItem("lcs_pseudo", data.pseudo);
      const { data: v } = await supabase.from("ventes").select("*, vendeurs(numero_table, zone)").eq("acheteur_id", data.id).order("created_at", { ascending: false });
      setVentes(v || []);
      setStep("main");
    }
  };

  const handleAuth = async () => {
    const upperPseudo = pseudo.trim().toUpperCase();
    if (!upperPseudo) return alert("Pseudo requis");
    const { data: existing } = await supabase.from("acheteurs").select("*").eq("pseudo", upperPseudo).maybeSingle();
    if (existing) { loadUserData(upperPseudo); } else {
      if (!age) return alert("Âge requis pour l'inscription");
      const { data, error } = await supabase.from("acheteurs").insert({ pseudo: upperPseudo, age: parseInt(age), interets, total_points: 0, total_achats: 0 }).select().single();
      if (error) return alert(error.message);
      loadUserData(upperPseudo);
    }
  };

  // Ecoute du "MERCI" en temps réel
  useEffect(() => {
    if (!user || !currentScanId) return;
    const channel = supabase.channel('buyer-notif').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scans', filter: `id=eq.${currentScanId}` }, 
      (payload) => {
        if (payload.new.status === 'accepted') {
          // On récupère le montant de la dernière vente pour l'affichage
          supabase.from("ventes").select("points_gagnes").eq("acheteur_id", user.id).order("created_at", { ascending: false }).limit(1).single()
            .then(({data}) => {
              setLastPointsGained(data?.points_gagnes || 0);
              setStep("merci");
              setCurrentScanId(null);
              setTimeout(() => { setStep("main"); loadUserData(user.pseudo); }, 4000);
            });
        } else if (payload.new.status === 'rejected') {
          alert("Demande annulée");
          setStep("main");
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentScanId]);

  const startScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
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
    return { current: palier.name, next: next ? `${next.name} dans ${next.min - pts} pts` : "MAX LEVEL REACHED" };
  };

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  if (step === "merci") return (
    <div style={{...containerStyle, justifyContent: "center", textAlign: "center"}}>
       <h1 className="fugaz" style={{fontSize: 60}}>MERCI</h1>
       <div className="fugaz" style={{fontSize: 24, color: "#F06A2A"}}>+ {lastPointsGained} POINTS</div>
    </div>
  );

  if (step === "auth") return (
    <div style={containerStyle}>
      <h1 className="fugaz" style={{ textAlign: "center", fontSize: 26, marginBottom: 20 }}>INSCRIPTION VISITEUR</h1>
      <input className="dm" type="text" placeholder="Pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle} />
      <input className="dm" type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 30 }}>
        {TAGS_DISPO.map(tag => (
          <button key={tag} onClick={() => setInterets(prev => prev.includes(tag)?prev.filter(t=>t!==tag):[...prev,tag])} className="fugaz" style={{
            padding: "8px 16px", borderRadius: 50, background: interets.includes(tag) ? "#F06A2A" : "rgba(255,255,255,0.1)", color: "#fff", border: "none"
          }}>{tag}</button>
        ))}
      </div>
      <button onClick={handleAuth} className="fugaz" style={btnPrimary}>CONTINUER</button>
    </div>
  );

  const statusInfo = getCurrentPalier(user?.total_points || 0);

  return (
    <div style={{ ...containerStyle, padding: "30px 20px" }}>
      <div style={verticalText}>VISITEUR</div>
      <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={logoutBtn}>DECONNEXION</button>

      <div style={{ marginBottom: 20 }}>
        <div className="fugaz" style={{ fontSize: 16 }}>BIENVENUE</div>
        <div className="fugaz" style={{ fontSize: 32, color: "#F06A2A" }}>{user?.pseudo}</div>
      </div>

      <div className="fugaz" style={tabsCenter}>
        <button onClick={() => setActiveTab("statut")} style={activeTab === "statut" ? activeTabStyle : inactiveTabStyle}>STATUT</button>
        <button onClick={() => setActiveTab("historique")} style={activeTab === "historique" ? activeTabStyle : inactiveTabStyle}>HISTORIQUE</button>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
      </div>

      {activeTab === "statut" && (
        <>
          <div style={{ background: "#1A0DFF", borderRadius: 20, padding: "30px 20px", textAlign: "center", marginBottom: 20, position: "relative" }}>
            <div style={infoTooltip}>ⓘ 1€ Carte = 1pt / 2€ Scellé = 1pt</div>
            <div className="dm" style={{ fontSize: 12 }}>Level</div>
            <div className="fugaz" style={{ fontSize: 36 }}>{statusInfo.current}</div>
            <div className="dm" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>PROCHAIN STATUT : {statusInfo.next}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_points}</div><div className="dm">Points</div></div>
            <div style={statBox}><div className="fugaz" style={statVal}>{user?.total_achats}</div><div className="dm">Achats</div></div>
          </div>
        </>
      )}

      {activeTab === "historique" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ventes.map(v => (
            <div key={v.id} style={historyItem}>
              <div>
                <div className="dm" style={{ fontWeight: "bold", fontSize: 11, color: "#F06A2A" }}>TABLE N°{v.vendeurs?.numero_table}</div>
                <div className="dm" style={{ fontSize: 10, color: "#ccc" }}>{v.nombre_cartes} CARTES / {v.nombre_scelles} SCELLÉS</div>
              </div>
              <div className="fugaz" style={{ fontSize: 18 }}>{v.points_gagnes} Pts</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "qr" && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 20, display: "inline-block" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(myQrUrl)}`} alt="QR" />
          </div>
        </div>
      )}

      <button onClick={startScanner} className="fugaz" style={{...btnPrimary, position: "fixed", bottom: 30, left: 20, right: 20, width: "calc(100% - 40px)"}}>SCANNER UN EXPOSANT</button>

      {scanning && <div style={overlayStyle}><div style={popupStyle}><div id="qr-reader" style={{ width: "100%" }} /></div></div>}
      {step === "attente" && <div style={overlayStyle}><div style={{...popupStyle, background: "#050514", border: "1px solid #1A0DFF", textAlign: "center"}}><h2 className="fugaz">EN ATTENTE</h2><p>Le vendeur valide votre panier...</p></div></div>}
    </div>
  );
}

// Styles
const containerStyle = { display: "flex", flexDirection: "column", minHeight: "100dvh", backgroundColor: "#050514", color: "#fff", fontFamily: "'DM Sans', sans-serif" };
const inputStyle = { width: "100%", padding: "16px", borderRadius: 50, border: "none", background: "#fff", color: "#000", marginBottom: 15 };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "2px solid #fff", background: "#F06A2A", color: "#fff", cursor: "pointer" };
const logoutBtn = { position: "absolute", top: 25, right: 20, background: "none", border: "none", color: "#666", fontSize: 10, fontWeight: "bold" };
const verticalText = { position: "fixed", bottom: 60, right: -40, transform: "rotate(-90deg)", color: "transparent", WebkitTextStroke: "1px #191457", fontFamily: "Fugaz One", fontSize: 70, zIndex: 0, pointerEvents: "none", opacity: 0.4 };
const tabsCenter = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30 };
const activeTabStyle = { background: "none", border: "none", color: "#fff", fontSize: 14, borderBottom: "3px solid #F06A2A", paddingBottom: 5 };
const inactiveTabStyle = { background: "none", border: "none", color: "#444", fontSize: 14 };
const statBox = { border: "1px solid rgba(255,255,255,0.1)", borderRadius: 15, padding: 20, textAlign: "center" };
const statVal = { fontSize: 32, color: "#F06A2A" };
const infoTooltip = { position: "absolute", top: 10, right: 15, fontSize: 8, color: "rgba(255,255,255,0.4)" };
const historyItem = { padding: 15, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 99 };
const popupStyle = { background: "#fff", padding: 20, borderRadius: 24, width: "100%", maxWidth: 400 };