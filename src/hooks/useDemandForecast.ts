import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWaitingTimes, getZoneWaitingTime, getZoneHasRealData, getZoneTaxistasActivos } from './useWaitingTimes';
import { useWeather } from './useWeather';
import { useEvents, FormattedEvent } from './useEvents';
import { useCruises, Crucero } from './useCruises';
import {
  estimateFlightPax,
  estimateTrainPax,
  aggregateFlightPax,
  aggregateTrainPax,
} from '@/lib/passengerEstimation';
import { deduplicateFlights } from '@/lib/flightUtils';

// --- TYPES ---

export interface DemandFactor {
  source: string;       // "flights" | "trains" | "cruises" | "events" | "weather"
  label: string;        // Human-readable: "3 vuelos (520 pax)"
  impact: number;       // Score contribution (-20 to +40)
  icon: string;         // Emoji
}

export interface ZoneForecast {
  zone: string;
  zoneName: string;
  type: 'airport' | 'train' | 'port';
  // Demand score
  demandScore: number;        // 0-100
  demandLevel: 'muy-bajo' | 'bajo' | 'medio' | 'alto' | 'muy-alto';
  trend: 'subiendo' | 'estable' | 'bajando';
  // Passenger estimates
  totalPax: number;           // Total estimated arriving passengers
  taxiPax: number;            // Estimated taxi passengers
  // Transport counts
  flightCount: number;
  trainCount: number;
  cruisePax: number;
  // Current conditions
  waitingTime: number | null;
  hasRealWaitData: boolean;
  taxistasActivos: number;
  // Factors breakdown
  factors: DemandFactor[];
  // Metadata
  recommendation: string;     // Human-readable recommendation
  confidence: number;         // 0-100
}

export interface HourlySlot {
  hour: string;               // "14:00"
  startMinutes: number;
  endMinutes: number;
  zones: ZoneForecast[];
  peakZone: string;           // Zone with highest demand
  totalPaxAllZones: number;
}

export interface DemandForecastResult {
  // Current hour forecast (most relevant)
  currentHour: HourlySlot | null;
  // Next 3 hours
  hourlyForecast: HourlySlot[];
  // Best recommendation right now
  bestZone: ZoneForecast | null;
  // Global signals
  weatherMultiplier: number;
  isRainBoost: boolean;
  activeEvents: FormattedEvent[];
  upcomingCruises: Crucero[];
  // Status
  loading: boolean;
  lastUpdate: Date | null;
  dataQuality: {
    flights: boolean;
    trains: boolean;
    cruises: boolean;
    events: boolean;
    weather: boolean;
    waitingTimes: boolean;
  };
  refresh: () => Promise<void>;
}

// --- ZONE DEFINITIONS ---

const ZONES = [
  { id: 'T1', name: 'Terminal T1', type: 'airport' as const },
  { id: 'T2', name: 'Terminal T2', type: 'airport' as const },
  { id: 'PUENTE_AEREO', name: 'Puente Aéreo', type: 'airport' as const },
  { id: 'T2C_EASY', name: 'T2C EasyJet', type: 'airport' as const },
  { id: 'SANTS', name: 'Estación Sants', type: 'train' as const },
];

// Map terminals from flight data to our zones
function mapTerminalToZone(terminal: string, vuelo: string, origen: string): string {
  const t = (terminal || '').toUpperCase();
  const v = (vuelo || '').toUpperCase();
  const o = (origen || '').toUpperCase();

  if (t.includes('T2C') || v.includes('EJU') || v.includes('EZY') || v.includes('U2')) return 'T2C_EASY';
  if (t.includes('T2B') || t.includes('T2A') || t === 'T2-') return 'T2';
  if (t.includes('T1')) {
    // Check for Puente Aéreo (Madrid shuttle flights by Iberia)
    if (o.includes('MADRID') && (v.includes('IBE') || v.includes('IB'))) return 'PUENTE_AEREO';
    return 'T1';
  }
  return 'T1'; // Default
}

// --- WEATHER MULTIPLIER ---
// Rain significantly increases taxi demand

