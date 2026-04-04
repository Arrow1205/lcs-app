"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const TAGS_DISPO = ["Pokemon", "One Piece", "Magic", "Lorcana", "Basket", "Soccer", "Sport US", "Formule 1", "Comics"];

export default function AcheteurPage() {
  const [step, setStep] = useState("loading");
  
  // Champs Formulaire (Page Unique)
  const [pseudo, setPseudo] = useState("");
  const [age, setAge] = useState("");
  const [interets, setInterets] = useState([]);
  
  const [user, setUser] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [activeTab, setActiveTab] = useState("dash");
  
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) {
      loadUserData(saved);
    } else {
      setStep("auth"); 
    }
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
      if (!age) return alert("Nouveau compte détecté : Ton âge est requis pour t'inscrire !");
      
      const { data: newUser, error } = await supabase.from("acheteurs").insert({ 
        pseudo: pseudo.trim(), 
        age: parseInt(age),
        interets,
        total_points: 0,
        total_achats: 0
      }).select().single();

      if (error) {
        console.error("Détail de l'erreur :", error);
        return alert(`Erreur base de données: ${error.message}`);
      }
      
      loadUserData(pseudo.trim());
    }
  };

  const toggleTag = (tag) => {
    setInterets(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader-container");
    html5QrRef.current = scanner;

    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const qrCode = txt.replace("LCS-APP:", "");
      const { data: vendeur } = await supabase.from("vendeurs").select("*").eq("qr_code", qrCode).maybeSingle();
      if (vendeur) {
        setScanResult({ vendeur });
        await scanner.stop();
      }
    }, () => {});
  };

  // =============================================
  // RENDER : CHARGEMENT
  // =============================================
  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  // =============================================
  // RENDER : ECRAN UNIQUE LOGIN / INSCRIPTION
  // =============================================
  if (step === "auth") return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: "center", marginBottom: 5 }}>Espace Acheteur</h1>
      <p style={{ textAlign: "center", fontSize: 13, color: "#666", marginBottom: 20 }}>
        Connecte-toi avec ton pseudo, ou remplis tout pour créer un compte.
      </p>

      <label style={labelStyle}>Ton Pseudo * :</label>
      <input type="text" placeholder="Ex: PokeFan99" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle} />
      
      <label style={labelStyle}>Ton Âge (si nouveau compte) :</label>
      <input type="number" placeholder="Ex: 25" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} />
      
      <label style={{...labelStyle, marginTop: 10, marginBottom: 5}}>Tes centres d'intérêt :</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {TAGS_DISPO.map(tag => {
          const isSelected = interets.includes(tag);
          return (
            <button key={tag} onClick={() => toggleTag(tag)} style={{
              padding: "8px 12px", borderRadius: 20, 
              border: `1px solid ${isSelected ? "var(--accent)" : "#ccc"}`,
              background: isSelected ? "var(--accent)" : "#fff",
              color: isSelected ? "#fff" : "#000", 
              cursor: "pointer", fontSize: 13, fontWeight: isSelected ? "bold" : "normal",
              transition: "all 0.2s"
            }}>
              {tag}
            </button>
          )
        })}
      </div>
      
      <button onClick={handleAuth} style={btnPrimary}>Continuer</button>
    </div>
  );

  // =============================================
  // RENDER : MAIN (Dashboard + QR)
  // =============================================
  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;

  return (
    <div style={{ padding: "24px 20px", paddingBottom: 120, maxWidth: 600, margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#888" }}>Bonjour</div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>{user?.pseudo}</div>
        </div>
        <button onClick={() => { localStorage.clear(); setStep("auth"); setPseudo(""); setAge(""); setInterets([]); }} style={btnLink}>Quitter</button>
      </div>

      {/* TABS (Arrondis et Orange) */}
      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("dash")} style={activeTab === "dash" ? activeTabStyle : inactiveTabStyle}>Tableau de bord</button>
        <button onClick={() => setActiveTab("qr")} style={activeTab === "qr" ? activeTabStyle : inactiveTabStyle}>Mon QR Code</button>
      </div>

      {/* CONTENU : MON QR CODE */}
      {activeTab === "qr" ? (
        <div className="animate-fade-in" style={{ textAlign: "center", padding: 20 }}>
          <h2 style={{ fontSize: 18 }}>Voici ton QR personnel</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>L'organisateur le scannera pour te remettre ton lot.</p>
          <div style={{ background: "#fff", padding: 20, display: "inline-block", borderRadius: 20, border: "1px solid #eee" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(myQrUrl)}`} alt="QR" style={{ width: 200, height: 200 }} />
          </div>
        </div>
      ) : (

        /* CONTENU : TABLEAU DE BORD */
        <div className="animate-fade-in">
          
          {/* KPI Points */}
          <div style={{ textAlign: "center", padding: 30, background: "#f9f9f9", borderRadius: 20, marginBottom: 20, border: "1px solid #eee" }}>
            <h1 style={{ fontSize: 60, margin: 0, color: "#000" }}>{user?.total_points}</h1>
            <p style={{ margin: 0, color: "#666", fontWeight: "bold" }}>POINTS CUMULÉS</p>
          </div>

          {/* KPI Secondaires */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#000" }}>{user?.total_achats || 0}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Transactions</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#000" }}>{ventes.reduce((s, v) => s + v.nombre_cartes, 0)}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Cartes achetées</div>
            </div>
          </div>

          {/* BOUTON SCAN FORCÉ EN ORANGE */}
          <button onClick={startScanner} style={{ ...btnPrimary, width: "100%", marginBottom: 24, background: "var(--accent)" }}>
            📷 Scanner QR Code
          </button>

          {/* HISTORIQUE */}
          <h3 style={{ fontSize: 14, color: "#666", textTransform: "uppercase" }}>Historique d'achats</h3>
          {ventes.length === 0 ? <p style={{color: "#888", fontSize: 14}}>Aucun achat pour le moment.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ventes.map(v => (
                <div key={v.id} style={{ padding: 15, background: "#f9f9f9", borderRadius: 12, display: "flex", justifyContent: "space-between", color: "#000" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>Table {v.vendeurs?.numero_table} ({v.vendeurs?.zone})</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{v.type_produit} - {v.nombre_cartes} art. - {v.montant}€</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "var(--success, #1D9E75)" }}>+{v.points_gagnes} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POPUP SCAN Vendeur */}
      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0, color: "#000" }}>Enregistrer l'achat</h3>
              <button onClick={() => setScanning(false)} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#000" }}>✕</button>
            </div>
            
            {scanResult?.vendeur ? (
              <ScanConfirm vendeur={scanResult.vendeur} acheteurId={user.id} onDone={() => { setScanning(false); loadUserData(user.pseudo); }} onCancel={() => setScanning(false)} />
            ) : (
              <div id="qr-reader-container" style={{ width: "100%", minHeight: 250, background: "#000", borderRadius: 12, overflow: "hidden" }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// COMPOSANT CONFIRMATION ACHAT
// =============================================
function ScanConfirm({ vendeur, acheteurId, onDone, onCancel }) {
  const [cartes, setCartes] = useState("");
  const [montant, setMontant] = useState("");
  const [typeProduit, setTypeProduit] = useState("Cartes"); 
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("enregistrer_vente", {
      p_vendeur_id: vendeur.id,
      p_acheteur_id: acheteurId,
      p_nombre_cartes: parseInt(cartes) || 0,
      p_montant: parseFloat(montant) || 0,
      p_type_produit: typeProduit
    });
    
    setLoading(false);
    if (!error) onDone();
    else alert(`Erreur d'enregistrement : ${error.message}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "10px", background: "#f0f0f0", borderRadius: 10 }}>
        <p style={{ margin: 0, color: "#000" }}>Vendeur <strong>Table {vendeur.numero_table}</strong></p>
      </div>
      
      <div style={{ display: "flex", gap: 10, background: "#eee", padding: 5, borderRadius: 10 }}>
        <button onClick={() => setTypeProduit("Cartes")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: typeProduit === "Cartes" ? "#fff" : "transparent", color: "#000", fontWeight: "bold", cursor: "pointer" }}>Cartes</button>
        <button onClick={() => setTypeProduit("Scellé")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: typeProduit === "Scellé" ? "#fff" : "transparent", color: "#000", fontWeight: "bold", cursor: "pointer" }}>Scellé</button>
      </div>

      <input type="number" value={cartes} onChange={e => setCartes(e.target.value)} placeholder="Quantité d'articles (ex: 3)" style={inputStyle} />
      <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="Montant en € (ex: 15)" style={inputStyle} />
      
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
        <button onClick={handleConfirm} disabled={loading} style={{ ...btnPrimary, flex: 2 }}>Valider l'achat</button>
      </div>
    </div>
  );
}

// =============================================
// STYLES PARTAGÉS
// =============================================
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh", maxWidth: 450, margin: "0 auto" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#666", marginBottom: -10, zIndex: 1 };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 16, borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 14, borderRadius: 12, border: "1px solid #ccc", background: "none", color: "#000", fontWeight: "bold", cursor: "pointer" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "#f9f9f9", border: "1px solid #eee", textAlign: "center" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", color: "#000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };

// Styles des onglets ronds
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20, background: "#f5f5f5", padding: 6, borderRadius: 50 };
const activeTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "var(--accent)", color: "#fff", transition: "all 0.2s" };
const inactiveTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "transparent", color: "#666", transition: "all 0.2s" };