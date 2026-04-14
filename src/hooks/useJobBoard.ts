import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

export type AdType = 'busco_conductor' | 'busco_taxi';
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'flexible';
export type AdStatus = 'active' | 'paused' | 'closed';

export interface JobAd {
    id: string;
    device_id: string;
    ad_type: AdType;
    title: string;
    description: string | null;
    shift: ShiftType | null;
    rest_day: string | null;
    vehicle_type: string | null;
    zone: string | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_name: string | null;
    status: AdStatus;
    created_at: string;
    updated_at: string;
    expires_at: string;
}

export const SHIFT_LABELS: Record<ShiftType, string> = {
    morning: 'Mañana (6-14h)',
    afternoon: 'Tarde (14-22h)',
    night: 'Noche (22-6h)',
    flexible: 'Flexible',
};

export const AD_TYPE_CONFIG = {
    busco_conductor: {
        label: 'Busco conductor',
        emoji: '🚕',
        description: 'Titular con licencia busca conductor',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
    },
    busco_taxi: {
        label: 'Busco taxi',
        emoji: '🧑‍✈️',
        description: 'Conductor busca taxi para trabajar',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
    },
};

export const useJobBoard = () => {
    const [ads, setAds] = useState<JobAd[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAds = useCallback(async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('job_board')
                .select('*')
                .eq('status', 'active')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setAds((data || []) as JobAd[]);
            setError(null);
        } catch (err) {
            console.error('[useJobBoard] Fetch error:', err);
            setError('Error al cargar anuncios');
        } finally {
            setLoading(false);
        }
    }, []);

    const createAd = useCallback(async (ad: {
        ad_type: AdType;
        title: string;
        description?: string;
        shift?: ShiftType;
        rest_day?: string;
        vehicle_type?: string;
        zone?: string;
        contact_phone?: string;
        contact_whatsapp?: string;
        contact_name?: string;
    }): Promise<boolean> => {
        try {
            const deviceId = getOrCreateDeviceId();
            const { error: insertError } = await supabase
                .from('job_board')
                .insert({
                    device_id: deviceId,
                    ad_type: ad.ad_type,
                    title: ad.title,
                    description: ad.description || null,
                    shift: ad.shift || null,
                    rest_day: ad.rest_day || null,
                    vehicle_type: ad.vehicle_type || null,
                    zone: ad.zone || null,
                    contact_phone: ad.contact_phone || null,
                    contact_whatsapp: ad.contact_whatsapp || null,
                    contact_name: ad.contact_name || null,
                });

            if (insertError) throw insertError;
            await fetchAds();
            return true;
        } catch (err) {
            console.error('[useJobBoard] Create error:', err);
            return false;
        }
    }, [fetchAds]);

    const closeAd = useCallback(async (adId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('job_board')
                .update({ status: 'closed' })
                .eq('id', adId);

            if (updateError) throw updateError;
            await fetchAds();
            return true;
        } catch (err) {
            console.error('[useJobBoard] Close error:', err);
            return false;
        }
    }, [fetchAds]);

    const getMyAds = useCallback(() => {
        const deviceId = getOrCreateDeviceId();
        return ads.filter(a => a.device_id === deviceId);
    }, [ads]);

    useEffect(() => {
        fetchAds();
    }, [fetchAds]);

    return {
        ads,
        loading,
        error,
        createAd,
        closeAd,
        getMyAds,
        refresh: fetchAds,
    };
};
