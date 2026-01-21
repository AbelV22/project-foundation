-- Debug logs for background location tracking
-- This table records every attempt to get/send location
-- Use this to diagnose why tracking stops in background

CREATE TABLE IF NOT EXISTS location_debug_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    device_name TEXT,
    event_type TEXT NOT NULL, -- 'location_received', 'location_sent', 'error', 'service_start', 'service_stop', 'watcher_added', 'permission_check'
    message TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    accuracy REAL,
    is_background BOOLEAN DEFAULT false,
    app_state TEXT, -- 'foreground', 'background', 'screen_off'
    battery_level INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_location_debug_device ON location_debug_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_debug_type ON location_debug_logs(event_type, created_at DESC);

-- Enable RLS
ALTER TABLE location_debug_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon users (for tracking)
CREATE POLICY "Allow insert debug logs" ON location_debug_logs
    FOR INSERT TO anon
    WITH CHECK (true);

-- Allow select for authenticated users
CREATE POLICY "Allow select debug logs" ON location_debug_logs
    FOR SELECT TO authenticated
    USING (true);

-- Also allow anon to select their own device logs
CREATE POLICY "Allow anon select own logs" ON location_debug_logs
    FOR SELECT TO anon
    USING (device_id IS NOT NULL);
