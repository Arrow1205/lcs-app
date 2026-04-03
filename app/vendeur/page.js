"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, QR_PREFIX, calcPoints } from "@/lib/supabase";

export default function VendeurPage() {
  // --- STATE ---
  const [step, setStep] = useState("loading"); // loading | login | setup | qr | dashboard
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [table, setTable] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [vendorData, setVendorData] = useState(null);

  // Dashboard stats & Popups (inchangés)
  const [stats, setStats] = useState({ totalVentes: 0, totalCartes: 0, totalScans: 0, totalCA: 0 });
  const [recentVentes, setRecentVentes] = useState([]);
  const [showVentePopup, setShowVentePopup] = useState(false);
  const [venteAcheteur, setVenteAcheteur] = useState("");
  const [venteCartes, setVenteCartes] = useState("");
  const [venteMontant, setVenteMontant] = useState("");
  const [venteLoading, setVenteLoading] = useState(false);
  const [venteSuccess, setVenteSuccess] = useState(null);

  // --- AUTH REALTIME & SESSION ---
  useEffect(() => {
    // Vérifier la session actuelle au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkVendorProfile(session.user);
      } else {
        setStep("login");
      }
    });

    // Écouter les changements d'état (connexion/déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkVendorProfile(session.user);
      } else {
        setVendorData(null);
        setStep("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- CHECK / LOAD VENDOR PROFILE ---
  const checkVendorProfile = async (user) => {
    try {
      const { data: profile, error } = await supabase
        .from("vendeurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setVendorData(profile);
        setStep("qr");
      } else {
        // Utilisateur connecté mais pas de profil vendeur -> on demande la table
        setStep("setup");
      }
    } catch (err) {
      console.error(err);
    }
  };

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
        // Si l'email confirmation est désactivée dans Supabase, ça connecte direct.
        // Sinon, il faudra dire à l'utilisateur d'aller vérifier ses mails.
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
        options: {
          redirectTo: window.location.origin + "/vendeur", // Ajuste selon ta route
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // --- SETUP PROFILE (Nouveau Vendeur) ---
  const handleSetupProfile = async () => {
    setError("");
    if (!table.trim()) {
      setError("Le numéro de table est requis");
      return;
    }
    setLoading(true);

    try {
      const qrCode = `VND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      
      const { data: newVendor, error: insertError } = await supabase
        .from("vendeurs")
        .insert({
          id: session.user.id, // On lie au compte Auth
          email: session.user.email,
          numero_table: parseInt(table),
          qr_code: qrCode,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setVendorData(newVendor);
      setStep("qr");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // --- LOGOUT ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- STATS & REALTIME (Inchangé, juste encadré par useCallback) ---
  const loadStats = useCallback(async () => {
    if (!vendorData) return;
    const { data: ventes } = await supabase
      .from("ventes")
      .select("*, acheteurs(pseudo)")
      .eq("vendeur_id", vendorData.id)
      .order("created_at", { ascending: false });

    if (ventes) {
      setRecentVentes(ventes);
      setStats({
        totalVentes: ventes.length,
        totalCartes: ventes.reduce((s, v) => s + v.nombre_cartes, 0),
        totalScans: ventes.length,
        totalCA: ventes.reduce((s, v) => s + Number(v.montant), 0),
      });
    }
  }, [vendorData]);

  useEffect(() => {
    if (step === "dashboard") loadStats();
  }, [step, loadStats]);

  useEffect(() => {
    if (!vendorData) return;
    const channel = supabase.channel("vendor-scans")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ventes", filter: `vendeur_id=eq.${vendorData.id}` }, 
      () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendorData, loadStats]);

  // --- ENREGISTRER VENTE (Inchangé) ---
  const handleVenteSubmit = async () => {
    // ... Garde exactement le même code que dans ta version précédente
  };

  const qrImageUrl = vendorData ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(QR_PREFIX + vendorData.qr_code)}&color=07033A&bgcolor=ffffff` : "";

  // =============================================
  // RENDER: LOADING
  // =============================================
  if (step === "loading") {
    return <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>Chargement...</div>;
  }

  // =============================================
  // RENDER: LOGIN / SIGNUP
  // =============================================
  if (step === "login") {
    return (
      <div className="animate-fade-in" style={{
        display: "flex", flexDirection: "column",
        justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 24,
      }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Espace vendeur
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
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
          </div>

          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 13, fontWeight: 500 }}>{error}</div>}

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
  // RENDER: SETUP PROFILE (Nouveau compte)
  // =============================================
  if (step === "setup") {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", gap: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dernière étape !</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>Quel est ton numéro de table pour ce salon ?</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>N° de table</label>
            <input type="number" value={table} onChange={e => setTable(e.target.value)} placeholder="Ex: 14" style={inputStyle} />
          </div>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(226,75,74,0.1)", color: "#E24B4A", fontSize: 13, fontWeight: 500 }}>{error}</div>}
          <button onClick={handleSetupProfile} disabled={loading} style={{ ...btnPrimary }}>Confirmer</button>
          <button onClick={handleLogout} style={btnLink}>Annuler et se déconnecter</button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: QR & DASHBOARD (Garde tes return actuels)
  // =============================================
  // Ici tu colles exactement le même code que tout à l'heure pour `step === "qr"` et le retour du `Dashboard`.
  // La seule différence est le bouton de déconnexion qui appelle maintenant `handleLogout` (qui est asynchrone).
  
  return (
    <div>{/* Remplace par ton code QR et Dashboard */}</div>
  );
}

// --- SHARED STYLES ---
// (Garde tes styles actuels)