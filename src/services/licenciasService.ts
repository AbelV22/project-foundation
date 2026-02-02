/**
 * Licencias Service
 *
 * Servicio especializado para obtener y procesar datos de licencias de taxi.
 * Combina múltiples fuentes de datos para proporcionar análisis completo.
 */

// ============================================
// TYPES
// ============================================

/** Oferta individual de licencia */
export interface LicenciaOferta {
  id: string;
  fuente: 'SOLANO' | 'STAC' | 'MILANUNCIOS' | 'WALLAPOP' | 'GARCIA_BCN';
  diaDescanso: string;
  diaDescansoNormalizado: DiaDescanso;
  modelo: string;
  marca: string;
  precioTotal: number;
  valorCoche: number;
  precioNeto: number; // Precio de la licencia sin coche
  incluyeCoche: boolean;
  textoOriginal?: string;
  fechaPublicacion?: string;
  url?: string; // URL de la oferta original
  referencia?: string; // Referencia única de la oferta
}

/** Día de descanso normalizado */
export type DiaDescanso =
  | 'LUNES_PAR' | 'LUNES_IMPAR'
  | 'MARTES_PAR' | 'MARTES_IMPAR'
  | 'MIERCOLES_PAR' | 'MIERCOLES_IMPAR'
  | 'JUEVES_PAR' | 'JUEVES_IMPAR'
  | 'VIERNES_PAR' | 'VIERNES_IMPAR'
  | 'NO_ESPECIFICADO';

/** Ticker de mercado */
export interface LicenciaTicker {
  precioActual: number;
  deltaValor: number;
  deltaPorcentaje: number;
  tendencia: 'up' | 'down' | 'stable';
  volumen: number;
  volatilidad: number;
  fechaActualizacion: string;
}

/** Entrada histórica de precios */
export interface HistorialPrecio {
  fecha: string;
  fechaObj: Date;
  precioMedio: number;
  precioMediano: number;
  precioMinimo: number;
  precioMaximo: number;
  volumen: number;
  volatilidad: number;
  sma7: number | null;
  sma14: number | null;
  sma30: number | null;
  rsi?: number;
  tendenciaDiaria: 'up' | 'down' | 'stable';
}

/** Estadísticas por portal */
export interface EstadisticasPortal {
  fuente: string;
  precioMediano: number;
  precioMinimo: number;
  precioMaximo: number;
  totalOfertas: number;
  ofertas: LicenciaOferta[];
}

/** Estadísticas por día de descanso */
export interface EstadisticasDia {
  dia: DiaDescanso;
  diaDisplay: string;
  precioMediano: number;
  precioMinimo: number;
  precioMaximo: number;
  totalOfertas: number;
  diferenciaVsMedia: number;
  porcentajeVsMedia: number;
  esMasBarato: boolean;
}

/** Análisis de mercado completo */
export interface AnalisisMercado {
  // Ticker
  ticker: LicenciaTicker;

  // Ofertas
  totalOfertas: number;
  ofertasMasBaratas: LicenciaOferta[];
  todasLasOfertas: LicenciaOferta[];

  // Estadísticas
  precioMercado: number;
  spread: number;
  spreadPorcentaje: number;

  // Por portal
  porPortal: EstadisticasPortal[];

  // Por día de descanso
  porDiaDescanso: EstadisticasDia[];
  mejorDiaParaComprar: EstadisticasDia | null;

  // Histórico
  historial: HistorialPrecio[];
  tendencia7D: number; // % cambio últimos 7 días
  tendencia14D: number;
  tendencia30D: number;

  // Métricas avanzadas
  volatilidad7D: number;
  soportePrecio: number; // Precio mínimo recurrente
  resistenciaPrecio: number; // Precio máximo recurrente

  // Metadata
  ultimaActualizacion: string;
  fuentesDatos: string[];
}

// ============================================
// RAW DATA TYPES (from JSON files)
// ============================================