function calculateWeatherMultiplier(
  rainProbability: number,
  isRaining: boolean,
  forecast: Array<{ rain: number }>,
): number {
  // Base: 1.0 (no effect)
  let multiplier = 1.0;

  if (isRaining) {
    multiplier = 1.35; // Currently raining = +35% taxi demand
  } else if (rainProbability >= 70) {
    multiplier = 1.25; // High probability = +25%
  } else if (rainProbability >= 50) {
    multiplier = 1.15; // Moderate probability = +15%
  } else if (rainProbability >= 30) {
    multiplier = 1.05; // Slight chance = +5%
  }

  // Check if rain is coming in next hours (from forecast)
  if (forecast && forecast.length > 0) {
    const maxFutureRain = Math.max(...forecast.map(f => f.rain));
    if (maxFutureRain >= 80 && multiplier < 1.20) {
      multiplier = 1.20; // Rain coming soon
    }
  }

  return multiplier;
}

// --- EVENT DEMAND CONTRIBUTION ---

interface EventDemandSignal {
  label: string;
  taxiPax: number;
  icon: string;
}

function calculateEventDemand(
  events: FormattedEvent[],
  startMinutes: number,
  endMinutes: number,
): EventDemandSignal[] {
  const signals: EventDemandSignal[] = [];

  for (const event of events) {
    if (!event.postEventDemand) continue;

    // Parse event demand window
    const [demandStartH, demandStartM] = event.postEventDemand.start.split(':').map(Number);
    const [demandEndH, demandEndM] = event.postEventDemand.end.split(':').map(Number);
    const demandStart = demandStartH * 60 + demandStartM;
    const demandEnd = demandEndH * 60 + demandEndM;

    // Check overlap with our time window
    if (demandStart < endMinutes && demandEnd > startMinutes) {
      // Estimate taxi demand from event
      const taxiFactor = event.type === 'Music' || event.type === 'Sports' ? 0.08 : 0.05;
      const taxiPax = Math.round(event.attendees * taxiFactor);

      const icon = event.type === 'Music' ? '🎵' :
                   event.type === 'Sports' ? '⚽' :
                   event.type === 'Congress' ? '🏢' : '🎭';

      signals.push({
        label: `${event.title} (${(event.attendees / 1000).toFixed(0)}k pax)`,
        taxiPax,
        icon,
      });
    }
  }

  return signals;
}

// --- DEMAND LEVEL CLASSIFICATION ---

function classifyDemand(score: number): ZoneForecast['demandLevel'] {
  if (score >= 80) return 'muy-alto';
  if (score >= 60) return 'alto';
  if (score >= 40) return 'medio';
  if (score >= 20) return 'bajo';
  return 'muy-bajo';
}

function generateRecommendation(forecast: ZoneForecast): string {
  const { demandLevel, flightCount, trainCount, taxiPax, taxistasActivos, factors } = forecast;

  if (demandLevel === 'muy-alto') {
    const main = factors[0]?.label || '';
    return `🔥 Demanda muy alta — ${main}`;
  }
  if (demandLevel === 'alto') {
    if (taxistasActivos > 0 && taxiPax > 0) {
      const ratio = Math.round(taxiPax / Math.max(taxistasActivos, 1));
      return `⬆️ ${ratio} pax/taxi estimados — buena oportunidad`;
    }
    return `⬆️ Demanda alta — ${flightCount + trainCount} llegadas próximas`;
  }
  if (demandLevel === 'medio') {
    return `➡️ Demanda moderada — actividad normal`;
  }
  if (demandLevel === 'bajo') {
    return `⬇️ Pocas llegadas previstas — considera otra zona`;
  }
  return `⏸️ Sin actividad significativa prevista`;
}

// --- MAIN HOOK ---

