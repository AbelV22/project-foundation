/**
 * Shared train utility functions
 *
 * Centralizes city extraction, train type detection, and color mapping
 * so every view is consistent.
 */

// ─── City extraction ────────────────────────────────────────────────
const CITY_RULES: [test: (l: string) => boolean, label: string][] = [
  [(l) => l.includes("madrid"), "Madrid"],
  [(l) => l.includes("sevilla"), "Sevilla"],
  [(l) => l.includes("málaga") || l.includes("malaga"), "Málaga"],
  [(l) => l.includes("valència") || l.includes("valencia"), "València"],
  [(l) => l.includes("alacant") || l.includes("alicante"), "Alicante"],
  [(l) => l.includes("figueres"), "Figueres"],
  [(l) => l.includes("paris"), "París"],
  [(l) => l.includes("marseille") || l.includes("marsella"), "Marsella"],
  [(l) => l.includes("lyon"), "Lyon"],
  [(l) => l.includes("donostia") || l.includes("san sebastián") || l.includes("san sebastian"), "Donostia"],
  [(l) => l.includes("zaragoza"), "Zaragoza"],
  [(l) => l.includes("granada"), "Granada"],
  [(l) => l.includes("córdoba") || l.includes("cordoba"), "Córdoba"],
  [(l) => l.includes("cádiz") || l.includes("cadiz"), "Cádiz"],
  [(l) => l.includes("girona"), "Girona"],
  [(l) => l.includes("camp de tarragona") || l.includes("tarragona"), "Tarragona"],
  [(l) => l.includes("lleida"), "Lleida"],
  [(l) => l.includes("vigo"), "Vigo"],
  [(l) => l.includes("huesca"), "Huesca"],
  [(l) => l.includes("pamplona") || l.includes("iruña"), "Pamplona"],
];

export const getCiudad = (origen: string): string => {
  if (!origen) return "";
  const lower = origen.toLowerCase();
  for (const [test, label] of CITY_RULES) {
    if (test(lower)) return label;
  }
  // Fallback: first word before space or hyphen
  return origen.split(" ")[0].split("-")[0];
};

// ─── Train type detection ───────────────────────────────────────────
// Known operator keywords ordered by specificity (AVLO before AVE).
const OPERATOR_KEYWORDS = [
  "AVLO",
  "AVE",
  "IRYO",
  "OUIGO",
  "EUROMED",
  "ALVIA",
  "INTERCITY",
  "TGV",
  "LD",
] as const;

export type TrainOperator = (typeof OPERATOR_KEYWORDS)[number];

/**
 * Extract the operator name from the `tren` field.
 *
 * The scraper outputs values like "AVE 03062" or "EUROMED 01081".
 * Earlier code incorrectly split on "\n" which never matched.
 */
export const getTipoTren = (tren: string): string => {
  if (!tren) return "";
  const upper = tren.toUpperCase();
  // Also handle legacy scraped data that may contain "IL -" prefix for IRYO
  if (upper.includes("IL -") || upper.includes("IRYO")) return "IRYO";
  for (const kw of OPERATOR_KEYWORDS) {
    if (upper.includes(kw)) return kw;
  }
  // Fallback: first token
  return tren.split(" ")[0].trim();
};

/**
 * Extract the train number from the `tren` field.
 *
 * "AVE 03062" → "03062"
 * "EUROMED 01081" → "01081"
 */
export const getNumeroTren = (tren: string): string => {
  if (!tren) return "";
  // Remove operator prefix and return the rest
  const tipo = getTipoTren(tren);
  const rest = tren.replace(tipo, "").trim();
  return rest;
};

// ─── Color mapping ──────────────────────────────────────────────────
const TEXT_COLORS: Record<string, string> = {
  AVE: "text-red-500",
  AVLO: "text-red-400",
  IRYO: "text-purple-500",
  OUIGO: "text-pink-500",
  EUROMED: "text-blue-500",
  ALVIA: "text-teal-500",
  TGV: "text-indigo-500",
  INTERCITY: "text-orange-500",
  LD: "text-amber-600",
};

const BG_COLORS: Record<string, string> = {
  AVE: "bg-red-500/10",
  AVLO: "bg-red-400/10",
  IRYO: "bg-purple-500/10",
  OUIGO: "bg-pink-500/10",
  EUROMED: "bg-blue-500/10",
  ALVIA: "bg-teal-500/10",
  TGV: "bg-indigo-500/10",
  INTERCITY: "bg-orange-500/10",
  LD: "bg-amber-600/10",
};

/**
 * Returns a Tailwind text-color class for the given train string or operator name.
 * Accepts either a full tren field ("AVE 03062") or an already-extracted operator ("AVE").
 */
export const getTrenColor = (trenOrOperator: string): string => {
  // If it's already a known operator key, use it directly
  if (TEXT_COLORS[trenOrOperator]) return TEXT_COLORS[trenOrOperator];
  // Otherwise extract operator first
  const tipo = getTipoTren(trenOrOperator);
  return TEXT_COLORS[tipo] || "text-emerald-500";
};

export const getTrenBgColor = (trenOrOperator: string): string => {
  if (BG_COLORS[trenOrOperator]) return BG_COLORS[trenOrOperator];
  const tipo = getTipoTren(trenOrOperator);
  return BG_COLORS[tipo] || "bg-emerald-500/10";
};

// ─── Data normalization ─────────────────────────────────────────────
export interface TrenSants {
  hora: string;
  origen: string;
  tren: string;
  via: string;
}

/**
 * Normalize raw JSON response into TrenSants[].
 * Handles both array format and `{ trenes: [...], meta?: {...} }` object format.
 */
export function normalizeTrenesResponse(
  data: unknown
): { trenes: TrenSants[]; updateTime?: string; updatedAt?: string } {
  let trenesData: TrenSants[];
  let updateTime: string | undefined;
  let updatedAt: string | undefined;

  if (Array.isArray(data)) {
    trenesData = data;
  } else if (data && typeof data === "object" && "trenes" in data) {
    const obj = data as {
      trenes: TrenSants[];
      meta?: { update_time?: string; updated_at?: string };
    };
    trenesData = obj.trenes || [];
    updateTime = obj.meta?.update_time;
    updatedAt = obj.meta?.updated_at;
  } else {
    trenesData = [];
  }

  // Deduplicate (same hora + tren)
  const seen = new Set<string>();
  const unique: TrenSants[] = [];
  for (const t of trenesData) {
    const key = `${t.hora}|${t.tren}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return { trenes: unique, updateTime, updatedAt };
}
