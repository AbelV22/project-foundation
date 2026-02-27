/**
 * Passenger Estimation Engine for TaxiDay
 *
 * Estimates passengers per flight using:
 * 1. IATA airline code → aircraft capacity + load factor (2024 real data)
 * 2. Route type (domestic/european/longhaul) from origin
 * 3. Seasonal adjustment by month
 * 4. Taxi demand factor (% of passengers that take taxis)
 *
 * Sources: IATA 2024, Ryanair/IAG/AF-KLM/Lufthansa annual reports,
 * AENA BCN statistics (55M pax 2024, 57.5M 2025)
 */

// --- AIRLINE DATABASE ---
// IATA 3-letter code → airline data
// Load factors from 2024 annual reports
// Capacity = typical seats on BCN routes

interface AirlineData {
  name: string;
  capacity: number;       // Typical seats on BCN routes
  loadFactor: number;     // 2024 annual load factor (0-1)
  type: 'lowcost' | 'legacy' | 'regional' | 'longhaul';
}

const AIRLINE_DB: Record<string, AirlineData> = {
  // --- LOW COST CARRIERS ---
  RYR: { name: 'Ryanair', capacity: 192, loadFactor: 0.94, type: 'lowcost' },
  FR:  { name: 'Ryanair', capacity: 192, loadFactor: 0.94, type: 'lowcost' },
  EZY: { name: 'EasyJet', capacity: 186, loadFactor: 0.89, type: 'lowcost' },
  EJU: { name: 'EasyJet Europe', capacity: 186, loadFactor: 0.89, type: 'lowcost' },
  EZS: { name: 'EasyJet Switzerland', capacity: 186, loadFactor: 0.89, type: 'lowcost' },
  VLG: { name: 'Vueling', capacity: 186, loadFactor: 0.87, type: 'lowcost' },
  W6:  { name: 'Wizz Air', capacity: 230, loadFactor: 0.91, type: 'lowcost' },
  WZZ: { name: 'Wizz Air', capacity: 230, loadFactor: 0.91, type: 'lowcost' },
  HV:  { name: 'Transavia', capacity: 189, loadFactor: 0.89, type: 'lowcost' },
  TRA: { name: 'Transavia', capacity: 189, loadFactor: 0.89, type: 'lowcost' },
  TO:  { name: 'Transavia France', capacity: 189, loadFactor: 0.89, type: 'lowcost' },
  TVF: { name: 'Transavia France', capacity: 189, loadFactor: 0.89, type: 'lowcost' },
  DY:  { name: 'Norwegian', capacity: 186, loadFactor: 0.85, type: 'lowcost' },
  D8:  { name: 'Norwegian Air International', capacity: 186, loadFactor: 0.85, type: 'lowcost' },
  NAX: { name: 'Norwegian', capacity: 186, loadFactor: 0.85, type: 'lowcost' },
  LS:  { name: 'Jet2', capacity: 189, loadFactor: 0.92, type: 'lowcost' },
  EXS: { name: 'Jet2', capacity: 189, loadFactor: 0.92, type: 'lowcost' },
  EW:  { name: 'Eurowings', capacity: 180, loadFactor: 0.85, type: 'lowcost' },
  EWG: { name: 'Eurowings', capacity: 180, loadFactor: 0.85, type: 'lowcost' },
  PC:  { name: 'Pegasus', capacity: 186, loadFactor: 0.88, type: 'lowcost' },
  PGT: { name: 'Pegasus', capacity: 186, loadFactor: 0.88, type: 'lowcost' },
  VOE: { name: 'Volotea', capacity: 156, loadFactor: 0.88, type: 'lowcost' },
  V7:  { name: 'Volotea', capacity: 156, loadFactor: 0.88, type: 'lowcost' },
  U2:  { name: 'EasyJet', capacity: 186, loadFactor: 0.89, type: 'lowcost' },
  BE:  { name: 'Flybe/Blue Islands', capacity: 78, loadFactor: 0.75, type: 'regional' },

  // --- LEGACY / FULL SERVICE (Short-haul at BCN) ---
  IB:  { name: 'Iberia', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  IBE: { name: 'Iberia', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  I2:  { name: 'Iberia Express', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  IBS: { name: 'Iberia Express', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  UX:  { name: 'Air Europa', capacity: 186, loadFactor: 0.85, type: 'legacy' },
  AEA: { name: 'Air Europa', capacity: 186, loadFactor: 0.85, type: 'legacy' },
  AF:  { name: 'Air France', capacity: 178, loadFactor: 0.88, type: 'legacy' },
  AFR: { name: 'Air France', capacity: 178, loadFactor: 0.88, type: 'legacy' },
  KL:  { name: 'KLM', capacity: 180, loadFactor: 0.88, type: 'legacy' },
  KLM: { name: 'KLM', capacity: 180, loadFactor: 0.88, type: 'legacy' },
  LH:  { name: 'Lufthansa', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  DLH: { name: 'Lufthansa', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  BA:  { name: 'British Airways', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  BAW: { name: 'British Airways', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  SHT: { name: 'British Airways Shuttle', capacity: 180, loadFactor: 0.87, type: 'legacy' },
  TP:  { name: 'TAP Air Portugal', capacity: 180, loadFactor: 0.82, type: 'legacy' },
  TAP: { name: 'TAP Air Portugal', capacity: 180, loadFactor: 0.82, type: 'legacy' },
  LX:  { name: 'SWISS', capacity: 180, loadFactor: 0.84, type: 'legacy' },
  SWR: { name: 'SWISS', capacity: 180, loadFactor: 0.84, type: 'legacy' },
  OS:  { name: 'Austrian Airlines', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  AUA: { name: 'Austrian Airlines', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  SN:  { name: 'Brussels Airlines', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  BEL: { name: 'Brussels Airlines', capacity: 180, loadFactor: 0.83, type: 'legacy' },
  AZ:  { name: 'ITA Airways', capacity: 180, loadFactor: 0.84, type: 'legacy' },
  ITY: { name: 'ITA Airways', capacity: 180, loadFactor: 0.84, type: 'legacy' },
  SK:  { name: 'SAS', capacity: 174, loadFactor: 0.82, type: 'legacy' },
  SAS: { name: 'SAS', capacity: 174, loadFactor: 0.82, type: 'legacy' },
  AY:  { name: 'Finnair', capacity: 174, loadFactor: 0.82, type: 'legacy' },
  FIN: { name: 'Finnair', capacity: 174, loadFactor: 0.82, type: 'legacy' },
  EI:  { name: 'Aer Lingus', capacity: 186, loadFactor: 0.81, type: 'legacy' },
  EIN: { name: 'Aer Lingus', capacity: 186, loadFactor: 0.81, type: 'legacy' },
  RO:  { name: 'TAROM', capacity: 144, loadFactor: 0.78, type: 'legacy' },
  ROT: { name: 'TAROM', capacity: 144, loadFactor: 0.78, type: 'legacy' },
  JU:  { name: 'Air Serbia', capacity: 144, loadFactor: 0.80, type: 'legacy' },
  ASL: { name: 'Air Serbia', capacity: 144, loadFactor: 0.80, type: 'legacy' },
  TK:  { name: 'Turkish Airlines', capacity: 220, loadFactor: 0.82, type: 'legacy' },
  THY: { name: 'Turkish Airlines', capacity: 220, loadFactor: 0.82, type: 'legacy' },
  MS:  { name: 'EgyptAir', capacity: 160, loadFactor: 0.78, type: 'legacy' },
  MSR: { name: 'EgyptAir', capacity: 160, loadFactor: 0.78, type: 'legacy' },
  AT:  { name: 'Royal Air Maroc', capacity: 160, loadFactor: 0.80, type: 'legacy' },
  RAM: { name: 'Royal Air Maroc', capacity: 160, loadFactor: 0.80, type: 'legacy' },
  MAC: { name: 'Arajet / Air Maroc', capacity: 160, loadFactor: 0.80, type: 'legacy' },
  AH:  { name: 'Air Algérie', capacity: 160, loadFactor: 0.78, type: 'legacy' },
  DAH: { name: 'Air Algérie', capacity: 160, loadFactor: 0.78, type: 'legacy' },
  TU:  { name: 'Tunisair', capacity: 144, loadFactor: 0.78, type: 'legacy' },
  TAR: { name: 'Tunisair', capacity: 144, loadFactor: 0.78, type: 'legacy' },
  S4:  { name: 'SATA Internacional', capacity: 144, loadFactor: 0.80, type: 'legacy' },

  // --- LONG-HAUL ---
  LVL: { name: 'Level', capacity: 335, loadFactor: 0.87, type: 'longhaul' },
  AA:  { name: 'American Airlines', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  AAL: { name: 'American Airlines', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  DL:  { name: 'Delta', capacity: 280, loadFactor: 0.85, type: 'longhaul' },
  DAL: { name: 'Delta', capacity: 280, loadFactor: 0.85, type: 'longhaul' },
  UA:  { name: 'United Airlines', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  UAL: { name: 'United Airlines', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  QR:  { name: 'Qatar Airways', capacity: 300, loadFactor: 0.83, type: 'longhaul' },
  QTR: { name: 'Qatar Airways', capacity: 300, loadFactor: 0.83, type: 'longhaul' },
  EK:  { name: 'Emirates', capacity: 350, loadFactor: 0.82, type: 'longhaul' },
  UAE: { name: 'Emirates', capacity: 350, loadFactor: 0.82, type: 'longhaul' },
  EY:  { name: 'Etihad', capacity: 280, loadFactor: 0.80, type: 'longhaul' },
  ETD: { name: 'Etihad', capacity: 280, loadFactor: 0.80, type: 'longhaul' },
  SV:  { name: 'Saudia', capacity: 280, loadFactor: 0.78, type: 'longhaul' },
  SVA: { name: 'Saudia', capacity: 280, loadFactor: 0.78, type: 'longhaul' },
  JL:  { name: 'Japan Airlines', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  JAL: { name: 'Japan Airlines', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  KE:  { name: 'Korean Air', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  KAL: { name: 'Korean Air', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  SQ:  { name: 'Singapore Airlines', capacity: 300, loadFactor: 0.85, type: 'longhaul' },
  SIA: { name: 'Singapore Airlines', capacity: 300, loadFactor: 0.85, type: 'longhaul' },
  CA:  { name: 'Air China', capacity: 280, loadFactor: 0.80, type: 'longhaul' },
  CCA: { name: 'Air China', capacity: 280, loadFactor: 0.80, type: 'longhaul' },
  AC:  { name: 'Air Canada', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  ACA: { name: 'Air Canada', capacity: 280, loadFactor: 0.84, type: 'longhaul' },
  AM:  { name: 'Aeroméxico', capacity: 270, loadFactor: 0.83, type: 'longhaul' },
  AMX: { name: 'Aeroméxico', capacity: 270, loadFactor: 0.83, type: 'longhaul' },
  LA:  { name: 'LATAM', capacity: 300, loadFactor: 0.84, type: 'longhaul' },
  LAN: { name: 'LATAM', capacity: 300, loadFactor: 0.84, type: 'longhaul' },
  AR:  { name: 'Aerolíneas Argentinas', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  ARG: { name: 'Aerolíneas Argentinas', capacity: 280, loadFactor: 0.82, type: 'longhaul' },
  WJA: { name: 'WestJet', capacity: 180, loadFactor: 0.84, type: 'legacy' },
  GLO: { name: 'GOL', capacity: 180, loadFactor: 0.83, type: 'legacy' },

  // --- REGIONAL ---
  YW:  { name: 'Air Nostrum', capacity: 100, loadFactor: 0.75, type: 'regional' },
  ANE: { name: 'Air Nostrum', capacity: 100, loadFactor: 0.75, type: 'regional' },
  CJ:  { name: 'BA CityFlyer', capacity: 98, loadFactor: 0.80, type: 'regional' },
  CFE: { name: 'BA CityFlyer', capacity: 98, loadFactor: 0.80, type: 'regional' },
  EN:  { name: 'Air Dolomiti', capacity: 120, loadFactor: 0.78, type: 'regional' },
  DLA: { name: 'Air Dolomiti', capacity: 120, loadFactor: 0.78, type: 'regional' },
  QS:  { name: 'SmartWings', capacity: 189, loadFactor: 0.88, type: 'lowcost' },
  TVS: { name: 'SmartWings', capacity: 189, loadFactor: 0.88, type: 'lowcost' },
};

// --- ROUTE CLASSIFICATION ---
// Classify origin into domestic/european/longhaul for taxi demand estimation

type RouteType = 'domestic' | 'european' | 'longhaul' | 'north_africa';

// Spanish domestic airports (partial match on origin string)
const DOMESTIC_KEYWORDS = [
  'MADRID', 'PALMA', 'MALLORCA', 'MALAGA', 'SEVILLA', 'VALENCIA', 'BILBAO',
  'IBIZA', 'TENERIFE', 'GRAN CANARIA', 'LANZAROTE', 'FUERTEVENTURA', 'MENORCA',
  'ALICANTE', 'SANTIAGO', 'VIGO', 'ASTURIAS', 'SANTANDER', 'ZARAGOZA',
  'JEREZ', 'MURCIA', 'PAMPLONA', 'SAN SEBASTIAN', 'VALLADOLID', 'GRANADA',
  'ALMERIA', 'MELILLA', 'CEUTA', 'BADAJOZ', 'LEON', 'LOGROÑO', 'REUS',
  'GIRONA', 'A CORUÑA', 'CORUNA',
  // Airport codes
  '(MAD)', '(PMI)', '(AGP)', '(SVQ)', '(VLC)', '(BIO)', '(IBZ)',
  '(TFN)', '(TFS)', '(LPA)', '(ACE)', '(FUE)', '(MAH)', '(ALC)',
  '(SCQ)', '(VGO)', '(OVD)', '(SDR)', '(ZAZ)', '(XRY)', '(RMU)',
  '(GRX)', '(LEI)', '(MLN)',
];

// Long-haul destinations (non-European)
const LONGHAUL_KEYWORDS = [
  'NEW YORK', 'NEWARK', 'LOS ANGELES', 'MIAMI', 'CHICAGO', 'ATLANTA',
  'WASHINGTON', 'BOSTON', 'SAN FRANCISCO', 'DALLAS', 'HOUSTON', 'PHILADELPHIA',
  'TORONTO', 'MONTREAL', 'MEXICO', 'CANCUN', 'BOGOTA', 'LIMA', 'BUENOS AIRES',
  'SAO PAULO', 'RIO DE JANEIRO', 'SANTIAGO DE CHILE',
  'DUBAI', 'DOHA', 'ABU DHABI', 'RIAD', 'JEDDAH', 'MUSCAT', 'BAHRAIN',
  'TOKYO', 'OSAKA', 'SEOUL', 'BEIJING', 'SHANGHAI', 'HONG KONG', 'SINGAPORE',
  'BANGKOK', 'KUALA LUMPUR', 'DELHI', 'MUMBAI',
  'JOHANNESBURG', 'NAIROBI', 'ADDIS ABABA', 'DAKAR',
  '(JFK)', '(EWR)', '(LAX)', '(MIA)', '(ORD)', '(ATL)', '(IAD)',
  '(BOS)', '(SFO)', '(DFW)', '(IAH)', '(PHL)', '(YYZ)', '(YUL)',
  '(MEX)', '(CUN)', '(BOG)', '(LIM)', '(EZE)', '(GRU)', '(GIG)',
  '(DXB)', '(DOH)', '(AUH)', '(NRT)', '(HND)', '(ICN)', '(PEK)',
  '(PVG)', '(HKG)', '(SIN)', '(BKK)', '(KUL)', '(DEL)', '(BOM)',
  'HAMAD INTERNATIONAL',
];

// North Africa (nearby but international = moderate taxi demand)
const NORTH_AFRICA_KEYWORDS = [
  'CASABLANCA', 'MARRAKECH', 'TANGER', 'RABAT', 'FEZ', 'NADOR', 'OUJDA',
  'ARGEL', 'ORAN', 'CONSTANTINE', 'TUNIS', 'MONASTIR', 'DJERBA',
  '(CMN)', '(RAK)', '(TNG)', '(RBA)', '(FEZ)', '(NDR)', '(OUD)',
  '(ALG)', '(ORN)', '(CZL)', '(TUN)', '(MIR)', '(DJE)',
];

function classifyRoute(origin: string): RouteType {
  const upper = origin.toUpperCase();

  if (upper === '-' || upper === '' || upper === 'N/A') return 'european'; // Default

  if (DOMESTIC_KEYWORDS.some(kw => upper.includes(kw))) return 'domestic';
  if (LONGHAUL_KEYWORDS.some(kw => upper.includes(kw))) return 'longhaul';
  if (NORTH_AFRICA_KEYWORDS.some(kw => upper.includes(kw))) return 'north_africa';

  return 'european'; // Default for European cities
}

// --- TAXI DEMAND FACTOR ---
// What percentage of arriving passengers will take a taxi?
// Based on airport ground transportation studies + BCN specifics
// BCN has Aerobus, Metro L9, RENFE R2 → good public transit

const TAXI_DEMAND_FACTOR: Record<RouteType, number> = {
  domestic: 0.12,       // 12% - locals know alternatives
  european: 0.18,       // 18% - tourists, moderate luggage
  longhaul: 0.28,       // 28% - heavy luggage, jet lag, unfamiliar
  north_africa: 0.15,   // 15% - mixed, often have family pickup
};

// --- SEASONAL ADJUSTMENT ---
// BCN seasonal passenger pattern (ratio vs annual average)
// Peak summer ≈ 1.15x average, winter low ≈ 0.82x average

const SEASONAL_FACTOR: Record<number, number> = {
  0: 0.82,   // January
  1: 0.85,   // February
  2: 0.95,   // March (MWC effect)
  3: 1.02,   // April (Easter/spring break)
  4: 1.08,   // May
  5: 1.15,   // June (peak starts)
  6: 1.18,   // July (peak)
  7: 1.18,   // August (peak)
  8: 1.10,   // September
  9: 1.05,   // October
  10: 0.90,  // November
  11: 0.88,  // December (holidays)
};

// --- EXTRACTION HELPERS ---

/**
 * Extract IATA airline code from flight code string
 * Examples:
 *   "VLG3215 / QTR3765 / LVL5310" → "VLG" (first = operating carrier)
 *   "RYR4083" → "RYR"
 *   "EWG9442" → "EWG"
 */
function extractAirlineCode(vueloField: string): string {
  const firstFlight = vueloField.split('/')[0].trim();
  // Match 2-3 letter code at the start, before digits
  const match = firstFlight.match(/^([A-Z]{2,3})\d/);
  return match ? match[1] : '';
}

// --- MAIN ESTIMATION FUNCTION ---

export interface FlightPaxEstimate {
  totalPax: number;          // Total estimated passengers on flight
  taxiPax: number;           // Estimated passengers that will take taxi
  airline: string;           // Airline name
  airlineCode: string;       // IATA code extracted
  capacity: number;          // Aircraft seat capacity
  loadFactor: number;        // Load factor used
  routeType: RouteType;      // Route classification
  confidence: 'high' | 'medium' | 'low'; // Estimation confidence
}

/**
 * Estimate passengers for a single flight
 */
export function estimateFlightPax(
  vueloField: string,
  origin: string,
  terminal: string,
): FlightPaxEstimate {
  const airlineCode = extractAirlineCode(vueloField);
  const airlineData = AIRLINE_DB[airlineCode];
  const routeType = classifyRoute(origin);
  const month = new Date().getMonth();
  const seasonal = SEASONAL_FACTOR[month] ?? 1.0;

  let capacity: number;
  let loadFactor: number;
  let airlineName: string;
  let confidence: FlightPaxEstimate['confidence'];

  if (airlineData) {
    // Known airline — high confidence
    capacity = airlineData.capacity;
    loadFactor = airlineData.loadFactor;
    airlineName = airlineData.name;
    confidence = 'high';

    // Override capacity for long-haul routes with short-haul airlines
    // (they might operate widebody on specific routes)
    if (routeType === 'longhaul' && airlineData.type === 'legacy') {
      capacity = 300; // Widebody assumption
    }
  } else {
    // Unknown airline — use terminal-based heuristic
    airlineName = airlineCode || 'Desconocida';
    confidence = 'low';

    const termUpper = (terminal || '').toUpperCase();
    if (termUpper.includes('T2C')) {
      // T2C = EasyJet territory
      capacity = 186;
      loadFactor = 0.89;
    } else if (termUpper.includes('T2B')) {
      // T2B = Low-cost carriers (Ryanair, etc.)
      capacity = 189;
      loadFactor = 0.90;
    } else if (termUpper.includes('T2A')) {
      // T2A = Mixed low-cost/charter
      capacity = 180;
      loadFactor = 0.85;
    } else {
      // T1 = Full-service/legacy default
      capacity = 180;
      loadFactor = 0.85;
    }
  }

  // Calculate base passengers
  const basePax = Math.round(capacity * loadFactor);

  // Apply seasonal adjustment (subtle, ±18%)
  const seasonalPax = Math.round(basePax * seasonal);

  // Calculate taxi passengers
  const taxiFactor = TAXI_DEMAND_FACTOR[routeType];
  const taxiPax = Math.round(seasonalPax * taxiFactor);

  return {
    totalPax: seasonalPax,
    taxiPax,
    airline: airlineName,
    airlineCode,
    capacity,
    loadFactor,
    routeType,
    confidence,
  };
}

// --- TRAIN ESTIMATION ---

interface TrainTypeData {
  name: string;
  capacity: number;       // Typical seats
  loadFactor: number;     // Average occupancy
  taxiFactor: number;     // % that take taxi at Sants
}

const TRAIN_DB: Record<string, TrainTypeData> = {
  // Alta Velocidad — large passenger volumes, business + tourist mix
  AVE:       { name: 'AVE', capacity: 365, loadFactor: 0.80, taxiFactor: 0.20 },
  IRYO:      { name: 'IRYO', capacity: 400, loadFactor: 0.82, taxiFactor: 0.22 },
  OUIGO:     { name: 'OUIGO', capacity: 509, loadFactor: 0.90, taxiFactor: 0.15 },

  // Media Distancia — shorter routes, more locals
  EUROMED:   { name: 'EUROMED', capacity: 260, loadFactor: 0.75, taxiFactor: 0.15 },
  AVANT:     { name: 'AVANT', capacity: 200, loadFactor: 0.70, taxiFactor: 0.10 },
  INTERCITY: { name: 'INTERCITY', capacity: 200, loadFactor: 0.65, taxiFactor: 0.12 },
  ALVIA:     { name: 'ALVIA', capacity: 240, loadFactor: 0.72, taxiFactor: 0.15 },
  TALGO:     { name: 'TALGO', capacity: 220, loadFactor: 0.70, taxiFactor: 0.15 },

  // Regional — locals, low taxi usage
  REGIONAL:  { name: 'Regional', capacity: 150, loadFactor: 0.55, taxiFactor: 0.05 },
  MD:        { name: 'Media Distancia', capacity: 200, loadFactor: 0.60, taxiFactor: 0.08 },
};

export interface TrainPaxEstimate {
  totalPax: number;
  taxiPax: number;
  trainType: string;
  capacity: number;
  loadFactor: number;
  origin: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract train type from the "tren" field
 * Examples: "AVE 03662" → "AVE", "EUROMED 01081" → "EUROMED"
 */
function extractTrainType(trenField: string): string {
  const upper = trenField.toUpperCase().trim();
  // Try exact match first
  for (const type of Object.keys(TRAIN_DB)) {
    if (upper.startsWith(type)) return type;
  }
  // Fallback patterns
  if (upper.includes('AVE')) return 'AVE';
  if (upper.includes('IRYO')) return 'IRYO';
  if (upper.includes('OUIGO')) return 'OUIGO';
  if (upper.includes('EUROMED')) return 'EUROMED';
  if (upper.includes('AVANT')) return 'AVANT';
  if (upper.includes('INTERCITY')) return 'INTERCITY';
  if (upper.includes('ALVIA')) return 'ALVIA';
  if (upper.includes('TALGO')) return 'TALGO';
  return 'REGIONAL';
}

/**
 * Estimate passengers for a single train arrival
 */
export function estimateTrainPax(
  trenField: string,
  origin: string,
): TrainPaxEstimate {
  const trainType = extractTrainType(trenField);
  const trainData = TRAIN_DB[trainType] || TRAIN_DB.REGIONAL;

  // Madrid trains tend to be fuller (busiest corridor in Spain)
  const isMadrid = origin.toUpperCase().includes('MADRID');
  const loadBoost = isMadrid ? 1.10 : 1.0;

  const totalPax = Math.round(trainData.capacity * trainData.loadFactor * loadBoost);
  const taxiPax = Math.round(totalPax * trainData.taxiFactor);

  return {
    totalPax,
    taxiPax,
    trainType: trainData.name,
    capacity: trainData.capacity,
    loadFactor: trainData.loadFactor * loadBoost,
    origin,
    confidence: trainData === TRAIN_DB.REGIONAL ? 'low' : 'high',
  };
}

// --- AGGREGATE FUNCTIONS ---

export interface ZonePaxForecast {
  zone: string;
  timeWindow: string;         // "HH:MM - HH:MM"
  totalPax: number;           // Total arriving passengers
  estimatedTaxiPax: number;   // Passengers that will want taxis
  flightCount: number;
  trainCount: number;
  cruisePax: number;
  topAirlines: string[];      // Top 3 airlines in this window
  avgConfidence: number;      // 0-1 average confidence
}

/**
 * Aggregate flight passenger estimates for a time window
 */
export function aggregateFlightPax(
  flights: Array<{ vuelo: string; origen: string; terminal: string; hora: string }>,
  startMinutes: number,
  endMinutes: number,
): { totalPax: number; taxiPax: number; count: number; airlines: string[] } {
  let totalPax = 0;
  let taxiPax = 0;
  let count = 0;
  const airlines: string[] = [];

  for (const flight of flights) {
    const [h, m] = (flight.hora || '00:00').split(':').map(Number);
    const flightMin = h * 60 + (m || 0);

    if (flightMin >= startMinutes && flightMin < endMinutes) {
      const est = estimateFlightPax(flight.vuelo, flight.origen, flight.terminal);
      totalPax += est.totalPax;
      taxiPax += est.taxiPax;
      count++;
      if (est.airline && !airlines.includes(est.airline)) {
        airlines.push(est.airline);
      }
    }
  }

  return { totalPax, taxiPax, count, airlines: airlines.slice(0, 5) };
}

/**
 * Aggregate train passenger estimates for a time window
 */
export function aggregateTrainPax(
  trains: Array<{ tren: string; origen: string; hora: string }>,
  startMinutes: number,
  endMinutes: number,
): { totalPax: number; taxiPax: number; count: number } {
  let totalPax = 0;
  let taxiPax = 0;
  let count = 0;

  for (const train of trains) {
    const [h, m] = (train.hora || '00:00').split(':').map(Number);
    const trainMin = h * 60 + (m || 0);

    if (trainMin >= startMinutes && trainMin < endMinutes) {
      const est = estimateTrainPax(train.tren, train.origen);
      totalPax += est.totalPax;
      taxiPax += est.taxiPax;
      count++;
    }
  }

  return { totalPax, taxiPax, count };
}

// --- EXPORTS FOR DEBUGGING/ADMIN ---

export { AIRLINE_DB, TRAIN_DB, SEASONAL_FACTOR, TAXI_DEMAND_FACTOR };
export { extractAirlineCode, extractTrainType, classifyRoute };
export type { RouteType, AirlineData, TrainTypeData };
