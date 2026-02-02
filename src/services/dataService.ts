/**
 * Centralized Data Service
 *
 * Provides a single source of truth for all app data with:
 * - Smart caching with TTL
 * - Request deduplication
 * - Auto-refresh intervals
 * - Error handling
 */

// Types
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

export interface TrenSants {
  hora: string;
  tren: string;
  operador: string;
  origen: string;
  destino: string;
  via: string;
  estado: string;
  tipo: string;
}

export interface CrucerosData {
  llegadas: any[];
  salidas: any[];
  resumen: {
    total_cruceros: number;
    total_llegadas: number;
    total_salidas: number;
    pax_estimados_hoy: number;
    proximo_desembarco: string | null;
    proximo_barco: string | null;
  };
  terminales_activas: string[];
  metadata: {
    fuente: string;
    actualizado: string;
    frecuencia: string;
  };
}

export interface LicenciasWebFeed {
  ticker: {
    current_price: number;
    delta_value: number;
    delta_percent: number;
    direction: string;
    volume: number;
    volatility: number;
  };
  charts: {
    history_dates: string[];
    history_prices: number[];
    history_sma_7: number[];
    price_by_day_descanso: Record<string, number>;
  };
  market_depth: {
    cheapest_offers: any[];
    all_offers: any[];
  };
  updated_at: string;
}

export interface EventosBcn {
  id: string;
  titulo: string;
  recinto: string;
  categoria: string;
  fecha: string;
  hora_inicio: string;
  hora_fin_estimada: string;
  latitud: number;
  longitud: number;
  url_ticket: string;
}

// Cache entry with metadata
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
}

// Cache configuration per data type (in milliseconds)
const CACHE_TTL = {
  vuelos: 60 * 1000,           // 1 minute - flights change frequently
  trenes: 60 * 1000,           // 1 minute - trains change frequently
  cruceros: 30 * 60 * 1000,    // 30 minutes - cruises change slowly
  eventos: 60 * 60 * 1000,     // 1 hour - events rarely change
  licencias: 5 * 60 * 1000,    // 5 minutes - license prices update periodically
  historyStats: 60 * 60 * 1000 // 1 hour - historical data
};

// Global cache store
const cache: Map<string, CacheEntry<any>> = new Map();

// In-flight requests (for deduplication)
const pendingRequests: Map<string, Promise<any>> = new Map();

// Subscribers for data updates
type Subscriber<T> = (data: T) => void;
const subscribers: Map<string, Set<Subscriber<any>>> = new Map();

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttl;
}

/**
 * Generic fetch with caching and deduplication
 */
