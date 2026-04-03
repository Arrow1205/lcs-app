"use client";
import "./globals.css";
import { useState, useEffect } from "react";

export default function RootLayout({ children }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("salon-theme");
    if (stored) setDark(stored === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("salon-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <html lang="fr" className={dark ? "dark" : ""}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <title>Salon de Cartes 2026</title>
      </head>
      <body>
        {/* Theme toggle - fixed top right */}
        <button
          onClick={() => setDark(!dark)}
          style={{
            position: "fixed", top: 16, right: 16, zIndex: 1000,
            width: 40, height: 40, borderRadius: "50%",
            border: "1.5px solid var(--border)",
            background: "var(--bg-card)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 18,
            transition: "all 0.2s",
          }}
          aria-label="Changer le thème"
        >
          {dark ? "☀️" : "🌙"}
        </button>

        <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
