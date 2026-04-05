"use client";
import { useState, useEffect, useRef } from "react";
import { supabase, ADMIN_CODE } from "@/lib/supabase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ['#F96927', '#1D9E75', '#7C5CFC', '#E24B4A', '#F1C40F'];

export default function AdminPage() {
  const [step, setStep] = useState("login");
  const [pwd, setPwd] = useState("");
  const [activeTab, setActiveTab] = useState("vendeurs");
  const [vendeurs, setVendeurs] = useState([]);
  const [acheteurs, setAcheteurs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [sortConfigV, setSortConfigV] = useState({ key: 'totalRevenue', direction: 'desc' });
  const [sortConfigA, setSortConfigA] = useState({ key: 'totalSpent', direction: 'desc' });

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const html5QrRef = useRef(null);

  const handleLogin = () => {
    if (pwd === ADMIN_CODE) { setStep("dashboard"); loadData(); } 
    else { alert("Code incorrect"); }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: vData } = await supabase.from("vendeurs").select("*, ventes(nombre_cartes, nombre_scelles, montant)");
    setVendeurs((vData || []).map(v => ({
      ...v,
      totalCards: v.ventes?.reduce((sum, x) => sum + x.nombre_cartes, 0) || 0,
      totalScelles: v.ventes?.reduce((sum, x) => sum + (x.nombre_scelles || 0), 0) || 0,
      totalRevenue: v.ventes?.reduce((sum, x) => sum + Number(x.montant), 0) || 0
    })));

    const { data: aData } = await supabase.from("acheteurs").select("*, ventes(nombre_cartes, nombre_scelles, montant)");
    setAcheteurs((aData || []).map(a => ({
      ...a,
      totalCards: a.ventes?.reduce((sum, x) => sum + x.nombre_cartes, 0) || 0,
      totalScelles: a.ventes?.reduce((sum, x) => sum + (x.nombre_scelles || 0), 0) || 0,
      totalSpent: a.ventes?.reduce((sum, x) => sum + Number(x.montant), 0) || 0
    })));
    setLoading(false);
  };

  const sortData = (data, sortConfig) => {
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const requestSortV = (key) => {
    let direction = 'asc';
    if (sortConfigV.key === key && sortConfigV.direction === 'asc') direction = 'desc';
    setSortConfigV({ key, direction });
  };

  const requestSortA = (key) => {
    let direction = 'asc';
    if (sortConfigA.key === key && sortConfigA.direction === 'asc') direction = 'desc';
    setSortConfigA({ key, direction });
  };

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const cleanData = data.map(({ ventes, ...rest }) => rest);
    const headers = Object.keys(cleanData[0]).join(";");
    const csv = cleanData.map(row => Object.values(row).map(val => `"${val}"`).join(";")).join("\n");
    const blob = new Blob([headers + "\n" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("admin-qr-reader");
    html5QrRef.current = scanner;
    
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
      const buyerId = new URLSearchParams(txt.split("?")[1])?.get("buyer");
      if (buyerId) {
        const { data } = await supabase.from("acheteurs").select("*").eq("id", buyerId).maybeSingle();
        setScanResult({ acheteur: data });
        await scanner.stop();
      }
    }, () => {});
  };

  const stopScanner = async () => {
    if (html5QrRef.current) { try { await html5QrRef.current.stop(); } catch(e) {} }
    setScanning(false);
    setScanResult(null);
  }

  const sortedVendeurs = sortData(vendeurs, sortConfigV);
  const sortedAcheteurs = sortData(acheteurs, sortConfigA);
  const top5Acheteurs = [...acheteurs].sort((a,b) => b.totalSpent - a.totalSpent).slice(0, 5);
  
  const zonesMap = {};
  vendeurs.forEach(v => { if (v.zone) zonesMap[v.zone] = (zonesMap[v.zone] || 0) + 1; });
  const pieData = Object.keys(zonesMap).map(key => ({ name: key, value: zonesMap[key] }));

  if (step === "login") return (
    <div style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <h1 style={{ margin: 0 }}>Accès Admin</h1>
      </div>
      <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Code secret..." style={inputStyle} />
      <button onClick={handleLogin} style={btnPrimary}>Se connecter</button>
    </div>
  );

  return (
    <div style={{ padding: "20px 20px 120px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button onClick={() => { setStep("login"); setPwd(""); }} style={btnLink}>Quitter</button>
      </div>

      <div style={tabsContainer}>
        <button onClick={() => setActiveTab("vendeurs")} style={activeTab === "vendeurs" ? activeTabStyle : inactiveTabStyle}>Vendeurs</button>
        <button onClick={() => setActiveTab("acheteurs")} style={activeTab === "acheteurs" ? activeTabStyle : inactiveTabStyle}>Acheteurs</button>
      </div>

      {loading ? <p style={{textAlign: "center"}}>Chargement...</p> : (
        <div className="animate-fade-in">
          
          {activeTab === "vendeurs" && (
            <>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, border: "1px solid #eee", textAlign: "center", color: "#000" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>Répartition des Zones</h3>
                {pieData.length > 0 ? (
                  <div style={{ height: 250, width: "100%" }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p>Aucune donnée</p>}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Liste des Vendeurs</h3>
                <button onClick={() => exportCSV(sortedVendeurs, "vendeurs")} style={btnSecondary}>Exporter CSV</button>
              </div>

              <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #eee" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle} onClick={() => requestSortV('numero_table')}>Table ↕</th>
                      <th style={thStyle} onClick={() => requestSortV('zone')}>Zone ↕</th>
                      <th style={thStyle} onClick={() => requestSortV('email')}>Vendeur ↕</th>
                      <th style={thStyle} onClick={() => requestSortV('totalCards')}>Cartes ↕</th>
                      <th style={thStyle} onClick={() => requestSortV('totalScelles')}>Scellés ↕</th>
                      <th style={thStyle} onClick={() => requestSortV('totalRevenue')}>€ ↕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVendeurs.map(v => (
                      <tr key={v.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={tdStyle}><strong>{v.numero_table}</strong></td>
                        <td style={tdStyle}>{v.zone || "-"}</td>
                        <td style={tdStyle}>{v.email}</td>
                        <td style={tdStyle}>{v.totalCards}</td>
                        <td style={tdStyle}>{v.totalScelles}</td>
                        <td style={tdStyle}><span style={{ color: "var(--success, #1D9E75)", fontWeight: "bold" }}>{v.totalRevenue}€</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "acheteurs" && (
            <>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, border: "1px solid #eee" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "var(--accent)" }}>🏆 Top 5 Dépenses</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {top5Acheteurs.map((a, i) => (
                    // CORRECTION DU TEXTE BLANC ICI : ajout de color: "#000"
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: 10, background: i===0?"#FFF5F0":"#f9f9f9", borderRadius: 8, fontWeight: i===0?"bold":"normal", color: "#000" }}>
                      <span>#{i+1} {a.pseudo}</span>
                      <span style={{ color: "var(--success)" }}>{a.totalSpent}€</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Liste des Acheteurs</h3>
                <button onClick={() => exportCSV(sortedAcheteurs, "acheteurs")} style={btnSecondary}>Exporter CSV</button>
              </div>

              <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #eee" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle} onClick={() => requestSortA('pseudo')}>Pseudo ↕</th>
                      <th style={thStyle} onClick={() => requestSortA('total_points')}>Points ↕</th>
                      <th style={thStyle} onClick={() => requestSortA('totalCards')}>Cartes ↕</th>
                      <th style={thStyle} onClick={() => requestSortA('totalScelles')}>Scellés ↕</th>
                      <th style={thStyle} onClick={() => requestSortA('totalSpent')}>Dépensé ↕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAcheteurs.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={tdStyle}><strong>{a.pseudo}</strong></td>
                        <td style={tdStyle}><span style={{ color: "var(--accent, #F96927)", fontWeight: "bold" }}>{a.total_points}</span></td>
                        <td style={tdStyle}>{a.totalCards}</td>
                        <td style={tdStyle}>{a.totalScelles}</td>
                        <td style={tdStyle}>{a.totalSpent}€</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      )}

      <div style={{ position: "fixed", bottom: 24, left: 24, right: 24, maxWidth: 900, margin: "0 auto" }}>
        <button onClick={startScanner} style={{...btnPrimary, background: "var(--accent)"}}>
          📷 Scanner QR Code
        </button>
      </div>

      {scanning && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0, color: "#000" }}>Scanner QR Code</h3>
              <button onClick={stopScanner} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#000" }}>✕</button>
            </div>
            <div id="admin-qr-reader" style={{ width: "100%", minHeight: 250, background: "#000", borderRadius: 12, overflow: "hidden" }} />
            
            {scanResult?.acheteur && (
              <div style={{ marginTop: 15, textAlign: "center", padding: 15, background: "#f9f9f9", borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#000" }}>{scanResult.acheteur.pseudo}</div>
                <div style={{ fontSize: 14, color: "#666", marginBottom: 15 }}>{scanResult.acheteur.total_points} points actuels</div>
                <button onClick={async () => {
                   await supabase.from("acheteurs").update({ total_points: 0 }).eq("id", scanResult.acheteur.id);
                   setScanResult(null); stopScanner(); loadData();
                   alert(`Points remis à zéro !`);
                }} style={{ ...btnPrimary, background: "#E24B4A" }}>
                  Confirmer la remise à zéro
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const containerStyle = { display: "flex", flexDirection: "column", gap: 15, padding: 40, justifyContent: "center", minHeight: "80vh", maxWidth: 400, margin: "0 auto" };
const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #ccc", backgroundColor: "#ffffff", color: "#000000", fontSize: 16, outline: "none", marginBottom: 12 };
const btnPrimary = { padding: 16, borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnSecondary = { padding: "8px 16px", borderRadius: 50, border: "1px solid #ccc", background: "#fff", color: "#000", fontSize: 13, cursor: "pointer" };
const btnLink = { background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "#666" };
const tabsContainer = { display: "flex", gap: 10, marginBottom: 20, background: "#f5f5f5", padding: 6, borderRadius: 50 };
const activeTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "var(--accent)", color: "#fff", transition: "all 0.2s" };
const inactiveTabStyle = { flex: 1, padding: "12px 20px", border: "none", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 14, background: "transparent", color: "#666", transition: "all 0.2s" };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle = { background: "#ffffff", color: "#000000", padding: 24, borderRadius: 20, width: "100%", maxWidth: 400 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left", color: "#000" };
const thStyle = { padding: "12px 10px", color: "#666", fontWeight: "bold", borderBottom: "2px solid #eee", cursor: "pointer" };
const tdStyle = { padding: "12px 10px" };