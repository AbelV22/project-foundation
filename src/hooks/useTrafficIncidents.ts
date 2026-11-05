import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TrafficIncidentKind = 'accidente' | 'corte' | 'retencion' | 'congestion' | 'aviso';

export interface TrafficIncident {
    id: string;
    source: 'sct' | 'bcn_trams' | 'bcn_avisos';
    kind: TrafficIncidentKind;
    severity: number;
    road: string | null;
    title: string;
    detail: string | null;
    lat: number | null;
    lng: number | null;
    started_at: string | null;
    updated_at: string;
}

// Accidents and closures first, then queues, congestion and notices.
const KIND_ORDER: Record<TrafficIncidentKind, number> = {
    accidente: 0,
    corte: 1,
    retencion: 2,
    congestion: 3,
    aviso: 4,
};

/**
 * Accidents, closed roads and congestion around Barcelona.
 *
 * The traffic-sync Edge Function refreshes traffic_incidents every 3 min from
 * the Servei Català de Trànsit and the Ajuntament feeds; this only reads the
 * table (PostgREST, no Edge Function invocations).
 */
export const useTrafficIncidents = () => {
    const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchIncidents = useCallback(async () => {
        try {
            const { data, error } = (await supabase
                // @ts-expect-error - table not in generated types yet
                .from('traffic_incidents')
                .select('*')) as { data: TrafficIncident[] | null; error: { message: string } | null };

            if (error) throw error;

            const sorted = (data || []).sort(
                (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.severity - a.severity
            );
            setIncidents(sorted);
        } catch (err) {
            console.error('[useTrafficIncidents] Error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIncidents();
        const interval = setInterval(fetchIncidents, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchIncidents]);

    return { incidents, loading, refresh: fetchIncidents };
};
