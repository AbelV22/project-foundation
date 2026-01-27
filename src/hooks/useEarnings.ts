import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

export type RideCategory = 'airport' | 'train_station' | 'event' | 'street' | 'app' | 'other';
export type ShiftType = 'morning' | 'afternoon' | 'night';

export interface CarreraRecord {
    id: string;
    importe: number;
    propina: number;
    metodo_pago: string;
    zona: string | null;
    created_at: string;
    device_id: string;
}

interface DailyStats {
    date: string;
    total: number;
    count: number;
}

interface WeeklyStats {
    revenue: number;
    count: number;
}

interface EarningsStats {
    today: number;
    todayCount: number;
    week: number;
    weekCount: number;
    daily: DailyStats[];
    weekly: WeeklyStats;
}

interface UseEarningsResult {
    carreras: CarreraRecord[];
    stats: EarningsStats;
    loading: boolean;
    error: Error | null;
    addCarrera: (
        importe: number,
        propina?: number,
        metodoPago?: 'efectivo' | 'tarjeta',
        zona?: string
    ) => Promise<boolean>;
    refresh: () => void;
}

/**
 * Hook for managing taxi earnings (PRO feature)
 */
export const useEarnings = (): UseEarningsResult => {
    const [carreras, setCarreras] = useState<CarreraRecord[]>([]);
    const [stats, setStats] = useState<EarningsStats>({
        today: 0,
        todayCount: 0,
        week: 0,
        weekCount: 0,
        daily: [],
        weekly: { revenue: 0, count: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchCarreras = useCallback(async () => {
        try {
            const deviceId = getOrCreateDeviceId();
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data, error: fetchError } = await supabase
                .from('registros_carreras')
                .select('*')
                .eq('device_id', deviceId)
                .gte('created_at', weekAgo)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            const records = (data || []) as CarreraRecord[];
            setCarreras(records);

            // Calculate stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayRecords = records.filter(r => new Date(r.created_at) >= today);

            // Group by date for daily stats
            const dailyMap = new Map<string, DailyStats>();
            records.forEach(r => {
                const date = new Date(r.created_at).toISOString().split('T')[0];
                const existing = dailyMap.get(date) || { date, total: 0, count: 0 };
                existing.total += Number(r.importe) + Number(r.propina || 0);
                existing.count += 1;
                dailyMap.set(date, existing);
            });

            setStats({
                today: todayRecords.reduce((acc, r) => acc + Number(r.importe) + Number(r.propina || 0), 0),
                todayCount: todayRecords.length,
                week: records.reduce((acc, r) => acc + Number(r.importe) + Number(r.propina || 0), 0),
                weekCount: records.length,
                daily: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
                weekly: {
                    revenue: records.reduce((acc, r) => acc + Number(r.importe) + Number(r.propina || 0), 0),
                    count: records.length
                }
            });

            setError(null);
        } catch (err) {
            console.error('[useEarnings] Error:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch carreras'));
        } finally {
            setLoading(false);
        }
    }, []);

    const addCarrera = useCallback(async (
        importe: number,
        propina: number = 0,
        metodoPago: 'efectivo' | 'tarjeta' = 'efectivo',
        zona?: string
    ): Promise<boolean> => {
        try {
            const deviceId = getOrCreateDeviceId();
            console.log('[useEarnings] Adding carrera:', { importe, propina, metodoPago, zona, deviceId });

            const { data, error: insertError } = await supabase
                .from('registros_carreras')
                .insert({
                    device_id: deviceId,
                    importe,
                    propina: propina || 0,
                    metodo_pago: metodoPago,
                    zona: zona || null,
                })
                .select()
                .single();

            if (insertError) {
                console.error('[useEarnings] Supabase insert error:', insertError);
                throw insertError;
            }

            console.log('[useEarnings] Carrera added successfully:', data);

            // Refresh data after insert
            await fetchCarreras();
            return true;
        } catch (err) {
            console.error('[useEarnings] Add error:', err);
            if (err && typeof err === 'object' && 'message' in err) {
                console.error('[useEarnings] Error message:', (err as any).message);
                console.error('[useEarnings] Error details:', (err as any).details);
            }
            setError(err instanceof Error ? err : new Error('Failed to add carrera'));
            return false;
        }
    }, [fetchCarreras]);

    useEffect(() => {
        fetchCarreras();
    }, [fetchCarreras]);

    return { carreras, stats, loading, error, addCarrera, refresh: fetchCarreras };
};
