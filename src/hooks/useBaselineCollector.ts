/**
 * useBaselineCollector
 *
 * Silently collects hourly transport snapshots in the background.
 * Each hour, it captures current demand data (flights, pax, trains, demand score)
 * and saves it to `transport_hourly_snapshots`. A DB trigger then updates the
 * rolling averages in `transport_hourly_baselines`.
 *
 * This runs invisibly — users never see it. After a few weeks of data,
 * the smart alerts system switches from hardcoded baselines to real ones.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemandForecast } from './useDemandForecast';

const COLLECTION_KEY = 'baseline_last_snapshot';

export function useBaselineCollector() {
    const { currentHour, weatherMultiplier } = useDemandForecast();
    const hasCollectedRef = useRef(false);

    useEffect(() => {
        if (!currentHour || hasCollectedRef.current) return;

        const now = new Date();
        const currentHourNum = now.getHours();
        const dayOfWeek = now.getDay(); // 0=Sunday

        // Check if we already collected this hour
        const lastSnapshot = localStorage.getItem(COLLECTION_KEY);
        const snapshotKey = `${now.toISOString().split('T')[0]}-${currentHourNum}`;
        if (lastSnapshot === snapshotKey) return;

        hasCollectedRef.current = true;

        // Collect one snapshot per zone
        const saveSnapshots = async () => {
            try {
                const rows = currentHour.zones.map(zone => ({
                    day_of_week: dayOfWeek,
                    hour_of_day: currentHourNum,
                    zone: zone.zone,
                    flight_count: zone.flightCount,
                    pax_estimate: zone.totalPax,
                    train_count: zone.trainCount,
                    demand_score: zone.demandScore,
                    weather_multiplier: weatherMultiplier,
                    is_raining: weatherMultiplier >= 1.15,
                    taxistas_activos: zone.taxistasActivos,
                }));

                const { error } = await supabase
                    .from('transport_hourly_snapshots')
                    .insert(rows);

                if (error) {
                    console.error('[BaselineCollector] Insert error:', error);
                    return;
                }

                localStorage.setItem(COLLECTION_KEY, snapshotKey);
                console.log(`[BaselineCollector] Saved ${rows.length} zone snapshots for ${snapshotKey}`);
            } catch (err) {
                console.error('[BaselineCollector] Error:', err);
            }
        };

        // Delay 30 seconds after mount to not compete with initial data loads
        const timer = setTimeout(saveSnapshots, 30000);
        return () => clearTimeout(timer);
    }, [currentHour, weatherMultiplier]);
}