interface RawWebFeed {
  ticker: {
    current_price: number;
    median_today?: number;
    delta_value: number;
    delta_percent: number;
    direction: string;
    volume: number;
    volatility: number;
    volatility_7d_pct?: number;
    tendencia_7d_pct?: number;
    tendencia_14d_pct?: number;
    soporte?: number;
    resistencia?: number;
    sources_count?: number;
  };
  charts: {
    history_dates: string[];
    history_prices: number[];
    history_sma_7: number[];
    history_sma_14?: number[];
    history_sma_30?: number[];
    price_by_day_descanso: Record<string, number>;
  };
  market_depth: {
    cheapest_offers: RawOferta[];
    all_offers: RawOferta[];
  };
  analysis?: {
    mejor_dia_comprar?: {
      dia: string | null;
      precio_mediano: number | null;
    };
    por_fuente?: Array<{
      fuente: string;
      ofertas: number;
      mediana: number;
      minimo: number;
      maximo: number;
    }>;
    outliers_eliminados?: number;
  };
  updated_at: string;
  version?: string;
}

interface RawOferta {
  fuente: string;
  dia?: string;
  modelo?: string;
  precio_neto: number;
  precio_total?: number;
  valor_coche?: number;
  raw?: string;
  url?: string;
  referencia?: string;
  id?: number;
}

interface RawAnalisis {
  metadata: {
    total_ofertas_validas: number;
    precio_mercado_referencia: number;
  };
  estadisticas: {
    valor_mediano_por_fuente: Record<string, number>;
    valor_mediano_por_dia: Record<string, number>;
  };
  detalle_ofertas: RawOfertaAnalisis[];
}

interface RawOfertaAnalisis {
  fuente: string;
  dia_descanso: string;
  coche_modelo: string;
  precio_total: number;
  valor_coche_estimado: number;
  precio_neto_licencia: number;
  texto_original: string;
}

// ============================================
// PARSING & NORMALIZATION
// ============================================

/** Normaliza el día de descanso a un formato estándar */
function normalizarDiaDescanso(dia: string | undefined): DiaDescanso {
  if (!dia) return 'NO_ESPECIFICADO';

  const normalized = dia.toUpperCase().trim()
    .replace(/\s+/g, '_')
    .replace('Á', 'A')
    .replace('É', 'E')
    .replace('Í', 'I')
    .replace('Ó', 'O')
    .replace('Ú', 'U');

  const mapping: Record<string, DiaDescanso> = {
    'LUNES_PAR': 'LUNES_PAR',
    'LUNES_IMPAR': 'LUNES_IMPAR',
    'MARTES_PAR': 'MARTES_PAR',
    'MARTES_IMPAR': 'MARTES_IMPAR',
    'MIERCOLES_PAR': 'MIERCOLES_PAR',
    'MIERCOLES_IMPAR': 'MIERCOLES_IMPAR',
    'JUEVES_PAR': 'JUEVES_PAR',
    'JUEVES_IMPAR': 'JUEVES_IMPAR',
    'VIERNES_PAR': 'VIERNES_PAR',
    'VIERNES_IMPAR': 'VIERNES_IMPAR',
    // Variaciones comunes
    'LUNES PAR': 'LUNES_PAR',
    'LUNES IMPAR': 'LUNES_IMPAR',
    'MARTES PAR': 'MARTES_PAR',
    'MARTES IMPAR': 'MARTES_IMPAR',
    'MIERCOLES PAR': 'MIERCOLES_PAR',
    'MIERCOLES IMPAR': 'MIERCOLES_IMPAR',
    'JUEVES PAR': 'JUEVES_PAR',
    'JUEVES IMPAR': 'JUEVES_IMPAR',
    'VIERNES PAR': 'VIERNES_PAR',
    'VIERNES IMPAR': 'VIERNES_IMPAR',
    'NO_ESPECIFICADO': 'NO_ESPECIFICADO',
    'NO ESPECIFICADO': 'NO_ESPECIFICADO',
    'DESCONOCIDO': 'NO_ESPECIFICADO',
  };

  return mapping[normalized] || 'NO_ESPECIFICADO';
}

