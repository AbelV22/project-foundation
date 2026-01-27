-- ============================================================================
-- SCRIPT DE VERIFICACIÓN (TEST) PARA GEOFENCING
-- Ejecuta esto en Supabase SQL Editor después de aplicar la migración.
-- ============================================================================

DO $$
DECLARE
    v_device_id TEXT := 'TEST_DEVICE_' || floor(random() * 10000)::text;
    v_result JSONB;
    v_check RECORD;
BEGIN
    RAISE NOTICE '=== INICIANDO TEST DE GEOFENCING PARA DISPOSITIVO % ===', v_device_id;

    -- 1. TEST: ENTRADA EN T1
    -- Coordenada dentro de T1 (Poly 1): 41.293414, 2.052955 (Point 1 of definition, should be inclusive or near)
    -- Usamos un punto centroide seguro: 41.292, 2.054 (Aprox visualmente dentro de T1 poly 1)
    
    RAISE NOTICE '--- TEST 1: ENTRADA EN T1 ---';
    -- Llamamos a la función con coordenadas de T1
    v_result := fn_process_geofence_event(v_device_id, 41.292, 2.054);
    RAISE NOTICE 'Resultado API: %', v_result;

    IF v_result->>'status' = 'ENTER' AND v_result->>'zona' = 'T1' THEN
        RAISE NOTICE '✅ PASSED: Entrada detectada correctamente.';
    ELSE
        RAISE NOTICE '❌ FAILED: Se esperaba ENTER T1.';
    END IF;

    -- 2. TEST: PERMANENCIA (Heartbeat)
    RAISE NOTICE '--- TEST 2: PERMANENCIA EN T1 ---';
    v_result := fn_process_geofence_event(v_device_id, 41.292, 2.054);
    RAISE NOTICE 'Resultado API: %', v_result;

    IF v_result->>'status' = 'STAY' THEN
        RAISE NOTICE '✅ PASSED: Permanencia detectada.';
    ELSE
        RAISE NOTICE '❌ FAILED: Se esperaba STAY.';
    END IF;

    -- 3. TEST: SALIDA (A Barcelona centro)
    RAISE NOTICE '--- TEST 3: SALIDA DE ZONA ---';
    -- Coordenada lejos (Plaza Catalunya): 41.387, 2.170
    v_result := fn_process_geofence_event(v_device_id, 41.387, 2.170);
    RAISE NOTICE 'Resultado API: %', v_result;

    IF v_result->>'status' = 'EXIT' AND v_result->>'from_zona' = 'T1' THEN
        RAISE NOTICE '✅ PASSED: Salida detectada correctamente.';
    ELSE
        RAISE NOTICE '❌ FAILED: Se esperaba EXIT de T1.';
    END IF;

    -- 4. TEST: GLITCH PROTECTION (Resurrección)
    -- Simulamos que vuelve a entrar a T1 solo 1 minuto después
    RAISE NOTICE '--- TEST 4: RESURRECCIÓN DE SESIÓN (Glitch) ---';
    v_result := fn_process_geofence_event(v_device_id, 41.292, 2.054);
    RAISE NOTICE 'Resultado API: %', v_result;
    
    IF v_result->>'status' = 'RESURRECT' THEN
        RAISE NOTICE '✅ PASSED: Sesión resucitada correctamente.';
    ELSE
        RAISE NOTICE '❌ FAILED: Se esperaba RESURRECT. (¿Quizás pasaron más de 15 min? No debería en script)';
    END IF;

    -- 5. TEST: CAMBIO DIRECTO (Teletransporte T1 -> T2)
    -- Primero salimos "lógicamente" esperando > 15 min o forzando DB... 
    -- Pero vamos a probar T1 -> T2 directo.
    -- Actualmente está en T1 (por la resurrección).
    RAISE NOTICE '--- TEST 5: CAMBIO DE ZONA (T1 -> T2) ---';
    -- Coordenada T2: 41.303, 2.068
    v_result := fn_process_geofence_event(v_device_id, 41.303, 2.068);
    RAISE NOTICE 'Resultado API: %', v_result;

    IF v_result->>'status' = 'CHANGE' AND v_result->>'prev_zona' = 'T1' AND v_result->>'zona' = 'T2' THEN
        RAISE NOTICE '✅ PASSED: Cambio de zona detectado correctamente.';
    ELSE
        RAISE NOTICE '❌ FAILED: Se esperaba CHANGE T1 -> T2.';
    END IF;

    -- VERIFICACIÓN FINAL EN DB
    RAISE NOTICE '--- ESTADO FINAL DB ---';
    FOR v_check IN SELECT * FROM registros_reten WHERE device_id = v_device_id ORDER BY created_at ASC LOOP
        RAISE NOTICE 'Registro: ID=% Zona=% Evento=% Exited=%', v_check.id, v_check.zona, v_check.evento, v_check.exited_at;
    END LOOP;

END $$;
