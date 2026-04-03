import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- TIERS DE GAMIFICATION ---
export const TIERS = [
  { min: 5, label: "Rookie collector", reward: "1 toploader premium offert", color: "#1D9E75" },
  { min: 15, label: "Pro hunter", reward: "1 booster offert", color: "#7C5CFC" },
  { min: 30, label: "Elite trader", reward: "Réduction -20% prochain salon", color: "#F96927" },
  { min: 50, label: "Legend", reward: "Accès VIP + lot surprise", color: "#E24B4A" },
];

export function calcPoints(cards, amount) {
  return Math.round((cards * 0.2 + Math.floor(amount / 10) * 1) * 10) / 10;
}

export function getCurrentTier(pts) {
  let current = null;
  for (const t of TIERS) {
    if (pts >= t.min) current = t;
  }
  return current;
}

export function getNextTier(pts) {
  for (const t of TIERS) {
    if (pts < t.min) return t;
  }
  return null;
}

// Préfixe QR pour valider que c'est bien un QR de l'app
export const QR_PREFIX = "SALONCARTES2026|";
export const ADMIN_CODE = "ADMIN-RESET-2026";