/** Obtiene nombre legible del día */
function getDiaDisplayName(dia: DiaDescanso): string {
  const names: Record<DiaDescanso, string> = {
    'LUNES_PAR': 'Lunes Par',
    'LUNES_IMPAR': 'Lunes Impar',
    'MARTES_PAR': 'Martes Par',
    'MARTES_IMPAR': 'Martes Impar',
    'MIERCOLES_PAR': 'Miércoles Par',
    'MIERCOLES_IMPAR': 'Miércoles Impar',
    'JUEVES_PAR': 'Jueves Par',
    'JUEVES_IMPAR': 'Jueves Impar',
    'VIERNES_PAR': 'Viernes Par',
    'VIERNES_IMPAR': 'Viernes Impar',
    'NO_ESPECIFICADO': 'No Especificado',
  };
  return names[dia] || dia;
}

/** Extrae marca del modelo de coche */
function extraerMarca(modelo: string | undefined): string {
  if (!modelo) return 'DESCONOCIDO';

  const marcas = ['TOYOTA', 'DACIA', 'FORD', 'VOLKSWAGEN', 'VW', 'FIAT', 'TESLA', 'HYUNDAI', 'KIA', 'SEAT', 'SKODA', 'RENAULT', 'PEUGEOT', 'CITROEN', 'MERCEDES', 'BMW', 'AUDI'];
  const modeloUpper = modelo.toUpperCase();

  for (const marca of marcas) {
    if (modeloUpper.includes(marca)) {
      return marca === 'VW' ? 'VOLKSWAGEN' : marca;
    }
  }

  // Si el modelo empieza con una palabra, puede ser la marca
  const primerasPalabras = modeloUpper.split(/[\s-]+/);
  if (primerasPalabras.length > 0 && primerasPalabras[0].length > 2) {
    return primerasPalabras[0];
  }

  return 'DESCONOCIDO';
}

/** Genera ID único para oferta */
function generarIdOferta(oferta: RawOferta | RawOfertaAnalisis, index: number): string {
  const fuente = 'fuente' in oferta ? oferta.fuente : '';
  const precio = 'precio_neto' in oferta ? oferta.precio_neto : oferta.precio_neto_licencia;
  return `${fuente}-${precio}-${index}`.toLowerCase().replace(/\s+/g, '-');
}

/** Parsea ofertas del web_feed.json */
function parsearOfertasWebFeed(raw: RawOferta[], fuentes: Set<string>): LicenciaOferta[] {
  return raw.map((oferta, idx) => {
    fuentes.add(oferta.fuente);
    const modelo = oferta.modelo || 'DESCONOCIDO';

    return {
      id: oferta.id?.toString() || generarIdOferta(oferta, idx),
      fuente: oferta.fuente as LicenciaOferta['fuente'],
      diaDescanso: oferta.dia || 'NO ESPECIFICADO',
      diaDescansoNormalizado: normalizarDiaDescanso(oferta.dia),
      modelo,
      marca: extraerMarca(modelo),
      precioTotal: oferta.precio_total || oferta.precio_neto,
      valorCoche: oferta.valor_coche || 0,
      precioNeto: oferta.precio_neto,
      incluyeCoche: (oferta.valor_coche || 0) > 0,
      textoOriginal: oferta.raw,
      url: oferta.url,
      referencia: oferta.referencia,
    };
  });
}

/** Parsea ofertas del analisis_licencias_taxi.json */
function parsearOfertasAnalisis(raw: RawOfertaAnalisis[], fuentes: Set<string>): LicenciaOferta[] {
  return raw.map((oferta, idx) => {
    fuentes.add(oferta.fuente);
    const modelo = oferta.coche_modelo || 'DESCONOCIDO';

    return {
      id: generarIdOferta(oferta, idx + 1000), // Offset para evitar colisiones
      fuente: oferta.fuente as LicenciaOferta['fuente'],
      diaDescanso: oferta.dia_descanso,
      diaDescansoNormalizado: normalizarDiaDescanso(oferta.dia_descanso),
      modelo,
      marca: extraerMarca(modelo),
      precioTotal: oferta.precio_total,
      valorCoche: oferta.valor_coche_estimado,
      precioNeto: oferta.precio_neto_licencia,
      incluyeCoche: oferta.valor_coche_estimado > 0 && oferta.coche_modelo !== 'SIN COCHE',
      textoOriginal: oferta.texto_original,
    };
  });
}

