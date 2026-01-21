-- Clean up all existing geofence logs
TRUNCATE TABLE geofence_logs;

-- Clean up waiting registry entries (optional, but good for starting fresh)
-- We will delete entries that seem to be tests or just clear old ones if that's preferred.
-- Given "clean all testing data", safe to assume we want a clean slate for the dashboard.
DELETE FROM registros_reten WHERE device_id LIKE 'test%';
DELETE FROM registros_reten WHERE zona = 'DEBUG';

-- If truly "ALL" testing data, we might want to truncate registers too, 
-- but let's be careful not to delete real production data if any existed.
-- However, since this is a dev/test phase for "my father", likely all is test data.
-- Uncomment the below line if you want to wipe ALL registry entries:
-- TRUNCATE TABLE registros_reten;
