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
            // Aggregated server-side (registros_reten is not readable by clients).
            // The RPC averages completed waits ≥30 min that ended in the last 2h,
            // excluding TRANSIT and zombie-closed sessions, and returns a null
            // average when there are fewer than 5 of them.
            // @ts-expect-error - RPC not in generated types yet
            const { data, error: fetchError } = await supabase.rpc('fn_get_waiting_times');

            if (fetchError) throw fetchError;

            const rows = (data || []) as {
                zona: string;
                espera_minutos: number | null;
                taxistas_activos: number;
            }[];

            // Calculate stats per zone
            const zonas = ['T1', 'T2', 'SANTS', 'PUENTE_AEREO', 'T2C_EASY'];
            const stats: Record<string, WaitingTimeData> = {};

            for (const zona of zonas) {
                const row = rows.find(r => r.zona === zona);
                const avgWait = row?.espera_minutos ?? null;

                stats[zona] = {
                    zona,
                    espera_minutos: avgWait,
                    taxistas_activos: row?.taxistas_activos ?? 0,
                    isRealData: avgWait !== null,
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
