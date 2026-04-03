"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, QR_PREFIX, calcPoints } from "@/lib/supabase";

export default function VendeurPage() {
  // --- STATE ---
  const [step, setStep] = useState("login"); // login | qr | dashboard
  const [vendorId, setVendorId] = useState("");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [vendorData, setVendorData] = useState(null);

  // Dashboard stats
  const [stats, setStats] = useState({ totalVentes: 0, totalCartes: 0, totalScans: 0, totalCA: 0 });
  const [recentVentes, setRecentVentes] = useState([]);

  // Popup vente (quand un acheteur scanne)
  const [showVentePopup, setShowVentePopup] = useState(false);
  const [venteAcheteur, setVenteAcheteur] = useState("");
  const [venteCartes, setVenteCartes] = useState("");
  const [venteMontant, setVenteMontant] = useState("");
  const [venteLoading, setVenteLoading] = useState(false);
  const [venteSuccess, setVenteSuccess] = useState(null);

  // --- CHECK SESSION ---
  useEffect(() => {
    const stored = localStorage.getItem("salon-vendeur");
    if (stored) {
      const data = JSON.parse(stored);
      setVendorData(data);
      setStep("qr");
    }
  }, []);

  // --- GENERATE QR URL ---
  const qrImageUrl = vendorData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(QR_PREFIX + vendorData.qr_code)}&color=07033A&bgcolor=ffffff`
    : "";

  // --- LOAD STATS ---
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

  // --- REALTIME : écouter les scans entrants ---
  useEffect(() => {
    if (!vendorData) return;

    const channel = supabase
      .channel("vendor-scans")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ventes",
          filter: `vendeur_id=eq.${vendorData.id}`,
        },
        async (payload) => {
          // Un acheteur vient de scanner — on refresh les stats
          loadStats();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [vendorData, loadStats]);

  // --- LOGIN ---
  const handleLogin = async () => {
    setError("");
    if (!vendorId.trim() || !email.trim() || !table.trim()) {
      setError("Tous les champs sont requis");
      return;
    }
    setLoading(true);

    try {
      // Check if vendor exists
      const { data: existing } = await supabase
        .from("vendeurs")
        .select("*")
        .eq("vendor_id", vendorId.trim().toUpperCase())
        .single();

      if (existing) {
        // Login existant
        setVendorData(existing);
        localStorage.setItem("salon-vendeur", JSON.stringify(existing));
        setStep("qr");
      } else {
        // Créer nouveau vendeur
        const qrCode = `VND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const { data: newVendor, error: insertError } = await supabase
          .from("vendeurs")
          .insert({
            vendor_id: vendorId.trim().toUpperCase(),
            email: email.trim().toLowerCase(),
            numero_table: parseInt(table),
            qr_code: qrCode,
          })
          .select()
          .single();

        if (insertError) {
          setError(insertError.message.includes("unique")
            ? "Cet ID ou email existe déjà"
            : insertError.message);
        } else {
          setVendorData(newVendor);
          localStorage.setItem("salon-vendeur", JSON.stringify(newVendor));
          setStep("qr");
        }
      }
    } catch (err) {
      setError("Erreur de connexion");
    }
    setLoading(false);
  };

  // --- ENREGISTRER VENTE (popup) ---
  const handleVenteSubmit = async () => {
    const nb = parseInt(venteCartes) || 0;
    const mt = parseFloat(venteMontant) || 0;
    if (nb <= 0 && mt <= 0) return;
    if (!venteAcheteur.trim()) return;

    setVenteLoading(true);
    try {
      // Trouver l'acheteur par pseudo
      const { data: acheteur, error: acheteurError } = await supabase
        .from("acheteurs")
        .select("*")
        .eq("pseudo", venteAcheteur.trim())
        .single();

      if (acheteurError || !acheteur) {
        setVenteSuccess("Pseudo acheteur introuvable");
        setVenteLoading(false);
        return;
      }

      // Appeler la fonction Supabase
      const { data, error: rpcError } = await supabase.rpc("enregistrer_vente", {
        p_vendeur_id: vendorData.id,
        p_acheteur_id: acheteur.id,
        p_nombre_cartes: nb,
        p_montant: mt,
      });

      if (rpcError) {
        setVenteSuccess("Erreur : " + rpcError.message);
      } else {
        const pts = calcPoints(nb, mt);
        setVenteSuccess(`+${pts} pts attribués à ${venteAcheteur} !`);
        setTimeout(() => {
          setShowVentePopup(false);
          setVenteAcheteur("");
          setVenteCartes("");
          setVenteMontant("");
          setVenteSuccess(null);
          loadStats();
        }, 2000);
      }
    } catch (err) {
      setVenteSuccess("Erreur réseau");
    }
    setVenteLoading(false);
  };

  // --- LOGOUT ---
  const handleLogout = () => {
    localStorage.removeItem("salon-vendeur");
    setVendorData(null);
    setStep("login");
    setVendorId("");
    setEmail("");
    setTable("");
  };

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
            Espace vendeur
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Connexion</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>ID Vendeur</label>
            <input
              type="text" value={vendorId}
              onChange={e => setVendorId(e.target.value)}
              placeholder="Ex: JOHN-CARDS"
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
          <div>
            <label style={labelStyle}>N° de table</label>
            <input
              type="number" value={table}
              onChange={e => setTable(e.target.value)}
              placeholder="Ex: 14"
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
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Connexion..." : "Confirmer"}
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: QR CODE
  // =============================================
  if (step === "qr") {
    return (
      <div className="animate-fade-in" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "100dvh", padding: "32px 24px", gap: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 3,
            color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6,
          }}>
            Table {vendorData?.numero_table}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {vendorData?.vendor_id}
          </h2>
        </div>

        {/* QR Code - big */}
        <div style={{
          padding: 24, borderRadius: 20, background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <img src={qrImageUrl} alt="QR Code" width={280} height={280} style={{ width: 280, height: 280 }} />
          <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", letterSpacing: 0.5 }}>
            {vendorData?.qr_code}
          </div>
        </div>

        <div style={{
          padding: "10px 20px", borderRadius: 10,
          background: "rgba(249,105,39,0.1)", color: "var(--accent)",
          fontSize: 13, fontWeight: 500, textAlign: "center",
        }}>
          Les acheteurs scannent ce QR après chaque achat
        </div>

        {/* Bouton enregistrer vente manuellement */}
        <button
          onClick={() => setShowVentePopup(true)}
          style={{
            ...btnPrimary,
            background: "var(--success)",
            width: "100%", maxWidth: 320,
          }}
        >
          Enregistrer une vente
        </button>

        {/* Bouton dashboard */}
        <button
          onClick={() => { setStep("dashboard"); loadStats(); }}
          style={{
            ...btnSecondary,
            width: "100%", maxWidth: 320,
          }}
        >
          Dashboard
        </button>

        <button onClick={handleLogout} style={btnLink}>
          Déconnexion
        </button>

        {/* POPUP VENTE */}
        {showVentePopup && (
          <div style={overlayStyle}>
            <div className="animate-slide-up" style={popupStyle}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>
                Enregistrer une vente
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Pseudo acheteur</label>
                  <input
                    type="text" value={venteAcheteur}
                    onChange={e => setVenteAcheteur(e.target.value)}
                    placeholder="Pseudo de l'acheteur"
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nb de cartes</label>
                    <input
                      type="number" value={venteCartes}
                      onChange={e => setVenteCartes(e.target.value)}
                      placeholder="0" min="0"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Montant (€)</label>
                    <input
                      type="number" value={venteMontant}
                      onChange={e => setVenteMontant(e.target.value)}
                      placeholder="0" min="0" step="0.5"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Preview points */}
                {((parseInt(venteCartes) > 0) || (parseFloat(venteMontant) > 0)) && (
                  <div style={{
                    padding: "10px", borderRadius: 10, textAlign: "center",
                    background: "rgba(29,158,117,0.1)", color: "var(--success)",
                    fontSize: 15, fontWeight: 600,
                  }}>
                    +{calcPoints(parseInt(venteCartes) || 0, parseFloat(venteMontant) || 0)} points
                  </div>
                )}

                {venteSuccess && (
                  <div style={{
                    padding: "10px", borderRadius: 10, textAlign: "center",
                    background: venteSuccess.includes("Erreur") || venteSuccess.includes("introuvable")
                      ? "rgba(226,75,74,0.1)" : "rgba(29,158,117,0.1)",
                    color: venteSuccess.includes("Erreur") || venteSuccess.includes("introuvable")
                      ? "#E24B4A" : "var(--success)",
                    fontSize: 14, fontWeight: 600,
                  }}>
                    {venteSuccess}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setShowVentePopup(false);
                      setVenteAcheteur(""); setVenteCartes(""); setVenteMontant("");
                      setVenteSuccess(null);
                    }}
                    style={{ ...btnSecondary, flex: 1 }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleVenteSubmit}
                    disabled={venteLoading}
                    style={{ ...btnPrimary, flex: 2, background: "var(--success)" }}
                  >
                    {venteLoading ? "..." : "Confirmer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =============================================
  // RENDER: DASHBOARD
  // =============================================
  return (
    <div className="animate-fade-in" style={{ padding: "32px 24px", paddingBottom: 100 }}>
      <button onClick={() => setStep("qr")} style={{ ...btnLink, marginBottom: 16 }}>
        ← Retour au QR
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px" }}>
        Dashboard
      </h2>

      {/* Stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28,
      }}>
        {[
          { label: "Ventes", value: stats.totalVentes, color: "var(--accent)" },
          { label: "Cartes vendues", value: stats.totalCartes, color: "var(--success)" },
          { label: "Scans", value: stats.totalScans, color: "#7C5CFC" },
          { label: "CA total", value: `${stats.totalCA.toFixed(0)}€`, color: "#F96927" },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "18px 16px", borderRadius: 14,
            background: "var(--bg-card)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent sales */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12,
        letterSpacing: 1, textTransform: "uppercase" }}>
        Historique des ventes
      </h3>

      {recentVentes.length === 0 ? (
        <div style={{
          padding: 24, textAlign: "center", borderRadius: 14,
          background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14,
        }}>
          Aucune vente pour le moment
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentVentes.map((v, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {v.acheteurs?.pseudo || "Acheteur"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {v.nombre_cartes} carte{v.nombre_cartes > 1 ? "s" : ""} — {Number(v.montant).toFixed(0)}€ —{" "}
                  {new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>
                +{v.points_gagnes} pts
              </div>
            </div>
          ))}
        </div>
      )}
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
  transition: "border-color 0.2s",
};

const btnPrimary = {
  padding: "16px 24px", borderRadius: 14, border: "none",
  background: "var(--accent)", color: "#fff",
  fontSize: 16, fontWeight: 600, cursor: "pointer",
  transition: "transform 0.15s",
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
