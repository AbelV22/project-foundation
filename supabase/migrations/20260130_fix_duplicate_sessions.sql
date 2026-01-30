-- ============================================================================
-- ROBUST GEOFENCING v3 - Handles GPS fluctuations and transit zones
-- ============================================================================
-- Problems solved:
--   1. GPS fluctuations causing false exits/entries
--   2. Brief passes through zones (not real waiting)
--   3. Multiple sessions for same device
--
-- Solution:
--   - "Pending exit" state: don't close immediately, wait for confirmation
--   - Minimum stay time: only count as real wait if > 5 minutes
--   - Grace period: if returns within 5 min, resume session (not new entry)
--   - Unique constraint: only ONE open session per device

-- =========================================================================
-- STEP 1: Add pending_exit column to track "maybe leaving" state
-- =========================================================================
ALTER TABLE public.registros_reten
ADD COLUMN IF NOT EXISTS pending_exit_at TIMESTAMPTZ DEFAULT NULL;

-- =========================================================================
-- STEP 2: CLEANUP - Close ALL open sessions (start fresh)
-- =========================================================================
UPDATE public.registros_reten
SET exited_at = COALESCE(exited_at, created_at + interval '3 hours'),
    pending_exit_at = NULL
WHERE exited_at IS NULL;

-- =========================================================================
-- STEP 3: Create ROBUST RPC function with GPS fluctuation handling
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
    c_grace_period INTERVAL := '5 minutes';      -- Time to return before session is truly closed
    c_exit_confirmation INTERVAL := '3 minutes'; -- Time outside zone before confirming exit
    c_min_stay_time INTERVAL := '5 minutes';     -- Minimum time to count as real wait
    c_max_session INTERVAL := '3 hours';         -- Maximum session duration
    c_high_accuracy_threshold DOUBLE PRECISION := 50; -- meters
BEGIN
    -- =========================================================================
    -- A. DETECT ZONE (only trust if accuracy is reasonable)
    -- =========================================================================
    -- If accuracy is very poor (>100m), don't make zone decisions
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
    -- D. ALSO CHECK FOR RECENTLY CLOSED SESSION (for grace period resurrection)
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

    -- -----------------------------------------------------------------
    -- CASE 1: User IN ZONE + has OPEN session in SAME zone
    -- -----------------------------------------------------------------
    IF v_detected_zone IS NOT NULL
       AND v_current_session IS NOT NULL
       AND v_current_session.zona = v_detected_zone THEN

        -- Clear any pending exit (they're back/still here)
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

    -- -----------------------------------------------------------------
    -- CASE 2: User IN ZONE + has OPEN session in DIFFERENT zone
    -- -----------------------------------------------------------------
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

    -- -----------------------------------------------------------------
    -- CASE 3: User IN ZONE + NO open session
    -- -----------------------------------------------------------------
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

    -- -----------------------------------------------------------------
    -- CASE 4: User OUTSIDE + has OPEN session -> Start pending exit or confirm exit
    -- -----------------------------------------------------------------
    IF v_detected_zone IS NULL AND v_current_session IS NOT NULL THEN

        -- If no pending exit yet, start one (don't close immediately)
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
            SET exited_at = v_current_session.pending_exit_at, -- Use when they first left
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

    -- -----------------------------------------------------------------
    -- CASE 5: User OUTSIDE + NO session
    -- -----------------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'status', 'OUTSIDE'
    );

END;
$$;

-- =========================================================================
-- STEP 4: Create function to clean up sessions that were too short (transit)
-- This runs periodically to mark short visits as "transit" not "wait"
-- =========================================================================
CREATE OR REPLACE FUNCTION fn_cleanup_transit_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark sessions < 5 minutes as transit (won't count in avg wait time)
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
-- STEP 5: Enforce ONE open session per device at database level
-- =========================================================================
DROP INDEX IF EXISTS idx_unique_open_session_per_device;
CREATE UNIQUE INDEX idx_unique_open_session_per_device
ON public.registros_reten (device_id)
WHERE exited_at IS NULL;

-- =========================================================================
-- STEP 6: Indexes for performance
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_registros_device_open
ON public.registros_reten (device_id, created_at DESC)
WHERE exited_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_registros_recent_closed
ON public.registros_reten (device_id, exited_at DESC)
WHERE exited_at IS NOT NULL;

-- =========================================================================
-- STEP 7: Run initial transit cleanup
-- =========================================================================
SELECT fn_cleanup_transit_sessions();

DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Robust geofencing v3 with GPS fluctuation handling';
END $$;
