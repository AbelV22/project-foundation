-- Clean ALL existing location/geofencing data for fresh start
-- This removes all test data so the admin dashboard shows only real data

-- Clean geofence logs (developer testing logs)
TRUNCATE TABLE geofence_logs;

-- Clean all waiting time registry entries
TRUNCATE TABLE registros_reten;

-- Clean location debug logs (native service logs)
TRUNCATE TABLE location_debug_logs;

-- Note: device_registry is preserved to keep device number assignments
-- This way devices keep their simple IDs (D1, D2, etc.)