/** Parsea CSV de historial */
function parsearHistorialCSV(csv: string, sma7FromFeed: number[]): HistorialPrecio[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const entries: HistorialPrecio[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const [date, avg_price, median_price, min_price, max_price, volume, volatility_std] = line.split(',');

    const precioMediano = parseInt(median_price, 10);
    const prevPrecio = i > 1 ? entries[entries.length - 1]?.precioMediano : precioMediano;

    entries.push({
      fecha: date,
      fechaObj: new Date(date),
      precioMedio: parseInt(avg_price, 10),
      precioMediano,
      precioMinimo: parseInt(min_price, 10),
      precioMaximo: parseInt(max_price, 10),
      volumen: parseInt(volume, 10),
      volatilidad: parseInt(volatility_std, 10),
      sma7: sma7FromFeed[i - 1] || null,
      sma14: null, // Calculado después
      sma30: null, // Calculado después
      tendenciaDiaria: precioMediano > prevPrecio ? 'up' : precioMediano < prevPrecio ? 'down' : 'stable',
    });
  }

  // Calcular SMAs adicionales
  calcularSMAs(entries);

  return entries;
}

/** Calcula SMAs para el historial */
function calcularSMAs(entries: HistorialPrecio[]) {
  for (let i = 0; i < entries.length; i++) {
    // SMA-14
    if (i >= 13) {
      const sum14 = entries.slice(i - 13, i + 1).reduce((acc, e) => acc + e.precioMediano, 0);
      entries[i].sma14 = Math.round(sum14 / 14);
    }

    // SMA-30
    if (i >= 29) {
      const sum30 = entries.slice(i - 29, i + 1).reduce((acc, e) => acc + e.precioMediano, 0);
      entries[i].sma30 = Math.round(sum30 / 30);
    }
  }
}

// ============================================
// STATISTICS CALCULATIONS
// ============================================

/** Calcula mediana de un array */
function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Calcula estadísticas por portal */
function calcularEstadisticasPortal(ofertas: LicenciaOferta[]): EstadisticasPortal[] {
  const porFuente = new Map<string, LicenciaOferta[]>();

  ofertas.forEach(oferta => {
    const arr = porFuente.get(oferta.fuente) || [];
    arr.push(oferta);
    porFuente.set(oferta.fuente, arr);
  });

  const stats: EstadisticasPortal[] = [];

  porFuente.forEach((fuenteOfertas, fuente) => {
    const precios = fuenteOfertas.map(o => o.precioNeto);
    stats.push({
      fuente,
      precioMediano: mediana(precios),
      precioMinimo: Math.min(...precios),
      precioMaximo: Math.max(...precios),
      totalOfertas: fuenteOfertas.length,
      ofertas: fuenteOfertas.sort((a, b) => a.precioNeto - b.precioNeto),
    });
  });

  return stats.sort((a, b) => a.precioMediano - b.precioMediano);
}

/** Calcula estadísticas por día de descanso */
function calcularEstadisticasDia(ofertas: LicenciaOferta[], precioMercado: number): EstadisticasDia[] {
  const porDia = new Map<DiaDescanso, LicenciaOferta[]>();

  ofertas.forEach(oferta => {
    const arr = porDia.get(oferta.diaDescansoNormalizado) || [];
    arr.push(oferta);
    porDia.set(oferta.diaDescansoNormalizado, arr);
  });

  const stats: EstadisticasDia[] = [];

  porDia.forEach((diaOfertas, dia) => {
    const precios = diaOfertas.map(o => o.precioNeto);
    const precioMediano = mediana(precios);
    const diferencia = precioMediano - precioMercado;

    stats.push({
      dia,
      diaDisplay: getDiaDisplayName(dia),
      precioMediano,
      precioMinimo: Math.min(...precios),
      precioMaximo: Math.max(...precios),
      totalOfertas: diaOfertas.length,
      diferenciaVsMedia: diferencia,
      porcentajeVsMedia: (diferencia / precioMercado) * 100,
      esMasBarato: diferencia < 0,
    });
  });

  return stats.sort((a, b) => a.precioMediano - b.precioMediano);
}

/** Calcula tendencia de precios */
function calcularTendencia(historial: HistorialPrecio[], dias: number): number {
  if (historial.length < dias) return 0;

  const reciente = historial.slice(-dias);
  const precioInicial = reciente[0].precioMediano;
  const precioFinal = reciente[reciente.length - 1].precioMediano;

  return ((precioFinal - precioInicial) / precioInicial) * 100;
}

