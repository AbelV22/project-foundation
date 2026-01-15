import { useState, useEffect, useCallback } from 'react';
import { useWaitingTimes, getZoneWaitingTime, getZoneHasRealData, getZoneTaxistasActivos } from './useWaitingTimes';

interface ZoneRecommendation {
    zone: string;
    zoneName: string;
    type: 'airport' | 'train' | 'port' | 'city';
    score: number; // 0-100, higher = better
    waitingTime: number | null;
    hasRealData: boolean;
    taxistas: number;
    upcomingFlights: number; // flights in next 60 min
    upcomingTrains: number; // trains in next 60 min  
    distance: number; // minutes to reach
    reason: string;
}

interface DataStatus {
    flightsLoaded: number;
    trainsLoaded: number;
    lastUpdate: Date | null;
    errors: string[];
}

interface UseWhereNextResult {
    recommendations: ZoneRecommendation[];
    bestOption: ZoneRecommendation | null;
    loading: boolean;
    dataStatus: DataStatus;
    refresh: () => Promise<void>;
}

// Zone definitions with real coordinates
const ZONES = [
    { id: 'T1', name: 'Terminal T1', type: 'airport' as const, lat: 41.2971, lng: 2.0785 },
    { id: 'T2', name: 'Terminal T2', type: 'airport' as const, lat: 41.2974, lng: 2.0736 },
    { id: 'PUENTE_AEREO', name: 'Puente Aéreo', type: 'airport' as const, lat: 41.2993, lng: 2.0830 },
    { id: 'T2C_EASY', name: 'T2C EasyJet', type: 'airport' as const, lat: 41.2982, lng: 2.0720 },
    { id: 'SANTS', name: 'Estación Sants', type: 'train' as const, lat: 41.3792, lng: 2.1404 },
];

// Calculate distance between two points using Haversine formula
const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Estimate travel time considering Barcelona traffic (20-30 km/h average)
const estimateTravelMinutes = (distanceKm: number): number => {
    const averageSpeedKmH = 25;
    return Math.max(5, Math.round(distanceKm / averageSpeedKmH * 60));
};

/**
 * Hook to get smart recommendations for where to go next
 * Uses REAL data from vuelos.json, trenes_sants.json, and Supabase waiting times
 */
