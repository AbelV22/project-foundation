import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WaitingTimeData {
    zona: string;
    espera_minutos: number | null; // null when no real data available
    taxistas_activos: number;
    isRealData: boolean; // true only when calculated from actual driver data
}

interface UseWaitingTimesResult {
    waitingTimes: Record<string, WaitingTimeData>;
    loading: boolean;
    error: Error | null;
    refresh: () => void;
}

/**
 * Hook to fetch real waiting times from Supabase
 */
export const useWaitingTimes = (): UseWaitingTimesResult => {
    const [waitingTimes, setWaitingTimes] = useState<Record<string, WaitingTimeData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchWaitingTimes = useCallback(async () => {
        try {
            // Fetch entries from last 2 hours to calculate waiting times
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            const { data: registros, error: fetchError } = await supabase
                .from('registros_reten')
                .select('zona, created_at, exited_at, tipo_zona')
                .gte('created_at', twoHoursAgo)
                .neq('tipo_zona', 'TRANSIT') // Exclude brief passes through zones
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            // Calculate stats per zone
            const zonas = ['T1', 'T2', 'SANTS', 'PUENTE_AEREO', 'T2C_EASY'];
            const stats: Record<string, WaitingTimeData> = {};

            for (const zona of zonas) {
                const zonaRegistros = (registros || []).filter(r => r.zona === zona);
                const activos = zonaRegistros.filter(r => !r.exited_at).length;

                // Calculate average waiting time from completed waits (minimum 5 minutes)
                const completedWaits = zonaRegistros.filter(r => {
                    if (!r.exited_at) return false;
                    const start = new Date(r.created_at).getTime();
                    const end = new Date(r.exited_at).getTime();
                    const durationMinutes = (end - start) / 60000;
                    return durationMinutes >= 5; // Exclude waits shorter than 5 minutes
                });

                // Only show real data if we have at least 3 completed waits
                const hasRealData = completedWaits.length >= 3;
                let avgWait: number | null = null;

                if (hasRealData) {
                    const totalWait = completedWaits.reduce((acc, r) => {
                        const start = new Date(r.created_at).getTime();
                        const end = new Date(r.exited_at!).getTime();
                        return acc + (end - start) / 60000; // Convert to minutes
                    }, 0);
                    avgWait = Math.round(totalWait / completedWaits.length);
                }

                stats[zona] = {
                    zona,
                    espera_minutos: avgWait,
                    taxistas_activos: activos,
                    isRealData: hasRealData,
                };

                // Also map to lowercase names for compatibility
                const lowerMap: Record<string, string> = {
                    T1: 't1',
                    T2: 't2',
                    PUENTE_AEREO: 'puente',
                    T2C_EASY: 't2c',
                };
                if (lowerMap[zona]) {
                    stats[lowerMap[zona]] = stats[zona];
                }
            }

            setWaitingTimes(stats);
            setError(null);
        } catch (err) {
            console.error('[useWaitingTimes] Error:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch waiting times'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWaitingTimes();
        // Refresh every 2 minutes
        const interval = setInterval(fetchWaitingTimes, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchWaitingTimes]);

    return { waitingTimes, loading, error, refresh: fetchWaitingTimes };
};

/**
 * Get waiting time for a specific zone
 * Returns null if no real data is available (don't show fictitious values)
 */
export const getZoneWaitingTime = (
    waitingTimes: Record<string, WaitingTimeData>,
    zona: string
): number | null => {
    const data = waitingTimes[zona];
    if (!data || !data.isRealData) return null;
    return data.espera_minutos;
};

/**
 * Check if a zone has real calculated data
 */
export const getZoneHasRealData = (
    waitingTimes: Record<string, WaitingTimeData>,
    zona: string
): boolean => {
    return waitingTimes[zona]?.isRealData ?? false;
};

/**
 * Get active taxistas count for a zone
 */
export const getZoneTaxistasActivos = (
    waitingTimes: Record<string, WaitingTimeData>,
    zona: string
): number => {
    return waitingTimes[zona]?.taxistas_activos || 0;
};
