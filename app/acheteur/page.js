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
  const [activeTab, setActiveTab] = useState("dash"); // "dash" | "qr"
  
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("lcs_pseudo");
    if (saved) {
      loadUserData(saved);
    } else {
      setStep("auth"); // Un seul écran pour login/setup
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
    
    // On cherche si le pseudo existe
    const { data: existingUser } = await supabase.from("acheteurs").select("*").eq("pseudo", pseudo).maybeSingle();

    if (existingUser) {
      // S'il existe, on le connecte (on ignore l'âge et les intérêts tapés)
      loadUserData(pseudo);
    } else {
      // S'il n'existe pas, c'est une création de compte. L'âge devient obligatoire.
      if (!age) return alert("Nouveau compte détecté : Ton âge est requis pour t'inscrire !");
      
      const { data: newUser, error } = await supabase.from("acheteurs").insert({ 
        pseudo: pseudo.trim(), 
        age: parseInt(age),
        interets,
        total_points: 0,
        total_achats: 0
      }).select().single();

      if (error) return alert("Erreur à la création (Pseudo peut-être déjà pris par quelqu'un d'autre).");
      
      loadUserData(pseudo.trim());
    }
  };

  const toggleTag = (tag) => {
    setInterets(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // -- SCANNER --
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

  // RENDER : CHARGEMENT
  if (step === "loading") return <div style={containerStyle}>Chargement...</div>;

  // RENDER : ECRAN UNIQUE LOGIN / INSCRIPTION
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
        {TAGS_DISPO.map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)} style={{
            padding: "8px 12px", borderRadius: 20, border: "1px solid #333",
            background: interets.includes(tag) ? "#333" : "#fff",
            color: interets.includes(tag) ? "#fff" : "#000", cursor: "pointer", fontSize: 13
          }}>
            {tag}
          </button>
        ))}
      </div>
      
      <button onClick={handleAuth} style={btnPrimary}>Continuer</button>
    </div>
  );

  // RENDER : MAIN (Dashboard + QR)
  const myQrUrl = `${window.location.origin}/?buyer=${user?.id}`;

  return (
    <div style={{ padding: "24px 20px", paddingBottom: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#888" }}>Bonjour</div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>{user?.pseudo}</div>
        </div>
        <button onClick={() => { localStorage.clear(); setStep("auth"); setPseudo(""); setAge(""); setInterets([]); }} style={btnLink}>Quitter</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("dash")} style={{...tabBtn, background: activeTab === "dash" ? "#e0e0e0" : "#f5f5f5", color: "#000"}}>Tableau de bord</button>
        <button onClick={() => setActiveTab("qr")} style={{...tabBtn, background: activeTab === "qr" ? "#e0e0e0" : "#f5f5f5", color: "#000"}}>Mon QR Code</button>
      </div>

      {activeTab === "qr" ? (
        <div style={{ textAlign: "center", padding: 20 }}>
          <h2 style={{ fontSize: 18 }}>Voici ton QR personnel</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>L'organisateur le scannera pour te remettre ton lot.</p>
          <div style={{ background: "#fff", padding: 20, display: "inline-block", borderRadius: 20 }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(myQrUrl)}`} alt="QR" style={{ width: 200, height: 200 }} />
          </div>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div style={{ textAlign: "center", padding: 30, background: "#f9f9f9", borderRadius: 20, marginBottom: 20, border: "1px solid #eee" }}>
            <h1 style={{ fontSize: 60, margin: 0, color: "#000" }}>{user?.total_points}</h1>
            <p style={{ margin: 0, color: "#666", fontWeight: "bold" }}>POINTS CUMULÉS</p>
          </div>

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

          {/* BOUTON SCAN */}
          <button onClick={startScanner} style={{ ...btnPrimary, width: "100%", marginBottom: 24, background: "var(--success, #1D9E75)" }}>
            📷 Scanner un vendeur
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
        </>
      )}

      {/* POPUP SCAN Vendeur */}
      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <h3 style={{ marginTop: 0, color: "#000" }}>Enregistrer l'achat</h3>
            {scanResult?.vendeur ? (
              <ScanConfirm vendeur={scanResult.vendeur} acheteurId={user.id} onDone={() => { setScanning(false); loadUserData(user.pseudo); }} onCancel={() => setScanning(false)} />
            ) : (
              <div id="qr-reader-container" style={{ width: "100%", minHeight: 250, background: "#000", borderRadius: 12, overflow: "hidden" }} />
            )}
            {!scanResult?.vendeur && <button onClick={() => setScanning(false)} style={{...btnSecondary, width: "100%", marginTop: 15}}>Annuler</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// COMPOSANT CONFIRMATION ACHAT
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
    else alert("Erreur lors de l'enregistrement. Vérifie la connexion.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 15 }}>
      <div style={{ padding: "10px", background: "#f0f0f0", borderRadius: 10 }}>
        <p style={{ margin: 0, color: "#000" }}>Vendeur <strong>Table {vendeur.numero_table}</strong></p>
      </div>
      
      <div style={{ display: "flex", gap: 10, background: "#eee", padding: 5, borderRadius: 10 }}>
        <button onClick={() => setTypeProduit("Cartes")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: typeProduit === "Cartes" ? "#fff" : "transparent", color: "#000", fontWeight: "bold" }}>Cartes</button>
        <button onClick={() => setTypeProduit("Scellé")} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: typeProduit === "Scellé" ? "#fff" : "transparent", color: "#000", fontWeight: "bold" }}>Scellé</button>
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

// --- STYLES PARTAGÉS ---
const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#666", marginBottom: -10, zIndex: 1 };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 15, borderRadius: 10, border: "none", background: "#000", color: "#fff", fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid #ccc", background: "none", color: "#000", cursor: "pointer" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20 };
const tabBtn = { flex: 1, padding: 10, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "#f9f9f9", border: "1px solid #eee", textAlign: "center" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#fff", color: "#000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };