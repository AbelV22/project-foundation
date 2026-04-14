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

// --- BASELINE THRESHOLDS ---
// Based on typical BCN airport/Sants patterns by hour of day
// These represent "normal" levels — alerts fire when significantly above

const HOURLY_FLIGHT_BASELINES: Record<number, number> = {
    0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1,
    6: 3, 7: 5, 8: 7, 9: 8, 10: 9, 11: 8,
    12: 7, 13: 8, 14: 9, 15: 8, 16: 7, 17: 8,
    18: 9, 19: 10, 20: 9, 21: 8, 22: 6, 23: 3,
};

const HOURLY_PAX_BASELINES: Record<number, number> = {
    0: 50, 1: 0, 2: 0, 3: 0, 4: 0, 5: 100,
    6: 300, 7: 500, 8: 700, 9: 800, 10: 900, 11: 800,
    12: 700, 13: 800, 14: 900, 15: 800, 16: 700, 17: 800,
    18: 900, 19: 1000, 20: 900, 21: 800, 22: 500, 23: 200,
};

// Demand score baseline by hour (what's "normal")
const HOURLY_DEMAND_BASELINES: Record<number, number> = {
    0: 25, 1: 20, 2: 20, 3: 20, 4: 20, 5: 25,
    6: 35, 7: 40, 8: 45, 9: 50, 10: 50, 11: 45,
    12: 45, 13: 50, 14: 50, 15: 45, 16: 45, 17: 50,
    18: 55, 19: 55, 20: 50, 21: 45, 22: 35, 23: 30,
};

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
    const recentKeysRef = useRef<Set<string>>(new Set());
    const lastCheckRef = useRef<number>(0);

    const { currentHour, hourlyForecast, weatherMultiplier, isRainBoost, activeEvents, upcomingCruises } = useDemandForecast();
    const { weather, isRaining, isRainAlert } = useWeather();

    const deviceId = getOrCreateDeviceId();

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

        const baselineFlights = HOURLY_FLIGHT_BASELINES[currentHourNum] || 5;
        const baselinePax = HOURLY_PAX_BASELINES[currentHourNum] || 500;
        const baselineDemand = HOURLY_DEMAND_BASELINES[currentHourNum] || 40;

        // Check each zone in current hour
        for (const zone of currentHour.zones) {
            // 1. FLIGHT PEAK — unusually high flight arrivals
            if (zone.type === 'airport' && zone.flightCount > 0) {
                const ratio = zone.flightCount / Math.max(baselineFlights, 1);
                if (ratio >= CRITICAL_THRESHOLD) {
                    createAlert({
                        alert_type: 'flight_peak',
                        title: `Pico de vuelos en ${zone.zoneName}`,
                        description: `${zone.flightCount} vuelos llegando (lo normal son ${baselineFlights}). ~${zone.taxiPax} pasajeros de taxi estimados.`,
                        emoji: '✈️',
                        severity: 'critical',
                        zone: zone.zone,
                        demand_score: zone.demandScore,
                        metadata: {
                            flight_count: zone.flightCount,
                            baseline: baselineFlights,
                            ratio: Math.round(ratio * 100) / 100,
                            taxi_pax: zone.taxiPax,
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

            // 3. LOW SUPPLY — few taxis, high passenger demand
            if (zone.taxistasActivos > 0 && zone.taxiPax > 0) {
                const ratio = zone.taxiPax / zone.taxistasActivos;
                if (ratio >= 5 && zone.taxiPax >= 20) {
                    createAlert({
                        alert_type: 'low_supply',
                        title: `Pocos taxis en ${zone.zoneName}`,
                        description: `Solo ${zone.taxistasActivos} taxis para ~${zone.taxiPax} pasajeros. Ratio ${Math.round(ratio)}:1.`,
                        emoji: '🚕',
                        severity: ratio >= 8 ? 'critical' : 'warning',
                        zone: zone.zone,
                        demand_score: zone.demandScore,
                        metadata: {
                            taxistas: zone.taxistasActivos,
                            taxi_pax: zone.taxiPax,
                            ratio: Math.round(ratio * 10) / 10,
                        },
                    });
                }
            }
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
    }, [currentHour, activeEvents, upcomingCruises, isRainBoost, isRaining, weather, weatherMultiplier, createAlert]);

    // Initial fetch
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

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
