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
          style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: activeTab === "dashboard" ? "var(--bg)" : "transparent", color: activeTab === "dashboard" ? "var(--text)" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: activeTab === "dashboard"