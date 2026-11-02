-- Debug / internal SECURITY DEFINER functions that no client calls: only the
-- service role (Edge Functions, cron) may execute them.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'debug_zone_detection', 'fn_test_zone_detection', 'fn_debug_params', 'fn_debug_full',
              'fn_record_transport_stats', 'fn_check_transport_anomalies',
              'fn_update_baseline_from_snapshot'
          )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END LOOP;
END $$;

-- Pin search_path so a role-controlled schema can't shadow the objects these
-- functions use.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'fn_record_transport_stats', 'fn_check_transport_anomalies', '_geojson_to_polygon',
              'debug_zone_detection', 'fn_test_zone_detection', '_polygon_rough_area',
              'fn_process_geofence_event', 'fn_debug_params', 'fn_update_baseline_from_snapshot',
              'fn_debug_full', 'fn_cleanup_transit_sessions'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    END LOOP;
END $$;

-- transport_hourly_stats: anyone could overwrite the stats. Readable by all,
-- written only by the service role.
ALTER POLICY "Allow anonymous insert stats" ON public.transport_hourly_stats TO service_role;
ALTER POLICY "Allow anonymous update stats" ON public.transport_hourly_stats TO service_role;

-- Baselines became admin-write in lockdown_2, and this trigger ran as the
-- inserting (anon) role, so every snapshot insert failed. Run it as owner.
ALTER FUNCTION public.fn_update_baseline_from_snapshot() SECURITY DEFINER SET search_path = public;
