-- ============================================================================
-- DEBUG AND FIX GEOFENCE FUNCTION
-- ============================================================================
-- This migration ensures the geofence function is properly deployed and working

-- First, let's verify the zone detection works standalone
CREATE OR REPLACE FUNCTION fn_test_zone_detection(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS TABLE(zone_slug TEXT, polygon_id UUID)
LANGUAGE sql
STABLE
AS $$
    SELECT z.slug, zp.id
    FROM public.zones z
    JOIN public.zone_polygons zp ON z.id = zp.zone_id
    WHERE zp.shape @> point(p_lat, p_lng);
$$;

-- =========================================================================
-- MAIN GEOFENCE FUNCTION - Simplified and debugged version
-- =========================================================================
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
    v_timestamp TIMESTAMPTZ := now();

    -- CONFIGURATION
    c_grace_period INTERVAL := '5 minutes';
    c_exit_confirmation INTERVAL := '3 minutes';
    c_max_session INTERVAL := '3 hours';
BEGIN
    -- =========================================================================
    -- A. DETECT ZONE
    -- =========================================================================
    -- Skip if GPS accuracy is too poor (>100m)
    IF p_accuracy > 100 THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'LOW_ACCURACY',
            'accuracy', p_accuracy,
            'message', 'GPS accuracy too low, ignoring'
        );
    END IF;

    -- Zone detection query
    SELECT z.slug INTO v_detected_zone
    FROM public.zones z
    JOIN public.zone_polygons zp ON z.id = zp.zone_id
    WHERE zp.shape @> point(p_lat, p_lng)
    LIMIT 1;

    -- =========================================================================
    -- B. CLEANUP: Close zombie sessions (>3 hours)
    -- =========================================================================
    UPDATE public.registros_reten
    SET exited_at = created_at + c_max_session,
        pending_exit_at = NULL
    WHERE device_id = p_device_id
      AND exited_at IS NULL
      AND created_at < (v_timestamp - c_max_session);

    -- =========================================================================
    -- C. GET CURRENT OPEN SESSION
    -- =========================================================================
    SELECT * INTO v_current_session
    FROM public.registros_reten
    WHERE device_id = p_device_id
      AND exited_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    -- =========================================================================
    -- D. CHECK FOR RECENTLY CLOSED SESSION (for grace period resurrection)
    -- =========================================================================
    IF v_current_session IS NULL THEN
        SELECT * INTO v_recent_session
        FROM public.registros_reten
        WHERE device_id = p_device_id
          AND exited_at IS NOT NULL
          AND exited_at > (v_timestamp - c_grace_period)
        ORDER BY exited_at DESC
        LIMIT 1;
    END IF;

    -- =========================================================================
    -- E. STATE MACHINE
    -- =========================================================================

    -- CASE 1: User IN ZONE + has OPEN session in SAME zone
    IF v_detected_zone IS NOT NULL
       AND v_current_session IS NOT NULL
       AND v_current_session.zona = v_detected_zone THEN

        -- Clear any pending exit
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

        -- Normal stay
        RETURN jsonb_build_object(
            'success', true,
            'status', 'STAY',
            'zona', v_detected_zone
        );
    END IF;

    -- CASE 2: User IN ZONE + has OPEN session in DIFFERENT zone
    IF v_detected_zone IS NOT NULL
       AND v_current_session IS NOT NULL
       AND v_current_session.zona != v_detected_zone THEN

        -- Close old session
        UPDATE public.registros_reten
        SET exited_at = v_timestamp,
            pending_exit_at = NULL
        WHERE id = v_current_session.id;

        -- Open new session
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
    IF v_detected_zone IS NOT NULL AND v_current_session IS NULL THEN

        -- Check if we can resurrect a recent session (grace period)
        IF v_recent_session IS NOT NULL AND v_recent_session.zona = v_detected_zone THEN
            -- Resurrect: reopen the session
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

        -- New entry
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

    -- CASE 4: User OUTSIDE + has OPEN session -> Start pending exit or confirm exit
    IF v_detected_zone IS NULL AND v_current_session IS NOT NULL THEN

        -- If no pending exit yet, start one
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

        -- If pending exit is old enough, confirm the exit
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

        -- Still in pending exit window
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

-- =========================================================================
-- CLEANUP FUNCTION for transit sessions
-- =========================================================================
CREATE OR REPLACE FUNCTION fn_cleanup_transit_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.registros_reten
    SET tipo_zona = 'TRANSIT'
    WHERE exited_at IS NOT NULL
      AND tipo_zona = 'STANDARD'
      AND (exited_at - created_at) < interval '5 minutes';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =========================================================================
-- Add pending_exit_at column if not exists
-- =========================================================================
ALTER TABLE public.registros_reten
ADD COLUMN IF NOT EXISTS pending_exit_at TIMESTAMPTZ DEFAULT NULL;

-- =========================================================================
-- Ensure unique constraint for one open session per device
-- =========================================================================
DROP INDEX IF EXISTS idx_unique_open_session_per_device;
CREATE UNIQUE INDEX idx_unique_open_session_per_device
ON public.registros_reten (device_id)
WHERE exited_at IS NULL;

-- =========================================================================
-- Performance indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_registros_device_open
ON public.registros_reten (device_id, created_at DESC)
WHERE exited_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_registros_recent_closed
ON public.registros_reten (device_id, exited_at DESC)
WHERE exited_at IS NOT NULL;

-- =========================================================================
-- Grant execute permissions
-- =========================================================================
GRANT EXECUTE ON FUNCTION fn_process_geofence_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_test_zone_detection TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_cleanup_transit_sessions TO anon, authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Geofence function updated with debug capabilities';
END $$;
