/**
 * Flight deduplication & terminal classification utilities.
 *
 * The AENA scraper merges codeshares when it sees them in the same row,
 * but sometimes the same physical flight appears as separate entries
 * (e.g. QFA8255 as a standalone row vs UAE255 / ICE6007 in another).
 *
 * This module provides a frontend safety-net dedup that:
 *  1. Merges entries sharing any flight code  (same as scraper logic)
 *  2. Merges "orphan codeshares" – single-code entries with no origin
 *     that fall within ±5 min of another flight at the same terminal
 */

export interface VueloRaw {
  hora: string;
  vuelo: string;
  aerolinea: string;
  origen: string;
  terminal: string;
  sala: string;
  estado: string;
  dia_relativo: number;
}

// ---------------------------------------------------------------------------
// Terminal classification (single source of truth)
// ---------------------------------------------------------------------------

export type TerminalType = "t1" | "t2" | "t2c" | "puente";

export function getTerminalType(vuelo: VueloRaw): TerminalType {
  const terminal = vuelo.terminal?.toUpperCase() || "";
  const codigosVuelo = vuelo.vuelo?.toUpperCase() || "";
  const origen = vuelo.origen?.toUpperCase() || "";

  if (terminal.includes("T2C") || terminal.includes("EASYJET")) return "t2c";
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) return "t2c";
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) return "puente";
  if (terminal.includes("T2A") || terminal.includes("T2B")) return "t2";
  if (terminal.includes("T1")) return "t1";
  return "t2";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" → minutes since midnight */
export function parseHora(hora: string): number {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Extract individual flight codes from "VLG8245 / IBE5041 / ..." */
function extractCodes(vuelo: string): string[] {
  if (!vuelo) return [];
  return vuelo
    .split("/")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c && c !== "N/A");
}

/** AENA state priority – higher = further in the flight lifecycle */
function estadoPriority(estado: string): number {
  const s = (estado || "").toUpperCase();
  if (s.includes("FINALIZ") || s.includes("ATERRI") || s.includes("CINTA")) return 4;
  if (s.includes("SALA")) return 3;
  if (s.includes("RETRAS")) return 2;
  if (s.includes("HORA")) return 1;
  return 0;
}

/** Whether an entry looks like an orphan codeshare */
function isOrphan(v: VueloRaw): boolean {
  const codes = extractCodes(v.vuelo);
  const origenEmpty =
    !v.origen || v.origen === "N/A" || v.origen === "-" || v.origen.trim() === "";
  return codes.length <= 1 && origenEmpty;
}

// ---------------------------------------------------------------------------
// Union-Find for code-based merging
// ---------------------------------------------------------------------------

class UnionFind {
  parent: number[];
  rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

// ---------------------------------------------------------------------------
// Merge two entries into one
// ---------------------------------------------------------------------------

function mergeEntries(base: VueloRaw, extra: VueloRaw): VueloRaw {
  // Merge codes (union, deduplicated, sorted)
  const allCodes = new Set([...extractCodes(base.vuelo), ...extractCodes(extra.vuelo)]);
  const mergedVuelo = Array.from(allCodes).sort().join(" / ");

  // Pick the more advanced state
  const useExtra = estadoPriority(extra.estado) > estadoPriority(base.estado);
  const best = useExtra ? extra : base;
  const other = useExtra ? base : extra;

  return {
    hora: best.hora,
    vuelo: mergedVuelo,
    aerolinea: allCodes.size > 1 ? "Multicompania" : best.aerolinea,
    origen:
      best.origen && best.origen !== "N/A" && best.origen !== "-"
        ? best.origen
        : other.origen,
    terminal:
      best.terminal && best.terminal !== "N/A"
        ? best.terminal
        : other.terminal,
    sala: best.sala || other.sala,
    estado: best.estado,
    dia_relativo: best.dia_relativo,
  };
}

// ---------------------------------------------------------------------------
// Main dedup function
// ---------------------------------------------------------------------------

export function deduplicateFlights(vuelos: VueloRaw[]): VueloRaw[] {
  if (!vuelos || vuelos.length === 0) return [];

  const n = vuelos.length;
  const uf = new UnionFind(n);

  // ---- PHASE 1: Merge entries that share any flight code (within same day) ----
  // Build code → index map, scoped per dia_relativo
  const codeToIdx: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const dia = vuelos[i].dia_relativo;
    const codes = extractCodes(vuelos[i].vuelo);
    for (const code of codes) {
      const key = `${dia}|${code}`;
      if (key in codeToIdx) {
        uf.union(i, codeToIdx[key]);
      } else {
        codeToIdx[key] = i;
      }
    }
  }

  // ---- PHASE 2: Merge orphan codeshares into nearby parent flights ----
  for (let i = 0; i < n; i++) {
    if (!isOrphan(vuelos[i])) continue;

    const orphanMin = parseHora(vuelos[i].hora);
    const orphanDia = vuelos[i].dia_relativo;
    const orphanTerm = getTerminalType(vuelos[i]);

    let bestMatch = -1;
    let bestDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (vuelos[j].dia_relativo !== orphanDia) continue;
      if (isOrphan(vuelos[j])) continue; // don't merge orphan with orphan
      if (getTerminalType(vuelos[j]) !== orphanTerm) continue;

      const dist = Math.abs(parseHora(vuelos[j].hora) - orphanMin);
      if (dist <= 5 && dist < bestDist) {
        bestDist = dist;
        bestMatch = j;
      }
    }

    if (bestMatch >= 0) {
      uf.union(i, bestMatch);
    }
  }

  // ---- Collect groups and merge ----
  const groups: Record<number, number[]> = {};
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups[root]) groups[root] = [];
    groups[root].push(i);
  }

  const result: VueloRaw[] = [];
  for (const indices of Object.values(groups)) {
    let merged = vuelos[indices[0]];
    for (let k = 1; k < indices.length; k++) {
      merged = mergeEntries(merged, vuelos[indices[k]]);
    }
    result.push(merged);
  }

  // Sort by dia_relativo, then hora
  result.sort((a, b) => {
    if (a.dia_relativo !== b.dia_relativo) return a.dia_relativo - b.dia_relativo;
    return parseHora(a.hora) - parseHora(b.hora);
  });

  return result;
}
