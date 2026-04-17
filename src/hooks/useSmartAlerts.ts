import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { useDemandForecast, ZoneForecast } from './useDemandForecast';
import { useWeather } from './useWeather';

// --- TYPES ---

export type AlertType = 'flight_peak' | 'rain_demand' | 'event_surge' | 'high_demand' | 'cruise_arrival' | 'low_supply';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SmartAlert {
    id: string;
    device_id: string;
    alert_type: AlertType;
    title: string;
    description: string | null;
    emoji: string;
    severity: AlertSeverity;
    zone: string | null;
    demand_score: number | null;
    metadata: Record<string, any>;
    read: boolean;
    dismissed: boolean;
    expires_at: string;
    created_at: string;
}

// --- FALLBACK BASELINES (used when no real data yet) ---
// Based on typical BCN airport/Sants patterns by hour of day

const FALLBACK_FLIGHT_BASELINES: Record<number, number> = {
    0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1,
    6: 3, 7: 5, 8: 7, 9: 8, 10: 9, 11: 8,
    12: 7, 13: 8, 14: 9, 15: 8, 16: 7, 17: 8,
    18: 9, 19: 10, 20: 9, 21: 8, 22: 6, 23: 3,
};

const FALLBACK_DEMAND_BASELINES: Record<number, number> = {
    0: 25, 1: 20, 2: 20, 3: 20, 4: 20, 5: 25,
    6: 35, 7: 40, 8: 45, 9: 50, 10: 50, 11: 45,
    12: 45, 13: 50, 14: 50, 15: 45, 16: 45, 17: 50,
    18: 55, 19: 55, 20: 50, 21: 45, 22: 35, 23: 30,
};

// Minimum samples needed to trust real baselines over fallbacks
const MIN_BASELINE_SAMPLES = 3;

interface ZoneBaseline {
    avg_flights: number;
    avg_pax: number;
    avg_trains: number;
    avg_demand_score: number;
    sample_count: number;
}

// How much above baseline triggers an alert (multiplier)
const SPIKE_THRESHOLD = 1.5;    // 50% above normal = notable
const CRITICAL_THRESHOLD = 2.0; // 100% above normal = critical

// --- DEDUP KEY ---
// Prevent duplicate alerts within a time window
function alertDedupeKey(type: AlertType, zone: string | null, hour: number): string {
    return `${type}:${zone || 'global'}:${hour}`;
}

// --- MAIN HOOK ---

