"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const TAGS_DISPO = ["BASKET", "FOOTBALL", "BASEBALL", "NHL", "POKEMON", "COMICS", "NFL", "TCG"];

export default function AcheteurPage() {
  const [step, setStep] = useState("loading");
  
  // Formulaire
  const [pseudo, setPseudo] = useState("");
  const [age, setAge] = useState("");
  const [interets, setInterets] = useState([]);
  
  const [user, setUser] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("statut"); // "statut" | "historique" | "qr"
  
  const [scanning, setScanning] = useState(false);
  const [attenteValidation, setAttenteValidation] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) { loadUserData(saved); } else { setStep("auth"); }
  }, []);

  const loadUserData = async (loginName) => {
    const { data: userData } = await supabase.from("acheteurs").select("*").eq("pseudo", loginName).maybeSingle();
    if (userData) {
      setUser(userData);
      localStorage.setItem("lcs_pseudo", loginName);
      const { data: vData } = await supabase.from("ventes").select("*, vendeurs(numero_table, zone)").eq("acheteur_id", userData.id).order("created_at", { ascending: false });
      setVentes(vData || []);
      setStep("main");
    }
  };

  const handleAuth = async () => {
    if (!pseudo.trim()) return alert("Le pseudo est obligatoire !");
    const { data: existingUser } = await supabase.from("acheteurs").select("*").eq("pseudo", pseudo).maybeSingle();

    if (existingUser) {
      loadUserData(pseudo);
    } else {
      if (!age) return alert("Ton âge est requis pour t'inscrire !");
      const { data: newUser, error } = await supabase.from("acheteurs").insert({ 
        pseudo: pseudo.trim(), age: parseInt(age), interets, total_points: 0, total_achats: 0
      }).select().single();
      if (error) return alert(`Erreur: ${error.message}`);
      loadUserData(pseudo.trim());
    }
  };

  useEffect(() => {
    if (!user || !currentScanId) return;
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scans', filter: `id=eq.${currentScanId}` }, 
      (payload) => {
        if (payload.new.status === 'accepted') {
          setAttenteValidation(false);
          setCurrentScanId(null);
          loadUserData(user.pseudo);
          // Popin de félicitation temporaire possible ici
        } else if (payload.new.status === 'rejected') {
          setAttenteValidation(false);
          setCurrentScanId(null);
          alert("Le vendeur a annulé la demande d'achat.");
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentScanId]);

  const toggleTag = (tag) => setInterets(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const startScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader-container");
    html5QrRef.current = scanner;

    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const qrCode = txt.replace("LCS-APP:", "");
      const { data: vendeur } = await supabase.from("vendeurs").select("*").eq("qr_code", qrCode).maybeSingle();
      
      if (vendeur) {
        await scanner.stop();
        setScanning(false);
        setAttenteValidation(true);
        const { data: scanInfo } = await supabase.from("scans").insert({ vendeur_id: vendeur.id, acheteur_id: user.id, status: 'pending' }).select().single();
        setCurrentScanId(scanInfo.id);
      }
    }, () => {});
  };

  const getLevel = (pts) => {
    if (pts < 50) return { name: "ROOKIE", rank: "1/5" };
    if (pts < 100) return { name: "PRO", rank: "2/5" };
    if (pts < 250) return { name: "ALL STAR", rank: "3/5" };
    if (pts < 500) return { name: "MVP", rank: "4/5" };
    return { name: "HALL OF FAMER", rank: "5/5" };
  };

  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  if (step === "auth") return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      <h1 className="fugaz" style={{ textAlign: "center", fontSize: 26, margin: "0 0 20px 0" }}>INSCRIPTION VISITEUR</h1>
      <p className="dm" style={{ textAlign: "center", fontSize: 13, color: "#ccc", marginBottom: 30, padding: "0 20px" }}>
        Texte descriptif des avantages Texte descriptif des avantages des avantages.
      </p>

      <input className="dm" type="text" placeholder="Pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle} />
      <input className="dm" type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} />
      
      <p className="dm" style={{ margin: "10px 0 10px 10px", fontSize: 14 }}>Que collectionne tu ?</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 30 }}>
        {TAGS_DISPO.map(tag => {
          const isSelected = interets.includes(tag);
          return (
            <button key={tag} onClick={() => toggleTag(tag)} className="fugaz" style={{
              padding: "8px 16px", borderRadius: 50, border: "none",
              background: isSelected ? "#F06A2A" : "rgba(255,255,255,0.1)",
              color: "#fff", cursor: "pointer", fontSize: 13, transition: "all 0.2s"
            }}>
              {tag}
            </button>
          )
        })}
      </div>
      
      <button onClick={handleAuth} className="fugaz" style={btnPrimary}>CONTINUER</button>
    </div>
  );

  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;
  const currentLevel = user ? getLevel(user.total_points) : {name: "", rank: ""};

  return (
    <div style={{ ...containerStyle, padding: "30px 20px 100px 20px", justifyContent: "flex-start" }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fugaz+One&display=swap'); .fugaz { font-family: 'Fugaz One', sans-serif; font-style: italic; } .dm { font-family: 'DM Sans', sans-serif; }`}} />
      
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <div className="fugaz" style={{ fontSize: 18, color: "#fff", letterSpacing: 1 }}>BIENVENUE</div>
        <div className="fugaz" style={{ fontSize: 36, color: "#F06A2A", lineHeight: 1, letterSpacing: 1 }}>{user?.pseudo}</div>
      </div>

      {/* TABS */}
      <div className="fugaz" style={{ display: "flex", gap: 15, marginBottom: 30, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10 }}>
        <button onClick={() => setActiveTab("statut")} style={activeTab === "statut" ? activeTabStyle : inactiveTabStyle}>STATUT</button>
        <button onClick={() => setActiveTab("historique")} style={activeTab === "historique" ? activeTabStyle : inactiveTabStyle}>HISTORIQUE</button>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>QR CODE</button>
      </div>

      {/* CONTENU : STATUT */}
      {activeTab === "statut" && (
        <div className="animate-fade-in">
          {/* Level Card */}
          <div style={{ background: "#1A0DFF", borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 20 }}>
            <div className="dm" style={{ fontSize: 14 }}>Level</div>
            <div className="fugaz" style={{ fontSize: 38, margin: "5px 0" }}>{currentLevel.name}</div>
            <div className="dm" style={{ fontSize: 12 }}>{currentLevel.rank}</div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 20 }}>
            <div style={statCardDark}>
              <div className="fugaz" style={{ fontSize: 40, color: "#F06A2A", lineHeight: 1 }}>{user?.total_points}</div>
              <div className="dm" style={{ fontSize: 12, marginTop: 5 }}>Points</div>
            </div>
            <div style={statCardDark}>
              <div className="fugaz" style={{ fontSize: 40, color: "#F06A2A", lineHeight: 1 }}>{user?.total_achats}</div>
              <div className="dm" style={{ fontSize: 12, marginTop: 5 }}>Achats</div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENU : HISTORIQUE */}
      {activeTab === "historique" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ventes.length === 0 ? <p className="dm" style={{color: "#888", fontSize: 14}}>Aucun achat pour le moment.</p> : (
            ventes.map(v => (
              <div key={v.id} style={{ padding: "15px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="dm" style={{ fontWeight: "bold", fontSize: 12, color: "#F06A2A", textTransform: "uppercase" }}>
                    TABLE N°{v.vendeurs?.numero_table} - {v.vendeurs?.zone}
                  </div>
                  <div className="dm" style={{ fontSize: 11, color: "#ccc", marginTop: 4, textTransform: "uppercase" }}>
                    {v.nombre_cartes} CARTES  {v.nombre_scelles||0} SCELLÉS
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="fugaz" style={{ color: "#F06A2A", fontSize: 18 }}>{v.points_gagnes} Pts</div>
                  <div className="dm" style={{ fontSize: 10, color: "#888" }}>{v.montant} €</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONTENU : QR CODE */}
      {activeTab === "qr" && (
        <div className="animate-fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ background: "#fff", padding: 25, display: "inline-block", borderRadius: 20 }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(myQrUrl)}`} alt="QR" style={{ width: 220, height: 220 }} />
          </div>
          <button onClick={() => { localStorage.clear(); setStep("auth"); }} className="dm" style={{ display: "block", margin: "30px auto 0", background: "none", border: "none", color: "#666", textDecoration: "underline" }}>Se déconnecter</button>
        </div>
      )}

      {/* BOUTON FIXÉ EN BAS */}
      <div style={{ position: "fixed", bottom: 20, left: 20, right: 20, maxWidth: 600, margin: "0 auto" }}>
        <button onClick={startScanner} className="fugaz" style={btnPrimary}>
          SCANNER UN EXPOSANT
        </button>
      </div>

      {/* POPUP SCANNING */}
      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 className="fugaz" style={{ margin: 0, color: "#000" }}>Scanner Exposant</h3>
              <button onClick={() => { if(html5QrRef.current) html5QrRef.current.stop(); setScanning(false); }} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#000" }}>✕</button>
            </div>
            <div id="qr-reader-container" style={{ width: "100%", minHeight: 250, background: "#000", borderRadius: 12, overflow: "hidden" }} />
          </div>
        </div>
      )}

      {/* POPUP ATTENTE / MERCI */}
      {attenteValidation && (
        <div style={overlayStyle}>
          <div style={{...popupStyle, background: "#050514", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", padding: "40px 20px" }}>
            <h3 className="fugaz" style={{ margin: 0, fontSize: 24 }}>EN ATTENTE...</h3>
            <p className="dm" style={{ color: "#ccc", fontSize: 14, marginTop: 10, marginBottom: 30 }}>
              L'exposant finalise ta transaction.
            </p>
            <div className="animate-pulse-soft" style={{ fontSize: 50, marginBottom: 30 }}>⏳</div>
            <button onClick={async () => {
              await supabase.from("scans").update({ status: 'rejected' }).eq("id", currentScanId);
              setAttenteValidation(false);
              setCurrentScanId(null);
            }} className="fugaz" style={{...btnPrimary, background: "rgba(255,255,255,0.1)", color: "#fff"}}>ANNULER</button>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const containerStyle = { display: "flex", flexDirection: "column", padding: 30, minHeight: "100dvh", backgroundColor: "#050514", color: "#fff", maxWidth: 500, margin: "0 auto" };
const inputStyle = { width: "100%", padding: "16px 20px", borderRadius: 50, border: "none", backgroundColor: "#ffffff", color: "#000000", fontSize: 14, outline: "none", marginBottom: 15 };
const btnPrimary = { padding: "18px", borderRadius: 50, border: "none", background: "#F06A2A", color: "#fff", fontSize: 16, cursor: "pointer", width: "100%" };
const statCardDark = { padding: "20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", background: "transparent" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", color: "#000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };

const activeTabStyle = { background: "transparent", border: "none", borderBottom: "3px solid #fff", color: "#fff", paddingBottom: 5, cursor: "pointer", fontSize: 14 };
const inactiveTabStyle = { background: "transparent", border: "none", borderBottom: "3px solid transparent", color: "#666", paddingBottom: 5, cursor: "pointer", fontSize: 14 };