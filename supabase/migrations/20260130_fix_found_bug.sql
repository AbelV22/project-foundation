-- ============================================================================
-- FIX: Use FOUND instead of RECORD IS NOT NULL
-- ============================================================================
-- Bug: PL/pgSQL RECORD IS NOT NULL doesn't work as expected after SELECT INTO
-- Solution: Use FOUND variable which is set after each SELECT INTO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_process_geofence_event(
    p_device_id TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_detected_zone TEXT;
    v_current_session RECORD;
    v_recent_session RECORD;
    v_has_current_session BOOLEAN := FALSE;
    v_has_recent_session BOOLEAN := FALSE;
    v_timestamp TIMESTAMPTZ := now();

    -- CONFIGURATION
    c_grace_period INTERVAL := '5 minutes';
    c_exit_confirmation INTERVAL := '3 minutes';
    c_max_session INTERVAL := '3 hours';
BEGIN
    -- A. DETECT ZONE
    IF p_accuracy > 100 THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'LOW_ACCURACY',
            'accuracy', p_accuracy,
            'message', 'GPS accuracy too low, ignoring'
        );
    END IF;

    SELECT z.slug INTO v_detected_zone
    FROM public.zones z
    JOIN public.zone_polygons zp ON z.id = zp.zone_id
    WHERE zp.shape @> point(p_lat, p_lng)
    LIMIT 1;

    -- B. CLEANUP zombie sessions
    UPDATE public.registros_reten
    SET exited_at = created_at + c_max_session,
        pending_exit_at = NULL
    WHERE device_id = p_device_id
      AND exited_at IS NULL
      AND created_at < (v_timestamp - c_max_session);

    -- C. GET CURRENT OPEN SESSION (using FOUND)
    SELECT * INTO v_current_session
    FROM public.registros_reten
    WHERE device_id = p_device_id
      AND exited_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    v_has_current_session := FOUND;

    -- D. CHECK FOR RECENTLY CLOSED SESSION
    IF NOT v_has_current_session THEN
        SELECT * INTO v_recent_session
        FROM public.registros_reten
        WHERE device_id = p_device_id
          AND exited_at IS NOT NULL
          AND exited_at > (v_timestamp - c_grace_period)
        ORDER BY exited_at DESC
        LIMIT 1;

        v_has_recent_session := FOUND;
    END IF;

    -- E. STATE MACHINE

    -- CASE 1: User IN ZONE + has OPEN session in SAME zone
    IF v_detected_zone IS NOT NULL
       AND v_has_current_session
       AND v_current_session.zona = v_detected_zone THEN

        IF v_current_session.pending_exit_at IS NOT NULL THEN
            UPDATE public.registros_reten
            SET pending_exit_at = NULL
            WHERE id = v_current_session.id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'RETURNED',
                'zona', v_detected_zone,
                'message', 'User returned to zone, cancelling exit'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'STAY',
            'zona', v_detected_zone
        );
    END IF;

    -- CASE 2: User IN ZONE + has OPEN session in DIFFERENT zone
    IF v_detected_zone IS NOT NULL
       AND v_has_current_session
       AND v_current_session.zona != v_detected_zone THEN

        UPDATE public.registros_reten
        SET exited_at = v_timestamp,
            pending_exit_at = NULL
        WHERE id = v_current_session.id;

        INSERT INTO public.registros_reten (device_id, zona, tipo_zona, lat, lng, evento)
        VALUES (p_device_id, v_detected_zone, 'STANDARD', p_lat, p_lng, 'ENTRADA');

        INSERT INTO public.geofence_logs (event_type, zona, previous_zona, lat, lng, device_id, accuracy)
        VALUES ('ZONE_CHANGE', v_detected_zone, v_current_session.zona, p_lat, p_lng, p_device_id, p_accuracy);

        RETURN jsonb_build_object(
            'success', true,
            'status', 'ZONE_CHANGE',
            'zona', v_detected_zone,
            'from_zona', v_current_session.zona
        );
    END IF;

    -- CASE 3: User IN ZONE + NO open session
    IF v_detected_zone IS NOT NULL AND NOT v_has_current_session THEN

        IF v_has_recent_session AND v_recent_session.zona = v_detected_zone THEN
            UPDATE public.registros_reten
            SET exited_at = NULL,
                pending_exit_at = NULL
            WHERE id = v_recent_session.id;

            INSERT INTO public.geofence_logs (event_type, zona, lat, lng, device_id, accuracy)
            VALUES ('RESURRECT', v_detected_zone, p_lat, p_lng, p_device_id, p_accuracy);

            RETURN jsonb_build_object(
                'success', true,
                'status', 'RESURRECT',
                'zona', v_detected_zone,
                'message', 'Session resumed within grace period'
            );
        END IF;

        INSERT INTO public.registros_reten (device_id, zona, tipo_zona, lat, lng, evento)
        VALUES (p_device_id, v_detected_zone, 'STANDARD', p_lat, p_lng, 'ENTRADA');

        INSERT INTO public.geofence_logs (event_type, zona, lat, lng, device_id, accuracy)
        VALUES ('ENTER', v_detected_zone, p_lat, p_lng, p_device_id, p_accuracy);

        RETURN jsonb_build_object(
            'success', true,
            'status', 'ENTER',
            'zona', v_detected_zone
        );
    END IF;

    -- CASE 4: User OUTSIDE + has OPEN session
    IF v_detected_zone IS NULL AND v_has_current_session THEN

        IF v_current_session.pending_exit_at IS NULL THEN
            UPDATE public.registros_reten
            SET pending_exit_at = v_timestamp
            WHERE id = v_current_session.id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'PENDING_EXIT',
                'zona', v_current_session.zona,
                'message', 'Started exit timer, waiting for confirmation'
            );
        END IF;

        IF v_current_session.pending_exit_at < (v_timestamp - c_exit_confirmation) THEN
            UPDATE public.registros_reten
            SET exited_at = v_current_session.pending_exit_at,
                pending_exit_at = NULL
            WHERE id = v_current_session.id;

            INSERT INTO public.geofence_logs (event_type, zona, lat, lng, device_id, accuracy)
            VALUES ('EXIT', v_current_session.zona, p_lat, p_lng, p_device_id, p_accuracy);

            RETURN jsonb_build_object(
                'success', true,
                'status', 'EXIT',
                'from_zona', v_current_session.zona
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'PENDING_EXIT',
            'zona', v_current_session.zona,
            'seconds_until_exit', EXTRACT(EPOCH FROM (v_current_session.pending_exit_at + c_exit_confirmation - v_timestamp))
        );
    END IF;

    -- CASE 5: User OUTSIDE + NO session
    RETURN jsonb_build_object(
        'success', true,
        'status', 'OUTSIDE'
    );

END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_process_geofence_event TO anon, authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Fix applied: Using FOUND instead of RECORD IS NOT NULL';
END $$;