export function useDemandForecast(): DemandForecastResult {
  const [hourlyForecast, setHourlyForecast] = useState<HourlySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [flightsData, setFlightsData] = useState<any[]>([]);
  const [trainsData, setTrainsData] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState({
    flights: false, trains: false, cruises: false,
    events: false, weather: false, waitingTimes: false,
  });

  const { waitingTimes } = useWaitingTimes();
  const { weather, isRaining, isRainAlert } = useWeather();
  const { events } = useEvents();
  const { llegadas: cruiseLlegadas, getUpcomingArrivals } = useCruises();

  // Fetch raw transport data
  const fetchTransportData = useCallback(async () => {
    const quality = { ...dataQuality };

    try {
      const flightsRes = await fetch('/vuelos.json?t=' + Date.now());
      if (flightsRes.ok) {
        const data = await flightsRes.json();
        if (Array.isArray(data)) {
          setFlightsData(deduplicateFlights(data));
          quality.flights = true;
        }
      }
    } catch { /* silent */ }

    try {
      const trainsRes = await fetch('/trenes_sants.json?t=' + Date.now());
      if (trainsRes.ok) {
        const data = await trainsRes.json();
        if (Array.isArray(data)) {
          setTrainsData(data);
          quality.trains = true;
        }
      }
    } catch { /* silent */ }

    quality.weather = !!weather;
    quality.events = events.length > 0;
    quality.cruises = cruiseLlegadas.length > 0;
    quality.waitingTimes = Object.keys(waitingTimes).length > 0;

    setDataQuality(quality);
  }, [weather, events, cruiseLlegadas, waitingTimes]);

  // Weather multiplier
  const weatherMultiplier = useMemo(() => {
    if (!weather) return 1.0;
    return calculateWeatherMultiplier(
      weather.rainProbability,
      isRaining,
      weather.forecast,
    );
  }, [weather, isRaining]);

  // Active events (today, with demand windows)
  const activeEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => {
      const eventDate = e.rawDate?.split('T')[0] || '';
      return eventDate === today && e.status !== 'ended';
    });
  }, [events]);

  // Upcoming cruises
  const upcomingCruises = useMemo(() => getUpcomingArrivals(3), [getUpcomingArrivals]);

  // Calculate forecast
  const calculateForecast = useCallback(async () => {
    setLoading(true);
    await fetchTransportData();

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = currentHour * 60 + now.getMinutes();

    // Filter usable flights (not cancelled/finished)
    const usableFlights = flightsData.filter((v: any) => {
      const estado = (v.estado || '').toLowerCase();
      return !estado.includes('cancelado') && !estado.includes('finalizado');
    });

    // Generate 4 hourly slots (current hour + next 3)
    const slots: HourlySlot[] = [];

    for (let i = 0; i < 4; i++) {
      const slotHour = currentHour + i;
      if (slotHour >= 24) break;

      const startMin = i === 0 ? currentMinutes : slotHour * 60;
      const endMin = (slotHour + 1) * 60;
      const hourLabel = `${String(slotHour).padStart(2, '0')}:00`;

      // Calculate per zone
      const zoneForecastsArr: ZoneForecast[] = ZONES.map(zone => {
        const factors: DemandFactor[] = [];
        let totalPax = 0;
        let taxiPax = 0;
        let flightCount = 0;
        let trainCount = 0;
        let cruisePax = 0;
        let confidenceSum = 0;
        let confidenceCount = 0;

        // --- FLIGHTS ---
        if (zone.type === 'airport') {
          // Filter flights for this zone
          const zoneFlights = usableFlights.filter((v: any) => {
            const mapped = mapTerminalToZone(v.terminal, v.vuelo, v.origen);
            return mapped === zone.id;
          });

          const flightAgg = aggregateFlightPax(
            zoneFlights.map((v: any) => ({
              vuelo: v.vuelo,
              origen: v.origen,
              terminal: v.terminal,
              hora: v.hora,
            })),
            startMin,
            endMin,
          );

          if (flightAgg.count > 0) {
            totalPax += flightAgg.totalPax;
            taxiPax += flightAgg.taxiPax;
            flightCount = flightAgg.count;
            confidenceSum += 0.8;
            confidenceCount++;

            factors.push({
              source: 'flights',
              label: `${flightAgg.count} vuelo${flightAgg.count > 1 ? 's' : ''} (${flightAgg.totalPax} pax)`,
              impact: Math.min(40, Math.round(flightAgg.taxiPax / 3)),
              icon: '✈️',
            });
          }
        }

        // --- TRAINS ---
        if (zone.id === 'SANTS') {
          const trainAgg = aggregateTrainPax(
            trainsData.map((t: any) => ({
              tren: t.tren,
              origen: t.origen,
              hora: t.hora,
            })),
            startMin,
            endMin,
          );

          if (trainAgg.count > 0) {
            totalPax += trainAgg.totalPax;
            taxiPax += trainAgg.taxiPax;
            trainCount = trainAgg.count;
            confidenceSum += 0.85;
            confidenceCount++;

            factors.push({
              source: 'trains',
              label: `${trainAgg.count} tren${trainAgg.count > 1 ? 'es' : ''} (${trainAgg.totalPax} pax)`,
              impact: Math.min(35, Math.round(trainAgg.taxiPax / 2)),
              icon: '🚄',
            });
          }
        }

        // --- CRUISES ---
        // Cruises affect general city demand, primarily port area
        // but passengers also go to airport, so slight boost to all zones
        const cruisesInWindow = upcomingCruises.filter(c => {
          const [h, m] = c.hora.split(':').map(Number);
          const cruiseMin = h * 60 + m;
          return cruiseMin >= startMin && cruiseMin < endMin;
        });

        if (cruisesInWindow.length > 0) {
          const cruiseTotalPax = cruisesInWindow.reduce((sum, c) => sum + (c.pax_estimados || 0), 0);
          // ~48% of cruise passengers use taxis (port studies)
          const cruiseTaxiPax = Math.round(cruiseTotalPax * 0.15); // Distributed across city
          cruisePax = cruiseTotalPax;

          // Airport zones get a small boost (some passengers connect to flights)
          const zoneShare = zone.type === 'airport' ? 0.10 : 0;
          const zoneCruiseTaxi = Math.round(cruiseTaxiPax * zoneShare);

          if (zoneCruiseTaxi > 0) {
            taxiPax += zoneCruiseTaxi;
            confidenceSum += 0.9;
            confidenceCount++;

            factors.push({
              source: 'cruises',
              label: `${cruisesInWindow.length} crucero${cruisesInWindow.length > 1 ? 's' : ''} (${cruiseTotalPax} pax)`,
              impact: Math.min(15, Math.round(zoneCruiseTaxi / 2)),
              icon: '🚢',
            });
          }
        }

        // --- EVENTS ---
        const eventSignals = calculateEventDemand(activeEvents, startMin, endMin);
        if (eventSignals.length > 0) {
          const eventTaxiTotal = eventSignals.reduce((sum, s) => sum + s.taxiPax, 0);
          // Events primarily affect city taxis, but some go to airport/sants
          const zoneEventShare = zone.type === 'airport' ? 0.05 : zone.id === 'SANTS' ? 0.08 : 0;
          const zoneEventTaxi = Math.round(eventTaxiTotal * zoneEventShare);

          if (zoneEventTaxi > 0 || eventSignals.some(s => s.taxiPax > 50)) {
            taxiPax += zoneEventTaxi;

            for (const signal of eventSignals.slice(0, 2)) {
              factors.push({
                source: 'events',
                label: signal.label,
                impact: Math.min(20, Math.round(signal.taxiPax / 10)),
                icon: signal.icon,
              });
            }
          }
        }

        // --- WEATHER ---
        if (weatherMultiplier > 1.0) {
          const weatherBoost = Math.round((weatherMultiplier - 1) * taxiPax);
          taxiPax += weatherBoost;

          factors.push({
            source: 'weather',
            label: isRaining ? 'Lluvia activa' :
                   `Prob. lluvia ${weather?.rainProbability}%`,
            impact: Math.round((weatherMultiplier - 1) * 30),
            icon: isRaining ? '🌧️' : '🌦️',
          });
        }

        // --- SUPPLY CONTEXT (waiting times) ---
        const waitTime = getZoneWaitingTime(waitingTimes, zone.id);
        const hasRealWait = getZoneHasRealData(waitingTimes, zone.id);
        const taxistas = getZoneTaxistasActivos(waitingTimes, zone.id);

        if (hasRealWait && waitTime !== null) {
          confidenceSum += 1.0;
          confidenceCount++;
        }

        // --- DEMAND SCORE CALCULATION ---
        // Base: 20 (some baseline activity always)
        let score = 20;

        // Factor 1: Taxi passenger volume (biggest weight, 0-40 pts)
        if (taxiPax >= 100) score += 40;
        else if (taxiPax >= 60) score += 32;
        else if (taxiPax >= 40) score += 25;
        else if (taxiPax >= 20) score += 18;
        else if (taxiPax >= 10) score += 12;
        else if (taxiPax >= 5) score += 6;

        // Factor 2: Arrival density - many arrivals in short time (0-20 pts)
        const arrivalCount = flightCount + trainCount;
        if (arrivalCount >= 8) score += 20;
        else if (arrivalCount >= 5) score += 15;
        else if (arrivalCount >= 3) score += 10;
        else if (arrivalCount >= 1) score += 5;

        // Factor 3: Supply/demand ratio bonus (0-15 pts)
        if (taxistas === 0 && taxiPax > 0) score += 15;
        else if (taxistas > 0 && taxiPax > 0) {
          const ratio = taxiPax / taxistas;
          if (ratio >= 5) score += 12;
          else if (ratio >= 3) score += 8;
          else if (ratio >= 1.5) score += 4;
        }

        // Factor 4: Long wait penalty (-10 pts)
        if (hasRealWait && waitTime !== null && waitTime > 45) {
          score -= 10;
          factors.push({
            source: 'wait',
            label: `Espera actual: ${waitTime} min`,
            impact: -10,
            icon: '⏳',
          });
        }

        // Weather already factored into taxiPax

        // Clamp
        score = Math.max(0, Math.min(100, Math.round(score)));

        // Confidence
        const confidence = confidenceCount > 0
          ? Math.round((confidenceSum / confidenceCount) * 100)
          : 30; // Low confidence if no data sources

        // Sort factors by impact
        factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

        const forecast: ZoneForecast = {
          zone: zone.id,
          zoneName: zone.name,
          type: zone.type,
          demandScore: score,
          demandLevel: classifyDemand(score),
          trend: 'estable', // Will be calculated after comparing slots
          totalPax,
          taxiPax,
          flightCount,
          trainCount,
          cruisePax,
          waitingTime: waitTime,
          hasRealWaitData: hasRealWait,
          taxistasActivos: taxistas,
          factors,
          recommendation: '', // Set below
          confidence,
        };

        forecast.recommendation = generateRecommendation(forecast);
        return forecast;
      });

      // Sort zones by demand score
      zoneForecastsArr.sort((a, b) => b.demandScore - a.demandScore);

      slots.push({
        hour: hourLabel,
        startMinutes: startMin,
        endMinutes: endMin,
        zones: zoneForecastsArr,
        peakZone: zoneForecastsArr[0]?.zone || '',
        totalPaxAllZones: zoneForecastsArr.reduce((s, z) => s + z.totalPax, 0),
      });
    }

    // Calculate trends by comparing adjacent slots
    for (let i = 1; i < slots.length; i++) {
      for (const zone of slots[i].zones) {
        const prevZone = slots[i - 1].zones.find(z => z.zone === zone.zone);
        if (prevZone) {
          const diff = zone.demandScore - prevZone.demandScore;
          if (diff >= 10) zone.trend = 'subiendo';
          else if (diff <= -10) zone.trend = 'bajando';
          else zone.trend = 'estable';
        }
      }
    }

    setHourlyForecast(slots);
    setLastUpdate(new Date());
    setLoading(false);
  }, [flightsData, trainsData, waitingTimes, weatherMultiplier, isRaining, weather, activeEvents, upcomingCruises, fetchTransportData]);

  // Initial load + auto-refresh every 3 minutes
  useEffect(() => {
    calculateForecast();
    const interval = setInterval(calculateForecast, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [calculateForecast]);

  // Derived values
  const currentHour = hourlyForecast[0] || null;
  const bestZone = currentHour?.zones[0] || null;

  return {
    currentHour,
    hourlyForecast,
    bestZone,
    weatherMultiplier,
    isRainBoost: weatherMultiplier > 1.0,
    activeEvents,
    upcomingCruises,
    loading,
    lastUpdate,
    dataQuality,
    refresh: calculateForecast,
  };
}
