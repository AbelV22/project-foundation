import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWaitingTimes, getZoneWaitingTime, getZoneHasRealData, getZoneTaxistasActivos } from './useWaitingTimes';

interface ZoneRecommendation {
    zone: string;
    zoneName: string;
    type: 'airport' | 'train' | 'port' | 'city';
    score: number; // 0-100, higher = better
    waitingTime: number | null;
    hasRealData: boolean;
    taxistas: number;
    upcomingEvents: number; // Number of arrivals in next 60 min
    distance?: number; // minutes to reach
    reason: string;
}

interface UseWhereNextResult {
    recommendations: ZoneRecommendation[];
    bestOption: ZoneRecommendation | null;
    loading: boolean;
    refresh: () => void;
}

// Zone definitions with coordinates and metadata
const ZONES = [
    { id: 'T1', name: 'Terminal T1', type: 'airport' as const, lat: 41.2971, lng: 2.0785 },
    { id: 'T2', name: 'Terminal T2', type: 'airport' as const, lat: 41.3006, lng: 2.0736 },
    { id: 'PUENTE_AEREO', name: 'Puente Aéreo', type: 'airport' as const, lat: 41.2993, lng: 2.0830 },
    { id: 'T2C_EASY', name: 'T2C EasyJet', type: 'airport' as const, lat: 41.3006, lng: 2.0736 },
    { id: 'SANTS', name: 'Estación Sants', type: 'train' as const, lat: 41.3792, lng: 2.1404 },
];

// Estimate travel time in minutes (simplified distance calculation)
const estimateTravelTime = (fromLat: number, fromLng: number, toLat: number, toLng: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (toLat - fromLat) * Math.PI / 180;
    const dLng = (toLng - fromLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // km

    // Assume 25 km/h average speed in Barcelona
    return Math.round(distance / 25 * 60);
};

/**
 * Hook to get smart recommendations for where to go next
 */
export const useWhereNext = (currentLat?: number, currentLng?: number): UseWhereNextResult => {
    const [recommendations, setReCommendations] = useState<ZoneRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const { waitingTimes } = useWaitingTimes();

    const calculateRecommendations = useCallback(async () => {
        setLoading(true);

        try {
            // Fetch flight data for upcoming arrivals
            const flightsRes = await fetch('/vuelos.json?t=' + Date.now());
            const flights = await flightsRes.json();

            // Fetch train data
            const trainsRes = await fetch('/trenes_sants.json?t=' + Date.now());
            const trains = await trainsRes.json();

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // Count upcoming flights per terminal (next 60 min)
            const flightCounts: Record<string, number> = { T1: 0, T2: 0, PUENTE_AEREO: 0, T2C_EASY: 0 };

            if (Array.isArray(flights)) {
                flights.forEach((v: any) => {
                    if (v.estado?.toLowerCase().includes('cancelado') || v.estado?.toLowerCase().includes('finalizado')) return;

                    const [h, m] = (v.hora || '00:00').split(':').map(Number);
                    const flightMinutes = h * 60 + m;
                    if (flightMinutes >= currentMinutes && flightMinutes < currentMinutes + 60) {
                        const terminal = v.terminal?.toUpperCase() || '';
                        if (terminal.includes('T2C') || v.vuelo?.includes('EJU') || v.vuelo?.includes('EZY')) {
                            flightCounts.T2C_EASY++;
                        } else if (terminal.includes('T2')) {
                            flightCounts.T2++;
                        } else if (terminal.includes('T1')) {
                            flightCounts.T1++;
                        } else if (v.origen?.toUpperCase().includes('MADRID')) {
                            flightCounts.PUENTE_AEREO++;
                        }
                    }
                });
            }

            // Count upcoming trains (next 60 min)
            let trainCount = 0;
            if (Array.isArray(trains)) {
                trains.forEach((t: any) => {
                    const [h, m] = (t.hora || '00:00').split(':').map(Number);
                    const trainMinutes = h * 60 + m;
                    if (trainMinutes >= currentMinutes && trainMinutes < currentMinutes + 60) {
                        trainCount++;
                    }
                });
            }

            // Calculate score for each zone
            const recs: ZoneRecommendation[] = ZONES.map(zone => {
                const waitTime = getZoneWaitingTime(waitingTimes, zone.id);
                const hasReal = getZoneHasRealData(waitingTimes, zone.id);
                const taxistas = getZoneTaxistasActivos(waitingTimes, zone.id);
                const upcoming = zone.type === 'train' ? trainCount : (flightCounts[zone.id] || 0);

                // Calculate distance if we have current position
                let distance = 15; // Default 15 min
                if (currentLat && currentLng) {
                    distance = estimateTravelTime(currentLat, currentLng, zone.lat, zone.lng);
                }

                // Score calculation:
                // - More upcoming arrivals = higher score (+20 per arrival, max +60)
                // - Shorter wait time = higher score
                // - Fewer taxistas = higher score
                // - Shorter distance = slight bonus

                let score = 50; // Base score

                // Upcoming arrivals bonus (major factor)
                score += Math.min(upcoming * 15, 45);

                // Wait time factor (lower is better)
                if (waitTime !== null && hasReal) {
                    if (waitTime <= 10) score += 20;
                    else if (waitTime <= 20) score += 10;
                    else if (waitTime <= 30) score += 0;
                    else score -= 10;
                }

                // Competition factor (fewer taxistas = better)
                if (taxistas < 10) score += 15;
                else if (taxistas < 20) score += 5;
                else if (taxistas > 40) score -= 10;

                // Distance factor (small influence)
                if (distance <= 10) score += 5;
                else if (distance > 25) score -= 5;

                // Generate reason text
                let reason = '';
                if (upcoming >= 3) {
                    reason = `${upcoming} llegadas próx. 60min`;
                } else if (waitTime !== null && waitTime <= 15) {
                    reason = `Espera corta: ~${waitTime}min`;
                } else if (taxistas < 10) {
                    reason = 'Poca competencia';
                } else if (upcoming > 0) {
                    reason = `${upcoming} llegada${upcoming > 1 ? 's' : ''} próxima`;
                } else {
                    reason = 'Zona habitual';
                }

                return {
                    zone: zone.id,
                    zoneName: zone.name,
                    type: zone.type,
                    score: Math.max(0, Math.min(100, score)),
                    waitingTime: waitTime,
                    hasRealData: hasReal,
                    taxistas,
                    upcomingEvents: upcoming,
                    distance,
                    reason,
                };
            });

            // Sort by score descending
            recs.sort((a, b) => b.score - a.score);
            setReCommendations(recs);

        } catch (error) {
            console.error('[useWhereNext] Error:', error);
        } finally {
            setLoading(false);
        }
    }, [waitingTimes, currentLat, currentLng]);

    useEffect(() => {
        calculateRecommendations();
    }, [calculateRecommendations]);

    return {
        recommendations,
        bestOption: recommendations[0] || null,
        loading,
        refresh: calculateRecommendations,
    };
};
