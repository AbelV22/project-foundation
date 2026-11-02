-- =============================================================================
-- fn_geofence_check: single entry point for location updates.
-- =============================================================================
-- APK ≥ 1.1.6 calls it directly through PostgREST (/rest/v1/rpc/fn_geofence_check),
-- which doesn't count against the Edge Function invocation quota of the free
-- plan. The check-geofence Edge Function also delegates here, for older APKs
-- and the web app.
--
-- On top of fn_process_geofence_event it adds:
--   * a per-device rate limit (one processed update every 20 s; the rest get
--     status THROTTLED with the open session's zone, and touch nothing else),
--   * basic input validation,
--   * pacing hints (next_check_s / move_m) telling the app when to send again.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.geofence_rate_limit (
    device_id TEXT PRIMARY KEY,
    last_at   TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.geofence_rate_limit ENABLE ROW LEVEL SECURITY;  -- no policies: definer only

CREATE OR REPLACE FUNCTION public.fn_geofence_check(
    p_device_id TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_min_gap CONSTANT INTERVAL := '20 seconds';
    v_allowed BOOLEAN;
    v_result JSONB;
    v_distance INTEGER;
BEGIN
    IF p_device_id IS NULL OR length(p_device_id) NOT BETWEEN 1 AND 64
       OR p_lat IS NULL OR p_lng IS NULL
       OR p_lat NOT BETWEEN 40 AND 43 OR p_lng NOT BETWEEN 0 AND 4 THEN
        RETURN jsonb_build_object('success', false, 'status', 'INVALID',
                                  'next_check_s', 600, 'move_m', 1000);
    END IF;

    INSERT INTO geofence_rate_limit AS r (device_id, last_at)
    VALUES (p_device_id, now())
    ON CONFLICT (device_id) DO UPDATE
        SET last_at = excluded.last_at
        WHERE r.last_at < now() - c_min_gap
    RETURNING true INTO v_allowed;

    IF v_allowed IS NULL THEN
        -- Report the open session's zone so clients don't read "no zone".
        RETURN jsonb_strip_nulls(jsonb_build_object(
            'success', true, 'status', 'THROTTLED',
            'zona', (SELECT zona FROM registros_reten
                     WHERE device_id = p_device_id AND exited_at IS NULL LIMIT 1),
            'next_check_s', 60, 'move_m', 200));
    END IF;

    v_result := fn_process_geofence_event(p_device_id, p_lat, p_lng, coalesce(p_accuracy, 0));

    -- A zone can only be entered or left by moving, so a parked device needs
    -- only an occasional heartbeat.
    CASE v_result->>'status'
        WHEN 'ENTER', 'STAY', 'RETURNED', 'RESURRECT', 'ZONE_CHANGE' THEN
            RETURN v_result || jsonb_build_object('next_check_s', 600, 'move_m', 150);
        WHEN 'PENDING_EXIT' THEN
            -- Come back right after the 3-minute exit confirmation window.
            RETURN v_result || jsonb_build_object(
                'next_check_s', greatest(60, ceil(coalesce((v_result->>'seconds_until_exit')::NUMERIC, 180)) + 15),
                'move_m', 300);
        WHEN 'LOW_ACCURACY' THEN
            RETURN v_result || jsonb_build_object('next_check_s', 120, 'move_m', 100);
        WHEN 'EXIT', 'OUTSIDE' THEN
            v_distance := fn_nearest_zone_m(p_lat, p_lng);
            RETURN v_result || jsonb_build_object(
                'next_check_s', 600,
                'move_m', CASE WHEN v_distance IS NULL THEN 200
                               ELSE least(5000, greatest(150, round(v_distance * 0.7))) END);
        ELSE
            RETURN v_result || jsonb_build_object('next_check_s', 120, 'move_m', 200);
    END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_geofence_check(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_geofence_check(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;