async function fetchWithCache<T>(
  key: string,
  url: string,
  ttl: number,
  transform?: (data: any) => T
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (isCacheValid(cached)) {
    console.log(`[DataService] Cache hit: ${key}`);
    return cached!.data as T;
  }

  // Check if request is already in flight (deduplication)
  const pending = pendingRequests.get(key);
  if (pending) {
    console.log(`[DataService] Deduplicating request: ${key}`);
    return pending;
  }

  // Create new request
  console.log(`[DataService] Fetching: ${key}`);
  const request = fetch(`${url}?t=${Date.now()}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Handle CSV vs JSON
      const isCSV = url.endsWith('.csv');
      const rawData = isCSV ? await res.text() : await res.json();
      const data = transform ? transform(rawData) : rawData;

      // Store in cache
      cache.set(key, { data, timestamp: Date.now(), ttl });

      // Notify subscribers
      notifySubscribers(key, data);

      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}

/**
 * Notify all subscribers of data updates
 */
function notifySubscribers<T>(key: string, data: T) {
  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach(callback => callback(data));
  }
}

/**
 * Subscribe to data updates
 */
export function subscribe<T>(key: string, callback: Subscriber<T>): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(callback);

  // Return unsubscribe function
  return () => {
    subscribers.get(key)?.delete(callback);
  };
}

// ============================================
// PUBLIC API - Data Fetchers
// ============================================

/**
 * Get flights data
 */
export async function getVuelos(): Promise<VueloRaw[]> {
  return fetchWithCache<VueloRaw[]>(
    'vuelos',
    '/vuelos.json',
    CACHE_TTL.vuelos,
    (data) => Array.isArray(data) ? data : []
  );
}

/**
 * Get trains data
 */
export async function getTrenes(): Promise<TrenSants[]> {
  return fetchWithCache<TrenSants[]>(
    'trenes',
    '/trenes_sants.json',
    CACHE_TTL.trenes,
    (data) => {
      if (Array.isArray(data)) return data;
      if (data?.trenes && Array.isArray(data.trenes)) return data.trenes;
      return [];
    }
  );
}

/**
 * Get cruises data
 */
export async function getCruceros(): Promise<CrucerosData> {
  const emptyData: CrucerosData = {
    llegadas: [],
    salidas: [],
    resumen: {
      total_cruceros: 0,
      total_llegadas: 0,
      total_salidas: 0,
      pax_estimados_hoy: 0,
      proximo_desembarco: null,
      proximo_barco: null,
    },
    terminales_activas: [],
    metadata: {
      fuente: "Open Data Port de Barcelona",
      actualizado: new Date().toISOString(),
      frecuencia: "horaria",
    },
  };

  return fetchWithCache<CrucerosData>(
    'cruceros',
    '/cruceros.json',
    CACHE_TTL.cruceros,
    (data) => data || emptyData
  ).catch(() => emptyData);
}

/**
 * Get events data
 */
export async function getEventos(): Promise<EventosBcn[]> {
  return fetchWithCache<EventosBcn[]>(
    'eventos',
    '/eventos_bcn.json',
    CACHE_TTL.eventos,
    (data) => Array.isArray(data) ? data : []
  );
}

/**
 * Get license web feed data
 */
export async function getLicenciasWebFeed(): Promise<LicenciasWebFeed | null> {
  return fetchWithCache<LicenciasWebFeed | null>(
    'licencias',
    '/web_feed.json',
    CACHE_TTL.licencias
  ).catch(() => null);
}

/**
 * Get license history stats (CSV)
 */
export async function getLicenciasHistory(): Promise<string> {
  return fetchWithCache<string>(
    'historyStats',
    '/history_stats.csv',
    CACHE_TTL.historyStats
  ).catch(() => '');
}

/**
 * Get all license data at once
 */
export async function getLicenciasData(): Promise<{
  webFeed: LicenciasWebFeed | null;
  history: string;
}> {
  const [webFeed, history] = await Promise.all([
    getLicenciasWebFeed(),
    getLicenciasHistory()
  ]);
  return { webFeed, history };
}

/**
 * Get all dashboard data at once (optimized batch fetch)
 */
export async function getDashboardData(): Promise<{
  vuelos: VueloRaw[];
  trenes: TrenSants[];
  cruceros: CrucerosData;
  eventos: EventosBcn[];
}> {
  const [vuelos, trenes, cruceros, eventos] = await Promise.all([
    getVuelos(),
    getTrenes(),
    getCruceros(),
    getEventos()
  ]);
  return { vuelos, trenes, cruceros, eventos };
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(key: string) {
  cache.delete(key);
  console.log(`[DataService] Cache invalidated: ${key}`);
}

/**
 * Invalidate all cache
 */
export function invalidateAllCache() {
  cache.clear();
  console.log('[DataService] All cache invalidated');
}

/**
 * Force refresh specific data
 */
export async function refreshData(key: 'vuelos' | 'trenes' | 'cruceros' | 'eventos' | 'licencias') {
  invalidateCache(key);

  switch (key) {
    case 'vuelos': return getVuelos();
    case 'trenes': return getTrenes();
    case 'cruceros': return getCruceros();
    case 'eventos': return getEventos();
    case 'licencias': return getLicenciasWebFeed();
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  const stats: Record<string, { valid: boolean; age: number; ttl: number }> = {};

  cache.forEach((entry, key) => {
    const age = Date.now() - entry.timestamp;
    stats[key] = {
      valid: age < entry.ttl,
      age: Math.round(age / 1000), // seconds
      ttl: Math.round(entry.ttl / 1000) // seconds
    };
  });

  return stats;
}

// ============================================
// AUTO-REFRESH MANAGER
// ============================================

const refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

/**
 * Start auto-refresh for a data type
 */
export function startAutoRefresh(key: 'vuelos' | 'trenes' | 'cruceros' | 'eventos' | 'licencias') {
  // Clear existing interval
  stopAutoRefresh(key);

  const intervalMs = CACHE_TTL[key];
  const interval = setInterval(() => {
    refreshData(key);
  }, intervalMs);

  refreshIntervals.set(key, interval);
  console.log(`[DataService] Auto-refresh started: ${key} (every ${intervalMs / 1000}s)`);
}

/**
 * Stop auto-refresh for a data type
 */
export function stopAutoRefresh(key: string) {
  const interval = refreshIntervals.get(key);
  if (interval) {
    clearInterval(interval);
    refreshIntervals.delete(key);
    console.log(`[DataService] Auto-refresh stopped: ${key}`);
  }
}

/**
 * Stop all auto-refreshes
 */
export function stopAllAutoRefresh() {
  refreshIntervals.forEach((_, key) => stopAutoRefresh(key));
}
