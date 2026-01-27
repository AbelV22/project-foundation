-- ============================================================================
-- MIGRACIÓN ROBUSTA DE GEOFENCING (0 FALLOS)
-- ============================================================================

-- 1. Crear tabla de definiciones de zonas
CREATE TABLE IF NOT EXISTS public.zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- Ej: 'T1', 'T2'
    name TEXT NOT NULL,
    type TEXT DEFAULT 'STANDARD',
    color TEXT DEFAULT '#3388ff', -- Para UI futura
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Crear tabla de polígonos (Geometrías)
-- Usamos el tipo nativo 'polygon' de Postgres para máxima eficiencia sin depender de PostGIS
CREATE TABLE IF NOT EXISTS public.zone_polygons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES public.zones(id) ON DELETE CASCADE,
    shape polygon NOT NULL, -- Array de puntos ((lat, lng), ...)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexar para búsqueda espacial (bounding box check por defecto)
CREATE INDEX IF NOT EXISTS idx_zone_polygons_shape ON public.zone_polygons USING gist(shape);

-- 3. Insertar Datos de Zonas (Migrado de index.ts)
DO $$
DECLARE
    z_id UUID;
BEGIN
    -- === T1 ===
    INSERT INTO zones (slug, name, type) VALUES ('T1', 'Terminal 1', 'STANDARD') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO z_id;
    
    -- Limpiar polígonos viejos si existen para evitar duplicados al re-correr la migración
    DELETE FROM zone_polygons WHERE zone_id = z_id;

    -- T1 Poly 1
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.293414, 2.052955), (41.291480, 2.054785), (41.291050, 2.057731), (41.292576, 2.056044), (41.293693, 2.054042), (41.293414, 2.052955))'::polygon);
    -- T1 Poly 2
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.287015, 2.073812), (41.287235, 2.074420), (41.289890, 2.072795), (41.289614, 2.072155), (41.287015, 2.073812))'::polygon);

    -- === T2 ===
    INSERT INTO zones (slug, name, type) VALUES ('T2', 'Terminal 2', 'STANDARD') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO z_id;
    DELETE FROM zone_polygons WHERE zone_id = z_id;

    -- T2 Poly 1
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.304277, 2.067179), (41.302540, 2.068124), (41.303069, 2.069830), (41.304828, 2.068744), (41.304277, 2.067179))'::polygon);
    -- T2 Poly 2
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.301671, 2.071621), (41.301226, 2.071903), (41.302190, 2.074682), (41.302677, 2.074442), (41.301671, 2.071621))'::polygon);

    -- === SANTS ===
    INSERT INTO zones (slug, name, type) VALUES ('SANTS', 'Estació de Sants', 'STANDARD') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO z_id;
    DELETE FROM zone_polygons WHERE zone_id = z_id;
    
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.3805, 2.1415), (41.3805, 2.1390), (41.3785, 2.1390), (41.3785, 2.1415), (41.3805, 2.1415))'::polygon);

    -- === PUENTE_AEREO ===
    INSERT INTO zones (slug, name, type) VALUES ('PUENTE_AEREO', 'Puente Aéreo', 'STANDARD') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO z_id;
    DELETE FROM zone_polygons WHERE zone_id = z_id;
    
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.289950, 2.073030), (41.290620, 2.072616), (41.289648, 2.069489), (41.288922, 2.069853), (41.289950, 2.073030))'::polygon);

    -- === T2C_EASY ===
    INSERT INTO zones (slug, name, type) VALUES ('T2C_EASY', 'T2C Easy', 'STANDARD') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO z_id;
    DELETE FROM zone_polygons WHERE zone_id = z_id;
    
    INSERT INTO zone_polygons (zone_id, shape) VALUES (z_id, '((41.305257, 2.080754), (41.304074, 2.081675), (41.304576, 2.083332), (41.305782, 2.082448), (41.305118, 2.081675), (41.305257, 2.080754))'::polygon);

END $$;

-- 4. Función Maestra de Procesamiento (RPC)
-- Esta función encapsula TODA la lógica de negocio para garantizar atomicidad y "0 fallos"
CREATE OR REPLACE FUNCTION fn_process_geofence_event(
    p_device_id TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos de admin para leer/escribir tablas protegidas
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
    -- Postgres 'point' es (x,y). En nuestra convención hemos guardado:
    -- Polygon((lat, lng), ...) -> Por lo tanto usamos point(lat, lng)
    SELECT z.slug, z.type INTO v_detected_zone_slug, v_detected_zone_type
    FROM public.zones z
    JOIN public.zone_polygons zp ON z.id = zp.zone_id
    WHERE zp.shape @> point(p_lat, p_lng)
    LIMIT 1;

    -- B. OBTENER ESTADO ACTUAL (Sesión Abierta)
    
    -- B.1 LIMPIEZA DE SESIONES ZOMBIE (> 24 horas)
    -- Si el usuario lleva > 24h "dentro" sin salir, forzamos cierre para no acumular horas infinitas.
    UPDATE public.registros_reten
    SET exited_at = created_at + interval '24 hours'
    WHERE device_id = p_device_id
      AND exited_at IS NULL
      AND created_at < (v_timestamp - interval '24 hours');

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
    -- Guardamos el evento crudo para debugging, pero la lógica real ya ocurrió arriba
    IF v_result->>'status' != 'STAY' AND v_result->>'status' != 'OUTSIDE' THEN
        -- Solo logueamos cambios de estado para no saturar, o logueamos todo si es necesario
        -- Para "super robusto", logueamos transiciones importantes.
        INSERT INTO public.geofence_logs (event_type, zona, lat, lng, device_id, accuracy)
        VALUES (v_result->>'status', v_detected_zone_slug, p_lat, p_lng, p_device_id, p_accuracy);
    END IF;

    RETURN v_result;
END;
$$;