/** Calcula volatilidad de precios */
function calcularVolatilidad(historial: HistorialPrecio[], dias: number): number {
  if (historial.length < dias) return 0;

  const reciente = historial.slice(-dias);
  const volatilidades = reciente.map(h => h.volatilidad);

  return Math.round(volatilidades.reduce((a, b) => a + b, 0) / volatilidades.length);
}

/** Encuentra niveles de soporte y resistencia */
function calcularSoporteResistencia(historial: HistorialPrecio[]): { soporte: number; resistencia: number } {
  if (historial.length < 5) return { soporte: 0, resistencia: 0 };

  const reciente = historial.slice(-30); // Últimos 30 días
  const minimos = reciente.map(h => h.precioMinimo);
  const maximos = reciente.map(h => h.precioMaximo);

  // Soporte: precio mínimo recurrente (mediana de mínimos)
  const soporte = mediana(minimos);

  // Resistencia: precio máximo recurrente (mediana de máximos)
  const resistencia = mediana(maximos);

  return { soporte, resistencia };
}

// ============================================
// MAIN SERVICE
// ============================================

/** Cache para datos de licencias */
interface LicenciasCache {
  data: AnalisisMercado | null;
  timestamp: number;
  ttl: number;
}

const cache: LicenciasCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutos
};

/** Verifica si la cache es válida */
function isCacheValid(): boolean {
  return cache.data !== null && (Date.now() - cache.timestamp) < cache.ttl;
}

/** Invalida la cache */
export function invalidarCacheLicencias() {
  cache.data = null;
  cache.timestamp = 0;
  console.log('[LicenciasService] Cache invalidada');
}

/**
 * Obtiene análisis completo del mercado de licencias
 */
export async function obtenerAnalisisMercado(): Promise<AnalisisMercado> {
  // Check cache
  if (isCacheValid() && cache.data) {
    console.log('[LicenciasService] Usando datos de cache');
    return cache.data;
  }

  console.log('[LicenciasService] Cargando datos de licencias...');

  // Fetch all data sources in parallel
  const [webFeedRes, analisisRes, historialRes] = await Promise.all([
    fetch('/web_feed.json?t=' + Date.now()),
    fetch('/analisis_licencias_taxi.json?t=' + Date.now()),
    fetch('/history_stats.csv?t=' + Date.now()),
  ]);

  const [webFeed, analisis, historialCSV] = await Promise.all([
    webFeedRes.json() as Promise<RawWebFeed>,
    analisisRes.json() as Promise<RawAnalisis>,
    historialRes.text(),
  ]);

  // Track fuentes
  const fuentes = new Set<string>();

  // Parse ofertas from both sources
  const ofertasWebFeed = parsearOfertasWebFeed(webFeed.market_depth.all_offers, fuentes);
  const ofertasAnalisis = parsearOfertasAnalisis(analisis.detalle_ofertas, fuentes);

  // Merge and deduplicate ofertas (by precio_neto + fuente)
  const ofertasMap = new Map<string, LicenciaOferta>();
  [...ofertasWebFeed, ...ofertasAnalisis].forEach(oferta => {
    const key = `${oferta.fuente}-${oferta.precioNeto}`;
    if (!ofertasMap.has(key) || oferta.textoOriginal) {
      ofertasMap.set(key, oferta);
    }
  });

  const todasLasOfertas = Array.from(ofertasMap.values())
    .sort((a, b) => a.precioNeto - b.precioNeto);

  // Parse historial
  const historial = parsearHistorialCSV(historialCSV, webFeed.charts.history_sma_7);

  // Calculate statistics
  const precios = todasLasOfertas.map(o => o.precioNeto);
  const precioMercado = mediana(precios);
  const precioMinimo = Math.min(...precios);
  const precioMaximo = Math.max(...precios);
  const spread = precioMaximo - precioMinimo;

  const porPortal = calcularEstadisticasPortal(todasLasOfertas);
  const porDiaDescanso = calcularEstadisticasDia(todasLasOfertas, precioMercado);
  const mejorDia = porDiaDescanso.find(d => d.esMasBarato) || porDiaDescanso[0] || null;

  const { soporte, resistencia } = calcularSoporteResistencia(historial);

  // Use pre-calculated values from v2 scraper if available, otherwise calculate
  const tendencia7D = webFeed.ticker.tendencia_7d_pct ?? calcularTendencia(historial, 7);
  const tendencia14D = webFeed.ticker.tendencia_14d_pct ?? calcularTendencia(historial, 14);
  const volatilidad7D = webFeed.ticker.volatility_7d_pct ?? calcularVolatilidad(historial, 7);
  const soporteFromFeed = webFeed.ticker.soporte ?? soporte;
  const resistenciaFromFeed = webFeed.ticker.resistencia ?? resistencia;

  const analisisMercado: AnalisisMercado = {
    ticker: {
      precioActual: webFeed.ticker.current_price,
      deltaValor: webFeed.ticker.delta_value,
      deltaPorcentaje: webFeed.ticker.delta_percent,
      tendencia: webFeed.ticker.direction === 'up' ? 'up' : webFeed.ticker.direction === 'down' ? 'down' : 'stable',
      volumen: webFeed.ticker.volume,
      volatilidad: webFeed.ticker.volatility,
      fechaActualizacion: webFeed.updated_at,
    },

    totalOfertas: todasLasOfertas.length,
    ofertasMasBaratas: todasLasOfertas.slice(0, 5),
    todasLasOfertas,

    precioMercado,
    spread,
    spreadPorcentaje: (spread / precioMinimo) * 100,

    porPortal,
    porDiaDescanso,
    mejorDiaParaComprar: mejorDia,

    historial,
    tendencia7D,
    tendencia14D,
    tendencia30D: calcularTendencia(historial, 30),

    volatilidad7D,
    soportePrecio: soporteFromFeed,
    resistenciaPrecio: resistenciaFromFeed,

    ultimaActualizacion: webFeed.updated_at,
    fuentesDatos: Array.from(fuentes),
  };

  // Update cache
  cache.data = analisisMercado;
  cache.timestamp = Date.now();

  console.log('[LicenciasService] Análisis completado:', {
    ofertas: todasLasOfertas.length,
    historial: historial.length,
    fuentes: Array.from(fuentes),
  });

  return analisisMercado;
}