export function useSmartAlerts() {
    const [alerts, setAlerts] = useState<SmartAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [realBaselines, setRealBaselines] = useState<Record<string, ZoneBaseline>>({});
    const recentKeysRef = useRef<Set<string>>(new Set());
    const lastCheckRef = useRef<number>(0);

    const { currentHour, hourlyForecast, weatherMultiplier, isRainBoost, activeEvents, upcomingCruises } = useDemandForecast();
    const { weather, isRaining, isRainAlert } = useWeather();

    const deviceId = getOrCreateDeviceId();

    // Fetch real baselines for current day/hour
    const fetchBaselines = useCallback(async () => {
        try {
            const now = new Date();
            const { data, error } = await supabase
                .from('transport_hourly_baselines')
                .select('*')
                .eq('day_of_week', now.getDay())
                .eq('hour_of_day', now.getHours());

            if (error) throw error;
            const map: Record<string, ZoneBaseline> = {};
            for (const row of (data || [])) {
                map[row.zone] = {
                    avg_flights: Number(row.avg_flights),
                    avg_pax: Number(row.avg_pax),
                    avg_trains: Number(row.avg_trains),
                    avg_demand_score: Number(row.avg_demand_score),
                    sample_count: row.sample_count,
                };
            }
            setRealBaselines(map);
        } catch (err) {
            console.error('[useSmartAlerts] Baseline fetch error:', err);
        }
    }, []);

    // Helper: get baseline for a zone, use real data if available
    const getBaseline = useCallback((zone: string, hourNum: number) => {
        const real = realBaselines[zone];
        if (real && real.sample_count >= MIN_BASELINE_SAMPLES) {
            return {
                flights: real.avg_flights,
                demand: real.avg_demand_score,
                isReal: true,
                samples: real.sample_count,
            };
        }
        return {
            flights: FALLBACK_FLIGHT_BASELINES[hourNum] || 5,
            demand: FALLBACK_DEMAND_BASELINES[hourNum] || 40,
            isReal: false,
            samples: 0,
        };
    }, [realBaselines]);

    // Fetch existing active alerts from DB
    const fetchAlerts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('smart_alerts')
                .select('*')
                .eq('device_id', deviceId)
                .eq('dismissed', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setAlerts((data || []) as SmartAlert[]);

            // Build dedup set from recent alerts (last 2 hours)
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
            const recentAlerts = (data || []).filter((a: any) => a.created_at > twoHoursAgo);
            const keys = new Set<string>();
            for (const a of recentAlerts) {
                const hour = new Date(a.created_at).getHours();
                keys.add(alertDedupeKey(a.alert_type as AlertType, a.zone, hour));
            }
            recentKeysRef.current = keys;
        } catch (err) {
            console.error('[useSmartAlerts] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    // Create a new alert (with dedup)
    const createAlert = useCallback(async (alert: {
        alert_type: AlertType;
        title: string;
        description?: string;
        emoji?: string;
        severity?: AlertSeverity;
        zone?: string;
        demand_score?: number;
        metadata?: Record<string, any>;
    }) => {
        const hour = new Date().getHours();
        const key = alertDedupeKey(alert.alert_type, alert.zone || null, hour);

        // Skip if already generated this alert recently
        if (recentKeysRef.current.has(key)) return;
        recentKeysRef.current.add(key);

        try {
            const { error } = await supabase
                .from('smart_alerts')
                .insert({
                    device_id: deviceId,
                    alert_type: alert.alert_type,
                    title: alert.title,
                    description: alert.description || null,
                    emoji: alert.emoji || '🔔',
                    severity: alert.severity || 'info',
                    zone: alert.zone || null,
                    demand_score: alert.demand_score || null,
                    metadata: alert.metadata || {},
                });

            if (error) throw error;
            await fetchAlerts();
        } catch (err) {
            console.error('[useSmartAlerts] Create error:', err);
        }
    }, [deviceId, fetchAlerts]);

    // Dismiss an alert
    const dismissAlert = useCallback(async (alertId: string) => {
        try {
            await supabase
                .from('smart_alerts')
                .update({ dismissed: true })
                .eq('id', alertId);

            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (err) {
            console.error('[useSmartAlerts] Dismiss error:', err);
        }
    }, []);

    // Mark alert as read
    const markAsRead = useCallback(async (alertId: string) => {
        try {
            await supabase
                .from('smart_alerts')
                .update({ read: true })
                .eq('id', alertId);

            setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
        } catch (err) {
            console.error('[useSmartAlerts] Mark read error:', err);
        }
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        const unread = alerts.filter(a => !a.read);
        if (unread.length === 0) return;

        try {
            await supabase
                .from('smart_alerts')
                .update({ read: true })
                .eq('device_id', deviceId)
                .eq('read', false);

            setAlerts(prev => prev.map(a => ({ ...a, read: true })));
        } catch (err) {
            console.error('[useSmartAlerts] Mark all read error:', err);
        }
    }, [alerts, deviceId]);

    // --- ANOMALY DETECTION ENGINE ---
    const detectAnomalies = useCallback(() => {
        const now = new Date();
        const currentHourNum = now.getHours();

        // Don't check more than once every 5 minutes
        if (Date.now() - lastCheckRef.current < 5 * 60 * 1000) return;
        lastCheckRef.current = Date.now();

        if (!currentHour) return;

        // Check each zone in current hour
        for (const zone of currentHour.zones) {
            const baseline = getBaseline(zone.zone, currentHourNum);
            const baselineFlights = baseline.flights;
            const baselineDemand = baseline.demand;
            const dataSource = baseline.isReal ? `(basado en ${baseline.samples} muestras reales)` : '(estimación)';

            // 1. FLIGHT PEAK — unusually high flight arrivals
            if (zone.type === 'airport' && zone.flightCount > 0) {
                const ratio = zone.flightCount / Math.max(baselineFlights, 1);
                if (ratio >= CRITICAL_THRESHOLD) {
                    createAlert({
                        alert_type: 'flight_peak',
                        title: `Pico de vuelos en ${zone.zoneName}`,
                        description: `${zone.flightCount} vuelos llegando (lo normal son ${Math.round(baselineFlights)}) ${dataSource}. ~${zone.taxiPax} pasajeros de taxi estimados.`,
                        emoji: '✈️',
                        severity: 'critical',
                        zone: zone.zone,
                        demand_score: zone.demandScore,
                        metadata: {
                            flight_count: zone.flightCount,
                            baseline: Math.round(baselineFlights),
                            ratio: Math.round(ratio * 100) / 100,
                            taxi_pax: zone.taxiPax,
                            real_baseline: baseline.isReal,
                        },
                    });
                } else if (ratio >= SPIKE_THRESHOLD && zone.flightCount >= 3) {
                    createAlert({
                        alert_type: 'flight_peak',
                        title: `Más vuelos de lo habitual en ${zone.zoneName}`,
                        description: `${zone.flightCount} vuelos (${Math.round((ratio - 1) * 100)}% más de lo normal). Buen momento para ir.`,
                        emoji: '✈️',
                        severity: 'warning',
                        zone: zone.zone,
                        demand_score: zone.demandScore,
                        metadata: {
                            flight_count: zone.flightCount,
                            baseline: baselineFlights,
                            ratio: Math.round(ratio * 100) / 100,
                        },
                    });
                }
            }

            // 2. HIGH DEMAND — demand score well above normal for this hour
            if (zone.demandScore >= 70 && zone.demandScore > baselineDemand * SPIKE_THRESHOLD) {
                const severity: AlertSeverity = zone.demandScore >= 85 ? 'critical' : 'warning';
                createAlert({
                    alert_type: 'high_demand',
                    title: `Demanda ${severity === 'critical' ? 'muy alta' : 'alta'} en ${zone.zoneName}`,
                    description: `Score ${zone.demandScore}/100 — ${zone.recommendation}`,
                    emoji: severity === 'critical' ? '🔥' : '📈',
                    severity,
                    zone: zone.zone,
                    demand_score: zone.demandScore,
                    metadata: {
                        factors: zone.factors.map(f => ({ label: f.label, impact: f.impact })),
                        baseline: baselineDemand,
                    },
                });
            }

            // 3. LOW SUPPLY — disabled until we have enough users to make taxi counts meaningful
            // if (zone.taxistasActivos > 0 && zone.taxiPax > 0) { ... }
        }

        // 4. RAIN DEMAND — rain significantly boosting taxi demand
        if (isRainBoost && weatherMultiplier >= 1.15) {
            const boostPct = Math.round((weatherMultiplier - 1) * 100);
            createAlert({
                alert_type: 'rain_demand',
                title: isRaining ? 'Lluvia activa — más demanda de taxi' : 'Lluvia prevista — demanda al alza',
                description: isRaining
                    ? `Está lloviendo en Barcelona. La demanda de taxi sube ~${boostPct}%.`
                    : `Probabilidad de lluvia ${weather?.rainProbability}%. Demanda estimada +${boostPct}%.`,
                emoji: isRaining ? '🌧️' : '🌦️',
                severity: weatherMultiplier >= 1.25 ? 'warning' : 'info',
                metadata: {
                    multiplier: weatherMultiplier,
                    rain_probability: weather?.rainProbability,
                    is_raining: isRaining,
                },
            });
        }

        // 5. EVENT SURGE — major events generating taxi demand
        for (const event of activeEvents) {
            if (event.attendees >= 5000) {
                createAlert({
                    alert_type: 'event_surge',
                    title: `Evento: ${event.title}`,
                    description: `${(event.attendees / 1000).toFixed(0)}k asistentes — pico de taxis al finalizar.`,
                    emoji: event.type === 'Music' ? '🎵' : event.type === 'Sports' ? '⚽' : '🎭',
                    severity: event.attendees >= 20000 ? 'critical' : 'warning',
                    metadata: {
                        event_title: event.title,
                        attendees: event.attendees,
                        type: event.type,
                    },
                });
            }
        }

        // 6. CRUISE ARRIVAL — cruise ships bringing passengers
        for (const cruise of upcomingCruises) {
            if (cruise.pax_estimados >= 1000) {
                createAlert({
                    alert_type: 'cruise_arrival',
                    title: `Crucero: ${cruise.barco}`,
                    description: `${(cruise.pax_estimados / 1000).toFixed(1)}k pasajeros desembarcando a las ${cruise.hora}. ~15% usarán taxi.`,
                    emoji: '🚢',
                    severity: cruise.pax_estimados >= 3000 ? 'warning' : 'info',
                    metadata: {
                        ship: cruise.barco,
                        pax: cruise.pax_estimados,
                        time: cruise.hora,
                    },
                });
            }
        }
    }, [currentHour, activeEvents, upcomingCruises, isRainBoost, isRaining, weather, weatherMultiplier, createAlert, getBaseline]);

    // Initial fetch
    useEffect(() => {
        fetchAlerts();
        fetchBaselines();
    }, [fetchAlerts, fetchBaselines]);

    // Refresh baselines every hour
    useEffect(() => {
        const interval = setInterval(fetchBaselines, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchBaselines]);

    // Run anomaly detection when forecast updates
    useEffect(() => {
        if (currentHour) {
            detectAnomalies();
        }
    }, [currentHour, detectAnomalies]);

    // Auto-refresh alerts every 5 minutes
    useEffect(() => {
        const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchAlerts]);

    // Derived
    const unreadCount = alerts.filter(a => !a.read).length;
    const activeAlerts = alerts.filter(a => !a.dismissed);

    return {
        alerts: activeAlerts,
        unreadCount,
        loading,
        dismissAlert,
        markAsRead,
        markAllAsRead,
        refresh: fetchAlerts,
    };
}