export const useWhereNext = (currentLat?: number, currentLng?: number): UseWhereNextResult => {
    const [recommendations, setRecommendations] = useState<ZoneRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [dataStatus, setDataStatus] = useState<DataStatus>({
        flightsLoaded: 0,
        trainsLoaded: 0,
        lastUpdate: null,
        errors: [],
    });
    const { waitingTimes, refresh: refreshWaitingTimes } = useWaitingTimes();

    const calculateRecommendations = useCallback(async () => {
        setLoading(true);
        const errors: string[] = [];
        let flightsData: any[] = [];
        let trainsData: any[] = [];

        console.log('[WhereNext] Starting calculation...');
        console.log('[WhereNext] Current position:', currentLat, currentLng);

        try {
            // Fetch FRESH flight data
            const flightsRes = await fetch('/vuelos.json?nocache=' + Date.now());
            if (!flightsRes.ok) throw new Error('Failed to fetch flights');
            flightsData = await flightsRes.json();
            console.log('[WhereNext] Loaded flights:', Array.isArray(flightsData) ? flightsData.length : 0);
        } catch (e) {
            console.error('[WhereNext] Flight fetch error:', e);
            errors.push('Error cargando vuelos');
        }

        try {
            // Fetch FRESH train data  
            const trainsRes = await fetch('/trenes_sants.json?nocache=' + Date.now());
            if (!trainsRes.ok) throw new Error('Failed to fetch trains');
            trainsData = await trainsRes.json();
            console.log('[WhereNext] Loaded trains:', Array.isArray(trainsData) ? trainsData.length : 0);
        } catch (e) {
            console.error('[WhereNext] Train fetch error:', e);
            errors.push('Error cargando trenes');
        }

        // Refresh waiting times from Supabase
        try {
            await refreshWaitingTimes();
            console.log('[WhereNext] Refreshed waiting times');
        } catch (e) {
            console.error('[WhereNext] Waiting times error:', e);
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        console.log('[WhereNext] Current time:', now.toLocaleTimeString(), 'minutes:', currentMinutes);

        // Count upcoming flights per terminal (next 60 min)
        const flightCounts: Record<string, number> = { T1: 0, T2: 0, PUENTE_AEREO: 0, T2C_EASY: 0 };

        if (Array.isArray(flightsData)) {
            flightsData.forEach((v: any) => {
                // Skip cancelled or finished flights
                const estado = (v.estado || '').toLowerCase();
                if (estado.includes('cancelado') || estado.includes('finalizado')) return;

                // Parse flight time
                const [h, m] = (v.hora || '00:00').split(':').map(Number);
                let flightMinutes = h * 60 + (m || 0);

                // Handle day_relative for next-day flights
                if (v.dia_relativo === 1) {
                    flightMinutes += 24 * 60;
                }

                // Check if within next 60 minutes
                if (flightMinutes >= currentMinutes && flightMinutes < currentMinutes + 60) {
                    const terminal = (v.terminal || '').toUpperCase();
                    const vuelo = (v.vuelo || '').toUpperCase();
                    const origen = (v.origen || '').toUpperCase();

                    // Classify by terminal
                    if (terminal.includes('T2C') || vuelo.includes('EJU') || vuelo.includes('EZY')) {
                        flightCounts.T2C_EASY++;
                    } else if (terminal.includes('T2B') || terminal.includes('T2A')) {
                        flightCounts.T2++;
                    } else if (terminal.includes('T1')) {
                        flightCounts.T1++;
                    } else if (origen.includes('MADRID') && vuelo.includes('IB')) {
                        flightCounts.PUENTE_AEREO++;
                    } else {
                        // Default to T1 for unknown
                        flightCounts.T1++;
                    }
                }
            });
        }

        console.log('[WhereNext] Flight counts next 60min:', flightCounts);

        // Count upcoming trains (next 60 min)
        let trainCount = 0;
        if (Array.isArray(trainsData)) {
            trainsData.forEach((t: any) => {
                const [h, m] = (t.hora || '00:00').split(':').map(Number);
                const trainMinutes = h * 60 + (m || 0);
                if (trainMinutes >= currentMinutes && trainMinutes < currentMinutes + 60) {
                    trainCount++;
                }
            });
        }
        console.log('[WhereNext] Train count next 60min:', trainCount);

        // Calculate score for each zone
        const recs: ZoneRecommendation[] = ZONES.map(zone => {
            const waitTime = getZoneWaitingTime(waitingTimes, zone.id);
            const hasReal = getZoneHasRealData(waitingTimes, zone.id);
            const taxistas = getZoneTaxistasActivos(waitingTimes, zone.id);

            const upcomingFlights = zone.type === 'train' ? 0 : (flightCounts[zone.id] || 0);
            const upcomingTrains = zone.type === 'train' ? trainCount : 0;
            const totalUpcoming = upcomingFlights + upcomingTrains;

            // Calculate distance
            let distance = 15; // Default
            if (currentLat && currentLng) {
                const distKm = calculateDistanceKm(currentLat, currentLng, zone.lat, zone.lng);
                distance = estimateTravelMinutes(distKm);
            }

            // SCORING ALGORITHM
            // Base: 40 points
            // Max possible: 100
            let score = 40;

            // Factor 1: Upcoming arrivals (major factor) - up to +35 points
            if (totalUpcoming >= 5) score += 35;
            else if (totalUpcoming >= 3) score += 25;
            else if (totalUpcoming >= 2) score += 18;
            else if (totalUpcoming >= 1) score += 10;

            // Factor 2: Wait time (if real data) - up to +20 points
            if (waitTime !== null && hasReal) {
                if (waitTime <= 10) score += 20;
                else if (waitTime <= 20) score += 12;
                else if (waitTime <= 30) score += 5;
                else if (waitTime > 45) score -= 10;
            }

            // Factor 3: Competition - up to +15 points
            if (taxistas === 0) score += 15;
            else if (taxistas < 5) score += 12;
            else if (taxistas < 15) score += 6;
            else if (taxistas > 30) score -= 8;

            // Factor 4: Distance penalty (small) - up to -10 points
            if (distance > 30) score -= 10;
            else if (distance > 20) score -= 5;

            // Generate human-readable reason
            let reason = '';
            if (totalUpcoming >= 3) {
                reason = `🔥 ${totalUpcoming} llegadas en próx. hora`;
            } else if (waitTime !== null && hasReal && waitTime <= 15) {
                reason = `⏱️ Espera corta (~${waitTime} min)`;
            } else if (taxistas < 5) {
                reason = `👥 Poca competencia (${taxistas} taxis)`;
            } else if (totalUpcoming > 0) {
                reason = `✈️ ${totalUpcoming} llegada${totalUpcoming > 1 ? 's' : ''} próxima`;
            } else {
                reason = '📍 Zona sin datos recientes';
            }

            return {
                zone: zone.id,
                zoneName: zone.name,
                type: zone.type,
                score: Math.max(0, Math.min(100, Math.round(score))),
                waitingTime: waitTime,
                hasRealData: hasReal,
                taxistas,
                upcomingFlights,
                upcomingTrains,
                distance,
                reason,
            };
        });

        // Sort by score descending
        recs.sort((a, b) => b.score - a.score);

        console.log('[WhereNext] Recommendations:', recs.map(r => `${r.zoneName}: ${r.score}`).join(', '));

        setRecommendations(recs);
        setDataStatus({
            flightsLoaded: Array.isArray(flightsData) ? flightsData.length : 0,
            trainsLoaded: Array.isArray(trainsData) ? trainsData.length : 0,
            lastUpdate: new Date(),
            errors,
        });
        setLoading(false);
    }, [currentLat, currentLng, waitingTimes, refreshWaitingTimes]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            calculateRecommendations();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [calculateRecommendations]);

    return {
        recommendations,
        bestOption: recommendations[0] || null,
        loading,
        dataStatus,
        refresh: calculateRecommendations,
    };
};
