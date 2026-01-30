-- ============================================================================
-- TEST SCRIPT FOR GEOFENCE FUNCTIONALITY
-- Run this in Supabase SQL Editor after applying the migration
-- ============================================================================

-- 1. TEST ZONE DETECTION (should return T1)
SELECT 'Test 1: Zone Detection' as test;
SELECT * FROM fn_test_zone_detection(41.2922, 2.0553);

-- 2. CLEAN UP TEST DEVICE
SELECT 'Test 2: Clean up test device' as test;
DELETE FROM registros_reten WHERE device_id = 'TEST_DEBUG_DEVICE';

-- 3. FIRST CALL - Should return ENTER
SELECT 'Test 3: First call - expect ENTER' as test;
SELECT fn_process_geofence_event('TEST_DEBUG_DEVICE', 41.2922, 2.0553, 25);

-- 4. SECOND CALL - Should return STAY
SELECT 'Test 4: Second call - expect STAY' as test;
SELECT fn_process_geofence_event('TEST_DEBUG_DEVICE', 41.2922, 2.0553, 25);

-- 5. VERIFY SESSION EXISTS
SELECT 'Test 5: Verify session' as test;
SELECT id, device_id, zona, created_at, exited_at, pending_exit_at
FROM registros_reten
WHERE device_id = 'TEST_DEBUG_DEVICE';

-- 6. CALL FROM OUTSIDE - Should return PENDING_EXIT
SELECT 'Test 6: Call from outside - expect PENDING_EXIT' as test;
SELECT fn_process_geofence_event('TEST_DEBUG_DEVICE', 40.0, 1.0, 25);

-- 7. VERIFY PENDING_EXIT IS SET
SELECT 'Test 7: Verify pending_exit_at is set' as test;
SELECT id, device_id, zona, pending_exit_at
FROM registros_reten
WHERE device_id = 'TEST_DEBUG_DEVICE';

-- 8. RETURN TO ZONE - Should return RETURNED
SELECT 'Test 8: Return to zone - expect RETURNED' as test;
SELECT fn_process_geofence_event('TEST_DEBUG_DEVICE', 41.2922, 2.0553, 25);

-- 9. VERIFY PENDING_EXIT IS CLEARED
SELECT 'Test 9: Verify pending_exit_at is cleared' as test;
SELECT id, device_id, zona, pending_exit_at
FROM registros_reten
WHERE device_id = 'TEST_DEBUG_DEVICE';

-- 10. CLEANUP
SELECT 'Test 10: Cleanup' as test;
DELETE FROM registros_reten WHERE device_id = 'TEST_DEBUG_DEVICE';

-- ============================================================================
-- VERIFY ALL ZONES HAVE POLYGONS
-- ============================================================================
SELECT 'Zone verification' as test;
SELECT z.slug, z.name, COUNT(zp.id) as polygon_count
FROM zones z
LEFT JOIN zone_polygons zp ON z.id = zp.zone_id
GROUP BY z.slug, z.name
ORDER BY z.slug;