/**
 * Obtiene solo las ofertas más baratas (lightweight)
 */
export async function obtenerOfertasBaratas(limit: number = 5): Promise<LicenciaOferta[]> {
  const analisis = await obtenerAnalisisMercado();
  return analisis.ofertasMasBaratas.slice(0, limit);
}

/**
 * Obtiene el ticker actual
 */
export async function obtenerTicker(): Promise<LicenciaTicker> {
  const analisis = await obtenerAnalisisMercado();
  return analisis.ticker;
}

/**
 * Obtiene historial de precios para gráficas
 */
export async function obtenerHistorialPrecios(dias?: number): Promise<HistorialPrecio[]> {
  const analisis = await obtenerAnalisisMercado();
  if (!dias) return analisis.historial;
  return analisis.historial.slice(-dias);
}

/**
 * Busca ofertas con filtros
 */
export async function buscarOfertas(filtros: {
  fuentes?: string[];
  diasDescanso?: DiaDescanso[];
  precioMaximo?: number;
  incluyeCoche?: boolean;
}): Promise<LicenciaOferta[]> {
  const analisis = await obtenerAnalisisMercado();

  let ofertas = analisis.todasLasOfertas;

  if (filtros.fuentes && filtros.fuentes.length > 0) {
    ofertas = ofertas.filter(o => filtros.fuentes!.includes(o.fuente));
  }

  if (filtros.diasDescanso && filtros.diasDescanso.length > 0) {
    ofertas = ofertas.filter(o => filtros.diasDescanso!.includes(o.diaDescansoNormalizado));
  }

  if (filtros.precioMaximo) {
    ofertas = ofertas.filter(o => o.precioNeto <= filtros.precioMaximo!);
  }

  if (filtros.incluyeCoche !== undefined) {
    ofertas = ofertas.filter(o => o.incluyeCoche === filtros.incluyeCoche);
  }

  return ofertas;
}

// ============================================
// UTILITY EXPORTS
// ============================================

export { getDiaDisplayName, normalizarDiaDescanso };
