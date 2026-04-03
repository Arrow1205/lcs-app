"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, QR_PREFIX, TIERS, calcPoints, getCurrentTier, getNextTier } from "@/lib/supabase";

export default function AcheteurPage() {
  // --- STATE ---
  const [step, setStep] = useState("loading"); // loading | login | setup | main
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [acheteurData, setAcheteurData] = useState(null);
  
  const [ventes, setVentes] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [pointsAnim, setPointsAnim] = useState(null);

  // Tabs
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "my_qr"
  const [appUrl, setAppUrl] = useState("");

  const html5QrRef = useRef(null);

  // --- AUTH REALTIME & SESSION ---
  useEffect(() => {
    setAppUrl(window.location.origin); // Initialisation de l'URL pour le QR Code

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAcheteurProfile(session.user);
      } else {
        setStep("login");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkAcheteurProfile(session.user);
      } else {
        setAcheteurData(null);
        setStep("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- CHECK / LOAD BUYER PROFILE ---
  const checkAcheteurProfile = async (user) => {
    try {
      const { data: profile } = await supabase
        .from("acheteurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setAcheteurData(profile);
        setStep("main");
      } else {
        setStep("setup"); 
      }
    } catch (err) {
      console.error("Erreur check profil:", err);
    }
  };

  // --- LOAD DATA ---
  const loadData = useCallback(async () => {
    if (!acheteurData) return;

    const { data: fresh } = await supabase
      .from("acheteurs")
      .select("*")
      .eq("id", acheteurData.id)
      .single();
    if (fresh) setAcheteurData(fresh);

    const { data: v } = await supabase
      .from("ventes")
      .select("*, vendeurs(id, numero_table, email)")
      .eq("acheteur_id", acheteurData.id)
      .order("created_at", { ascending: false });
    if (v) setVentes(v);
  }, [acheteurData?.id]);

  useEffect(() => {
    if (step === "main" && acheteurData) loadData();
  }, [step, acheteurData?.id, loadData]);

  // --- REALTIME ---
  useEffect(() => {
    if (!acheteurData || step !== "main") return;

    const channel = supabase
      .channel("buyer-ventes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ventes", filter: `acheteur_id=eq.${acheteurData.id}` },
        (payload) => {
          setPointsAnim(payload.new.points_gagnes);
          setTimeout(() => setPointsAnim(null), 2000);
          loadData();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [acheteurData?.id, step, loadData]);

  // --- LOGIN / SIGNUP EMAIL ---
  const handleEmailAuth = async (isSignUp) => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email et mot de passe requis");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // --- LOGIN GOOGLE ---
  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/acheteur" }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // --- SETUP PROFILE ---
  const handleSetupProfile = async () => {
    setError("");
    if (!pseudo.trim()) {
      setError("Ton pseudo est requis");
      return;
    }
    setLoading(true);

    try {
      const { data: newAcheteur, error: insertError } = await supabase
        .from("acheteurs")
        .insert({
          id: session.user.id,
          email: session.user.email,
          pseudo: pseudo.trim(),
          total_points: 0,
          total_achats: 0
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message.includes("unique") || insertError.code === "23505") {
          throw new Error("Ce pseudo est déjà pris !");
        }
        throw insertError;
      }

      setAcheteurData(newAcheteur);
      setStep("main");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // --- LOGOUT ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- QR SCANNER ---
  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-container");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          if (!decodedText.startsWith(QR_PREFIX)) {
            setScanResult({ error: "Ce QR code n'est pas un QR vendeur du salon" });
            return;
          }

          const qrCode = decodedText.replace(QR_PREFIX, "");
          const { data: vendeur } = await supabase
            .from("vendeurs")
            .select("*")
            .eq("qr_code", qrCode)
            .single();

          if (!vendeur) {
            setScanResult({ error: "Vendeur introuvable" });
            return;
          }

          setScanResult({ vendeur });
          try { await scanner.stop(); } catch (e) {}
        },
        (errorMessage) => {}
      );
    } catch (err) {
      setScanResult({ error: "Impossible d'accéder à la caméra." });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch (e) {}
      html5QrRef.current = null;
    }
    setScanning(false);
    setScanResult(null);
  };

  const currentTier = acheteurData ? getCurrentTier(Number(acheteurData.total_points)) : null;
  const nextTier = acheteurData ? getNextTier(Number(acheteurData.total_points)) : null;
  const totalPts = Number(acheteurData?.total_points || 0);

  // =============================================
  // RENDER: LOADING
  // =============================================
  if (step === "loading") {
    return <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>Chargement...</div>;
  }

  // =============================================
  // RENDER: LOGIN
  // =============================================
  if (step === "login") {
    return (
      <div className="animate-fade-in" style={{
        display: "flex", flexDirection: "column",
        justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 24,
      }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 3,
            color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8,
          }}>
            Espace acheteur
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Connexion</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            onClick={handleGoogleAuth}
            style={{ ...btnSecondary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#000" }}
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width={20} />
            Continuer avec Google
          </button>

          <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: "8px 0" }}>OU</div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com" style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => handleEmailAuth(false)} disabled={loading} style={{ ...btnPrimary, flex: 1, opacity: loading ? 0.6 : 1 }}>
              Se connecter
            </button>
            <button onClick={() => handleEmailAuth(true)} disabled={loading} style={{ ...btnSecondary, flex: 1, opacity: loading ? 0.6 : 1 }}>
              Créer un compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: SETUP PROFILE
  // =============================================
  if (step === "setup") {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dernière étape !</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>Choisis un pseudo pour participer à la chasse aux points.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Pseudo (visible par les vendeurs)</label>
            <input type="text" value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="Ex: CardMaster59" style={inputStyle} />
          </div>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 13, fontWeight: 500 }}>{error}</div>}
          <button onClick={handleSetupProfile} disabled={loading} style={{ ...btnPrimary }}>Confirmer</button>
          <button onClick={handleLogout} style={btnLink}>Annuler et se déconnecter</button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: MAIN (Dashboard ou Mon QR)
  // =============================================
  const myQrUrl = acheteurData ? `${appUrl}/?buyer=${acheteurData.id}` : "";
  const qrImageUrl = myQrUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(myQrUrl)}&color=07033A&bgcolor=ffffff` : "";

  return (
    <div className="animate-fade-in" style={{ padding: "24px 20px", paddingBottom: 120 }}>
      {pointsAnim && (
        <div className="animate-points-float" style={{
          position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)",
          fontSize: 40, fontWeight: 800, color: "var(--success)", zIndex: 1000,
          textShadow: "0 2px 20px rgba(29,158,117,0.4)",
        }}>
          +{pointsAnim} pts
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Bonjour</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{acheteurData?.pseudo}</div>
        </div>
        <button onClick={handleLogout} style={btnLink}>Déconnexion</button>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 12, padding: 4, marginBottom: 24, border: "1px solid var(--border)" }}>
        <button 
          onClick={() => setActiveTab("dashboard")}
          style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: activeTab === "dashboard" ? "var(--bg)" : "transparent", color: activeTab === "dashboard" ? "var(--text)" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: activeTab === "dashboard" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
        >
          Tableau de bord
        </button>
        <button 
          onClick={() => setActiveTab("my_qr")}
          style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: activeTab === "my_qr" ? "var(--bg)" : "transparent", color: activeTab === "my_qr" ? "var(--text)" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: activeTab === "my_qr" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
        >
          Mon QR Code
        </button>
      </div>

      {activeTab === "my_qr" ? (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Voici ton QR personnel</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              L'organisateur le scannera pour te remettre ton lot et réinitialiser tes points.
            </p>
          </div>
          
          <div style={{ padding: 24, borderRadius: 20, background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", display: "inline-block" }}>
            <img src={qrImageUrl} alt="Mon QR Code" width={250} height={250} style={{ display: "block" }} />
          </div>

          <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(249,105,39,0.1)", color: "var(--accent)", fontSize: 13, fontWeight: 500, textAlign: "center" }}>
            ⚠️ Ne fais scanner ce QR qu'aux organisateurs !
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: 24, borderRadius: 20, background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 20, textAlign: "center" }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ margin: "0 auto 12px" }}>
              <circle cx="65" cy="65" r="54" fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle cx="65" cy="65" r="54" fill="none" stroke={totalPts >= 50 ? "#E24B4A" : "var(--accent)"} strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 54} strokeDashoffset={2 * Math.PI * 54 * (1 - Math.min(totalPts / 50, 1))} transform="rotate(-90 65 65)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              <text x="65" y="60" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 26, fontWeight: 700, fill: "var(--text)" }}>{totalPts}</text>
              <text x="65" y="82" textAnchor="middle" style={{ fontSize: 10, fontWeight: 500, fill: "var(--text-muted)", letterSpacing: 1 }}>POINTS</text>
            </svg>
            {currentTier && <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{currentTier.label}</div>}
            {nextTier && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}><span style={{ fontWeight: 600, color: "var(--text)" }}>{Math.round((nextTier.min - totalPts) * 10) / 10} pts</span> avant <span style={{ fontWeight: 600, color: "var(--accent)" }}>{nextTier.label}</span></div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {TIERS.map((t, i) => {
              const reached = totalPts >= t.min;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: reached ? "rgba(249,105,39,0.08)" : "var(--bg-card)", border: `1px solid ${reached ? "var(--accent)" : "var(--border)"}`, opacity: reached ? 1 : 0.5, transition: "all 0.3s" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: reached ? "var(--accent)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{reached ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: reached ? "var(--accent)" : "var(--text-muted)" }}>{t.label} — {t.min} pts</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.reward}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={startScanner} className="animate-pulse-soft" style={{ width: "100%", padding: "20px", borderRadius: 16, border: "none", background: "var(--accent)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            Scanner un QR vendeur
          </button>

          {scanning && (
            <div style={overlayStyle}>
              <div className="animate-slide-up" style={{ ...popupStyle, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Scanner</h3>
                  <button onClick={stopScanner} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 18, cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <div id="qr-reader-container" style={{ width: "100%", borderRadius: 16, overflow: "hidden", background: "#000", minHeight: 280 }} />
                {scanResult?.error && <div style={{ padding: "12px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 14, fontWeight: 500, textAlign: "center" }}>{scanResult.error}</div>}
                {scanResult?.vendeur && <ScanConfirm vendeur={scanResult.vendeur} acheteurId={acheteurData.id} onDone={() => { stopScanner(); loadData(); }} onCancel={stopScanner} />}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{acheteurData?.total_achats || 0}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Achats</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{ventes.reduce((s, v) => s + v.nombre_cartes, 0)}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Cartes achetées</div>
            </div>
          </div>

          <h3 style={sectionTitle}>Historique d'achats</h3>
          {ventes.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", borderRadius: 14, background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14 }}>Aucun achat pour le moment. Scannez un QR vendeur !</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {ventes.map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Table {v.vendeurs?.numero_table}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {v.nombre_cartes} carte{v.nombre_cartes > 1 ? "s" : ""} — {Number(v.montant).toFixed(0)}€ — {new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap" }}>+{v.points_gagnes} pts</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- SCAN CONFIRM COMPONENT ---
function ScanConfirm({ vendeur, acheteurId, onDone, onCancel }) {
  const [cartes, setCartes] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleConfirm = async () => {
    const nb = parseInt(cartes) || 0;
    const mt = parseFloat(montant) || 0;
    if (nb <= 0 && mt <= 0) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("enregistrer_vente", {
      p_vendeur_id: vendeur.id,
      p_acheteur_id: acheteurId,
      p_nombre_cartes: nb,
      p_montant: mt,
    });

    if (error) {
      setResult("Erreur : " + error.message);
    } else {
      const pts = calcPoints(nb, mt);
      setResult(`+${pts} points gagnés !`);
      setTimeout(onDone, 1500);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(249,105,39,0.08)", border: "1px solid var(--accent)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>Vendeur Table {vendeur.numero_table}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Nb de cartes</label>
          <input type="number" value={cartes} onChange={e => setCartes(e.target.value)} placeholder="0" min="0" autoFocus style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Montant (€)</label>
          <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" min="0" step="0.5" style={inputStyle} />
        </div>
      </div>

      {((parseInt(cartes) > 0) || (parseFloat(montant) > 0)) && (
        <div style={{ padding: "10px", borderRadius: 10, textAlign: "center", background: "rgba(29,158,117,0.1)", color: "var(--success)", fontSize: 16, fontWeight: 700 }}>
          +{calcPoints(parseInt(cartes) || 0, parseFloat(montant) || 0)} points
        </div>
      )}

      {result && (
        <div style={{ padding: "10px", borderRadius: 10, textAlign: "center", background: result.includes("Erreur") ? "rgba(226,75,74,0.1)" : "rgba(29,158,117,0.1)", color: result.includes("Erreur") ? "#E24B4A" : "var(--success)", fontSize: 14, fontWeight: 600 }}>
          {result}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
        <button onClick={handleConfirm} disabled={loading} style={{ ...btnPrimary, flex: 2, background: "var(--success)" }}>
          {loading ? "..." : "Confirmer l'achat"}
        </button>
      </div>
    </div>
  );
}

// --- SHARED STYLES ---
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 15, outline: "none" };
const btnPrimary = { padding: "16px 24px", borderRadius: 14, border: "none", background: "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" };
const btnSecondary = { padding: "14px 24px", borderRadius: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 14, fontWeight: 500, cursor: "pointer" };
const btnLink = { padding: 0, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 };
const popupStyle = { width: "100%", maxWidth: 420, padding: 24, borderRadius: 20, background: "var(--bg)", border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" };
const statCard = { padding: "18px 16px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionTitle = { fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" };