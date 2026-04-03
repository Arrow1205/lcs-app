"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, QR_PREFIX, TIERS, calcPoints, getCurrentTier, getNextTier, ADMIN_CODE } from "../../lib/supabase";

export default function AcheteurPage() {
  const [step, setStep] = useState("login"); // login | main
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [acheteurData, setAcheteurData] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [pointsAnim, setPointsAnim] = useState(null);

  // Admin reset
  const [showReset, setShowReset] = useState(false);
  const [resetCode, setResetCode] = useState("");

  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  // --- CHECK SESSION ---
  useEffect(() => {
    const stored = localStorage.getItem("salon-acheteur");
    if (stored) {
      const data = JSON.parse(stored);
      setAcheteurData(data);
      setStep("main");
    }
  }, []);

  // --- LOAD DATA ---
  const loadData = useCallback(async () => {
    if (!acheteurData) return;

    // Refresh acheteur
    const { data: fresh } = await supabase
      .from("acheteurs")
      .select("*")
      .eq("id", acheteurData.id)
      .single();
    if (fresh) {
      setAcheteurData(fresh);
      localStorage.setItem("salon-acheteur", JSON.stringify(fresh));
    }

    // Load ventes
    const { data: v } = await supabase
      .from("ventes")
      .select("*, vendeurs(vendor_id, numero_table)")
      .eq("acheteur_id", acheteurData.id)
      .order("created_at", { ascending: false });
    if (v) setVentes(v);
  }, [acheteurData?.id]);

  useEffect(() => {
    if (step === "main" && acheteurData) loadData();
  }, [step, acheteurData?.id]);

  // --- REALTIME : écouter les nouvelles ventes ---
  useEffect(() => {
    if (!acheteurData) return;

    const channel = supabase
      .channel("buyer-ventes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ventes",
          filter: `acheteur_id=eq.${acheteurData.id}`,
        },
        (payload) => {
          setPointsAnim(payload.new.points_gagnes);
          setTimeout(() => setPointsAnim(null), 2000);
          loadData();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [acheteurData?.id, loadData]);

  // --- LOGIN ---
  const handleLogin = async () => {
    setError("");
    if (!pseudo.trim() || !email.trim()) {
      setError("Tous les champs sont requis");
      return;
    }
    setLoading(true);

    try {
      // Check si pseudo existe
      const { data: existing } = await supabase
        .from("acheteurs")
        .select("*")
        .eq("pseudo", pseudo.trim())
        .single();

      if (existing) {
        // Login existant - vérifier email
        if (existing.email !== email.trim().toLowerCase()) {
          setError("Ce pseudo est déjà pris avec un autre email");
          setLoading(false);
          return;
        }
        setAcheteurData(existing);
        localStorage.setItem("salon-acheteur", JSON.stringify(existing));
        setStep("main");
      } else {
        // Check email unique
        const { data: emailCheck } = await supabase
          .from("acheteurs")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .single();

        if (emailCheck) {
          setError("Cet email est déjà utilisé avec un autre pseudo");
          setLoading(false);
          return;
        }

        // Créer nouveau
        const { data: newAcheteur, error: insertError } = await supabase
          .from("acheteurs")
          .insert({
            pseudo: pseudo.trim(),
            email: email.trim().toLowerCase(),
          })
          .select()
          .single();

        if (insertError) {
          setError(insertError.message);
        } else {
          setAcheteurData(newAcheteur);
          localStorage.setItem("salon-acheteur", JSON.stringify(newAcheteur));
          setStep("main");
        }
      }
    } catch (err) {
      setError("Erreur de connexion");
    }
    setLoading(false);
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
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Vérifier que c'est un QR de l'app
          if (!decodedText.startsWith(QR_PREFIX)) {
            setScanResult({ error: "Ce QR code n'est pas un QR vendeur du salon" });
            return;
          }

          const qrCode = decodedText.replace(QR_PREFIX, "");

          // Trouver le vendeur
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

          // Stopper le scanner
          try { await scanner.stop(); } catch (e) {}
        },
        (errorMessage) => {
          // Scan errors silencieux (normal pendant le scan)
        }
      );
    } catch (err) {
      setScanResult({ error: "Impossible d'accéder à la caméra. Vérifiez les permissions." });
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

  // --- ADMIN RESET ---
  const handleReset = async () => {
    if (resetCode !== ADMIN_CODE) return;
    const tier = getCurrentTier(acheteurData.total_points);
    if (tier) {
      await supabase.rpc("reset_points_admin", {
        p_acheteur_id: acheteurData.id,
        p_tier_label: tier.label,
        p_tier_reward: tier.reward,
      });
    } else {
      await supabase
        .from("acheteurs")
        .update({ total_points: 0, total_achats: 0 })
        .eq("id", acheteurData.id);
    }
    setShowReset(false);
    setResetCode("");
    loadData();
  };

  // --- LOGOUT ---
  const handleLogout = () => {
    localStorage.removeItem("salon-acheteur");
    setAcheteurData(null);
    setStep("login");
    setPseudo("");
    setEmail("");
  };

  const currentTier = acheteurData ? getCurrentTier(Number(acheteurData.total_points)) : null;
  const nextTier = acheteurData ? getNextTier(Number(acheteurData.total_points)) : null;
  const totalPts = Number(acheteurData?.total_points || 0);

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
          <div>
            <label style={labelStyle}>Pseudo (unique)</label>
            <input
              type="text" value={pseudo}
              onChange={e => setPseudo(e.target.value)}
              placeholder="Ex: CardMaster59"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(226,75,74,0.1)", color: "#E24B4A",
              fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              ...btnPrimary,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Connexion..." : "Confirmer"}
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: MAIN
  // =============================================
  return (
    <div className="animate-fade-in" style={{ padding: "24px 20px", paddingBottom: 120 }}>
      {/* Points animation */}
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
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Bonjour</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{acheteurData?.pseudo}</div>
        </div>
        <button onClick={handleLogout} style={btnLink}>Déconnexion</button>
      </div>

      {/* ============ GAMIFICATION ZONE ============ */}
      <div style={{
        padding: 24, borderRadius: 20,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        marginBottom: 20, textAlign: "center",
      }}>
        {/* Points ring */}
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ margin: "0 auto 12px" }}>
          <circle cx="65" cy="65" r="54" fill="none" stroke="var(--border)" strokeWidth="7" />
          <circle
            cx="65" cy="65" r="54" fill="none"
            stroke={totalPts >= 50 ? "#E24B4A" : "var(--accent)"}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={2 * Math.PI * 54 * (1 - Math.min(totalPts / 50, 1))}
            transform="rotate(-90 65 65)"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
          <text x="65" y="60" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 26, fontWeight: 700, fill: "var(--text)" }}>
            {totalPts}
          </text>
          <text x="65" y="82" textAnchor="middle"
            style={{ fontSize: 10, fontWeight: 500, fill: "var(--text-muted)", letterSpacing: 1 }}>
            POINTS
          </text>
        </svg>

        {/* Current tier */}
        {currentTier && (
          <div style={{
            display: "inline-block", padding: "6px 16px", borderRadius: 20,
            background: "var(--accent)", color: "#fff",
            fontSize: 13, fontWeight: 600, marginBottom: 8,
          }}>
            {currentTier.label}
          </div>
        )}

        {/* Next tier */}
        {nextTier && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {Math.round((nextTier.min - totalPts) * 10) / 10} pts
            </span>
            {" "}avant{" "}
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>{nextTier.label}</span>
          </div>
        )}
      </div>

      {/* Tiers list */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 8, marginBottom: 24,
      }}>
        {TIERS.map((t, i) => {
          const reached = totalPts >= t.min;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              background: reached ? "rgba(249,105,39,0.08)" : "var(--bg-card)",
              border: `1px solid ${reached ? "var(--accent)" : "var(--border)"}`,
              opacity: reached ? 1 : 0.5,
              transition: "all 0.3s",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: reached ? "var(--accent)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0,
              }}>
                {reached ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: reached ? "var(--accent)" : "var(--text-muted)" }}>
                  {t.label} — {t.min} pts
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {t.reward}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ SCAN BUTTON ============ */}
      <button
        onClick={startScanner}
        className="animate-pulse-soft"
        style={{
          width: "100%", padding: "20px", borderRadius: 16,
          border: "none", background: "var(--accent)", color: "#fff",
          fontSize: 18, fontWeight: 700, cursor: "pointer",
          marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
        Scanner un QR vendeur
      </button>

      {/* Scanner overlay */}
      {scanning && (
        <div style={overlayStyle}>
          <div className="animate-slide-up" style={{
            ...popupStyle,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Scanner</h3>
              <button onClick={stopScanner} style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "1px solid var(--border)", background: "var(--bg-card)",
                fontSize: 18, cursor: "pointer", color: "var(--text)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                ✕
              </button>
            </div>

            <div id="qr-reader-container" style={{
              width: "100%", borderRadius: 16, overflow: "hidden",
              background: "#000", minHeight: 280,
            }} />

            {scanResult?.error && (
              <div style={{
                padding: "12px", borderRadius: 10,
                background: "rgba(226,75,74,0.1)", color: "#E24B4A",
                fontSize: 14, fontWeight: 500, textAlign: "center",
              }}>
                {scanResult.error}
              </div>
            )}

            {scanResult?.vendeur && (
              <ScanConfirm
                vendeur={scanResult.vendeur}
                acheteurId={acheteurData.id}
                onDone={() => {
                  stopScanner();
                  loadData();
                }}
                onCancel={stopScanner}
              />
            )}
          </div>
        </div>
      )}

      {/* ============ STATS ============ */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24,
      }}>
        <div style={statCard}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
            {acheteurData?.total_achats || 0}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Achats</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>
            {ventes.reduce((s, v) => s + v.nombre_cartes, 0)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Cartes achetées</div>
        </div>
      </div>

      {/* ============ HISTORIQUE ============ */}
      <h3 style={sectionTitle}>Historique d'achats</h3>

      {ventes.length === 0 ? (
        <div style={{
          padding: 24, textAlign: "center", borderRadius: 14,
          background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14,
        }}>
          Aucun achat pour le moment. Scannez un QR vendeur !
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {ventes.map((v, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {v.vendeurs?.vendor_id || "Vendeur"} — Table {v.vendeurs?.numero_table}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {v.nombre_cartes} carte{v.nombre_cartes > 1 ? "s" : ""} — {Number(v.montant).toFixed(0)}€ —{" "}
                  {new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap" }}>
                +{v.points_gagnes} pts
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin reset */}
      <button
        onClick={() => setShowReset(true)}
        style={{
          width: "100%", padding: "12px", borderRadius: 10,
          border: "1px dashed var(--border)", background: "transparent",
          color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
        }}
      >
        Admin : reset points (code organisateur)
      </button>

      {showReset && (
        <div style={overlayStyle}>
          <div className="animate-slide-up" style={popupStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px", color: "#E24B4A" }}>
              Reset admin
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Entrez le code admin pour remettre les points à zéro après récupération du lot.
            </p>
            <input
              type="text" value={resetCode}
              onChange={e => setResetCode(e.target.value)}
              placeholder="Code admin..."
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowReset(false); setResetCode(""); }}
                style={{ ...btnSecondary, flex: 1 }}>
                Annuler
              </button>
              <button onClick={handleReset}
                disabled={resetCode !== ADMIN_CODE}
                style={{
                  ...btnPrimary, flex: 2,
                  background: resetCode === ADMIN_CODE ? "#E24B4A" : "rgba(128,128,128,0.2)",
                  color: resetCode === ADMIN_CODE ? "#fff" : "var(--text-muted)",
                }}>
                Confirmer le reset
              </button>
            </div>
          </div>
        </div>
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
      <div style={{
        padding: "12px 16px", borderRadius: 12,
        background: "rgba(249,105,39,0.08)", border: "1px solid var(--accent)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
          {vendeur.vendor_id}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Table {vendeur.numero_table}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Nb de cartes</label>
          <input
            type="number" value={cartes}
            onChange={e => setCartes(e.target.value)}
            placeholder="0" min="0" autoFocus
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Montant (€)</label>
          <input
            type="number" value={montant}
            onChange={e => setMontant(e.target.value)}
            placeholder="0" min="0" step="0.5"
            style={inputStyle}
          />
        </div>
      </div>

      {((parseInt(cartes) > 0) || (parseFloat(montant) > 0)) && (
        <div style={{
          padding: "10px", borderRadius: 10, textAlign: "center",
          background: "rgba(29,158,117,0.1)", color: "var(--success)",
          fontSize: 16, fontWeight: 700,
        }}>
          +{calcPoints(parseInt(cartes) || 0, parseFloat(montant) || 0)} points
        </div>
      )}

      {result && (
        <div style={{
          padding: "10px", borderRadius: 10, textAlign: "center",
          background: result.includes("Erreur") ? "rgba(226,75,74,0.1)" : "rgba(29,158,117,0.1)",
          color: result.includes("Erreur") ? "#E24B4A" : "var(--success)",
          fontSize: 14, fontWeight: 600,
        }}>
          {result}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
        <button onClick={handleConfirm} disabled={loading}
          style={{ ...btnPrimary, flex: 2, background: "var(--success)" }}>
          {loading ? "..." : "Confirmer l'achat"}
        </button>
      </div>
    </div>
  );
}

// --- SHARED STYLES ---
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "var(--text-muted)", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: 0.5,
};

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text)", fontSize: 15, outline: "none",
};

const btnPrimary = {
  padding: "16px 24px", borderRadius: 14, border: "none",
  background: "var(--accent)", color: "#fff",
  fontSize: 16, fontWeight: 600, cursor: "pointer",
};

const btnSecondary = {
  padding: "14px 24px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "transparent",
  color: "var(--text)", fontSize: 14, fontWeight: 500, cursor: "pointer",
};

const btnLink = {
  padding: 0, border: "none", background: "transparent",
  color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
  textDecoration: "underline",
};

const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 999,
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
  padding: 16,
};

const popupStyle = {
  width: "100%", maxWidth: 420, padding: 24, borderRadius: 20,
  background: "var(--bg)", border: "1px solid var(--border)",
  maxHeight: "85vh", overflowY: "auto",
};

const statCard = {
  padding: "18px 16px", borderRadius: 14,
  background: "var(--bg-card)", border: "1px solid var(--border)",
};

const sectionTitle = {
  fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12,
  letterSpacing: 1, textTransform: "uppercase",
};
