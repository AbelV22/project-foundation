-- Device registry table for simple numeric device IDs
-- Each device gets a sequential number starting from 1

CREATE TABLE IF NOT EXISTS device_registry (
    id SERIAL PRIMARY KEY,
    device_uuid TEXT UNIQUE NOT NULL,
    device_number INTEGER UNIQUE NOT NULL,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_device_registry_uuid ON device_registry(device_uuid);
CREATE INDEX IF NOT EXISTS idx_device_registry_number ON device_registry(device_number);

-- Function to get or create device number
CREATE OR REPLACE FUNCTION get_or_create_device_number(p_device_uuid TEXT, p_device_name TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_device_number INTEGER;
BEGIN
    -- Try to find existing device
    SELECT device_number INTO v_device_number
    FROM device_registry
    WHERE device_uuid = p_device_uuid;

    IF v_device_number IS NOT NULL THEN
        -- Update last seen
        UPDATE device_registry
        SET last_seen_at = NOW(),
            device_name = COALESCE(p_device_name, device_name)
        WHERE device_uuid = p_device_uuid;
        RETURN v_device_number;
    END IF;

    -- Create new device with next sequential number
    INSERT INTO device_registry (device_uuid, device_number, device_name)
    SELECT p_device_uuid, COALESCE(MAX(device_number), 0) + 1, p_device_name
    FROM device_registry
    RETURNING device_number INTO v_device_number;

    RETURN v_device_number;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE device_registry ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/insert for device registration
CREATE POLICY "Allow anonymous device registration"
ON device_registry FOR ALL
TO anon
USING (true)
WITH CHECK (true);
