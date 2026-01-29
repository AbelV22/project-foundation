-- ============================================================================
-- ENFORCE 3-HOUR SESSION LIMIT
-- ============================================================================
-- This migration:
-- 1. Closes all existing sessions that have been open > 3 hours
-- 2. Updates the RPC function to use 3-hour limit instead of 24-hour

-- 1. Clean up existing zombie sessions (> 3 hours)
-- Force close any session that has been open for more than 3 hours
UPDATE public.registros_reten
SET exited_at = created_at + interval '3 hours'
WHERE exited_at IS NULL
  AND created_at < (now() - interval '3 hours');

-- 2. Update the RPC function with 3-hour limit
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
    v_detected_zone_slug TEXT;
    v_detected_zone_type TEXT;
    v_current_session RECORD;
    v_last_closed_session RECORD;
    v_result JSONB;
    v_timestamp TIMESTAMPTZ := now();
    -- Config: Tiempo de tolerancia para "resucitar" sesión si el GPS salta fuera momentáneamente
    v_resurrection_window INTERVAL := '15 minutes';
BEGIN
    -- A. DETECCIÓN DE ZONA
    -- Usamos el operador @> (polígono contiene punto)
    SELECT z.slug, z.type INTO v_detected_zone_slug, v_detected_zone_type
    FROM public.zones z
    JOIN public.zone_polygons zp ON z.id = zp.zone_id
    WHERE zp.shape @> point(p_lat, p_lng)
    LIMIT 1;

    -- B. OBTENER ESTADO ACTUAL (Sesión Abierta)

    -- B.1 LIMPIEZA DE SESIONES ZOMBIE (> 3 horas)
    -- Si el usuario lleva > 3h "dentro" sin salir, forzamos cierre.
    -- Límite de 3 horas es el máximo razonable para espera en retén.
    UPDATE public.registros_reten
    SET exited_at = created_at + interval '3 hours'
    WHERE device_id = p_device_id
      AND exited_at IS NULL
      AND created_at < (v_timestamp - interval '3 hours');

    -- B.2 Ahora sí, buscamos sesión activa (que no sea zombie)
    SELECT * INTO v_current_session
    FROM public.registros_reten
    WHERE device_id = p_device_id
      AND exited_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    -- C. MÁQUINA DE ESTADOS
    IF v_detected_zone_slug IS NOT NULL THEN
        -- === CASO 1: USUARIO DENTRO DE UNA ZONA ===

        IF v_current_session IS NOT NULL THEN
            -- Tiene sesión abierta
            IF v_current_session.zona = v_detected_zone_slug THEN
                -- 1.1: Sigue en la MISMA zona. Todo bien.
                v_result := jsonb_build_object(
                    'success', true,
                    'status', 'STAY',
                    'zona', v_detected_zone_slug,
                    'message', '✅ ' || v_detected_zone_slug
                );
            ELSE
                -- 1.2: Cambio DIRECTO de zona (saltó de T1 a T2 sin evento 'outside' intermedio)
                -- Cerramos la anterior
                UPDATE public.registros_reten
                SET exited_at = v_timestamp
                WHERE id = v_current_session.id;

                -- Abrimos la nueva
                INSERT INTO public.registros_reten (device_id, zona, tipo_zona, lat, lng, evento)
                VALUES (p_device_id, v_detected_zone_slug, v_detected_zone_type, p_lat, p_lng, 'ENTRADA');

                v_result := jsonb_build_object(
                    'success', true,
                    'status', 'CHANGE',
                    'zona', v_detected_zone_slug,
                    'prev_zona', v_current_session.zona,
                    'message', 'Cambio: ' || v_current_session.zona || ' -> ' || v_detected_zone_slug
                );
            END IF;
        ELSE
            -- No tiene sesión abierta (Entrando o regresando)

            -- Lógica de RESURRECCIÓN (Glitch Protection)
            -- Buscamos si hubo una sesión en esta misma zona cerrada hace menos de X minutos
            SELECT * INTO v_last_closed_session
            FROM public.registros_reten
            WHERE device_id = p_device_id
              AND zona = v_detected_zone_slug
              AND exited_at > (v_timestamp - v_resurrection_window)
            ORDER BY exited_at DESC
            LIMIT 1;

            IF v_last_closed_session IS NOT NULL THEN
                -- 1.3: Es un "falso positivo" de salida anterior. Resucitamos la sesión.
                UPDATE public.registros_reten
                SET exited_at = NULL
                WHERE id = v_last_closed_session.id;

                v_result := jsonb_build_object(
                    'success', true,
                    'status', 'RESURRECT',
                    'zona', v_detected_zone_slug,
                    'message', '🔄 Sesión recuperada en ' || v_detected_zone_slug
                );
            ELSE
                -- 1.4: Nueva entrada legítima
                INSERT INTO public.registros_reten (device_id, zona, tipo_zona, lat, lng, evento)
                VALUES (p_device_id, v_detected_zone_slug, v_detected_zone_type, p_lat, p_lng, 'ENTRADA');

                v_result := jsonb_build_object(
                    'success', true,
                    'status', 'ENTER',
                    'zona', v_detected_zone_slug,
                    'message', '✅ Entrada en ' || v_detected_zone_slug
                );
            END IF;
        END IF;

    ELSE
        -- === CASO 2: USUARIO FUERA DE ZONAS ===

        IF v_current_session IS NOT NULL THEN
            -- 2.1: Acaba de salir
            UPDATE public.registros_reten
            SET exited_at = v_timestamp
            WHERE id = v_current_session.id;

            v_result := jsonb_build_object(
                'success', true,
                'status', 'EXIT',
                'zona', null,
                'from_zona', v_current_session.zona,
                'message', '📍 Salida de ' || v_current_session.zona
            );
        ELSE
            -- 2.2: Sigue fuera
            v_result := jsonb_build_object(
                'success', true,
                'status', 'OUTSIDE',
                'zona', null,
                'message', '📍 Fuera de zona'
            );
        END IF;

    END IF;

    -- D. LOGGING (Auditoría)
    IF v_result->>'status' != 'STAY' AND v_result->>'status' != 'OUTSIDE' THEN
        INSERT INTO public.geofence_logs (event_type, zona, lat, lng, device_id, accuracy)
        VALUES (v_result->>'status', v_detected_zone_slug, p_lat, p_lng, p_device_id, p_accuracy);
    END IF;

    RETURN v_result;
END;
$$;

-- Log that this migration ran
DO $$
BEGIN
    RAISE NOTICE 'Migration 20260129_enforce_3hour_limit completed. Stale sessions cleaned up.';
END $$;
