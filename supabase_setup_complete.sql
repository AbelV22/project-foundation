-- =====================================================
-- COMPLETE SUPABASE DATABASE SETUP
-- Run this entire script in your Supabase SQL Editor
-- Project: Taxi Geofencing App
-- =====================================================

-- =====================================================
-- 1. REGISTROS_RETEN - Taxi queue/waiting time tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.registros_reten (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT,
    zona TEXT NOT NULL,
    tipo_zona TEXT NOT NULL DEFAULT 'aeropuerto',
    evento TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    exited_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.registros_reten ENABLE ROW LEVEL SECURITY;

-- Policies for registros_reten
DROP POLICY IF EXISTS "Allow public insert on registros_reten" ON public.registros_reten;
DROP POLICY IF EXISTS "Allow public select on registros_reten" ON public.registros_reten;
DROP POLICY IF EXISTS "Allow public update on registros_reten" ON public.registros_reten;

CREATE POLICY "Allow public insert on registros_reten"
ON public.registros_reten FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on registros_reten"
ON public.registros_reten FOR SELECT USING (true);

CREATE POLICY "Allow public update on registros_reten"
ON public.registros_reten FOR UPDATE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_registros_reten_device_id ON public.registros_reten(device_id);
CREATE INDEX IF NOT EXISTS idx_registros_reten_exited_at ON public.registros_reten(exited_at) WHERE exited_at IS NULL;

COMMENT ON COLUMN public.registros_reten.exited_at IS 'Timestamp when the driver exited the zone (NULL = still in zone)';

-- =====================================================
-- 2. GEOFENCE_LOGS - Event tracking for debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS public.geofence_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    zona TEXT,
    previous_zona TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    device_id TEXT NOT NULL,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.geofence_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "insert_logs" ON public.geofence_logs;
DROP POLICY IF EXISTS "view_logs" ON public.geofence_logs;

CREATE POLICY "insert_logs" ON public.geofence_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "view_logs" ON public.geofence_logs FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_geofence_logs_device_created ON public.geofence_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_logs_event_type ON public.geofence_logs(event_type);

COMMENT ON TABLE public.geofence_logs IS 'Detailed geofence event logs for developer testing and debugging';

-- =====================================================
-- 3. LOCATION_DEBUG_LOGS - Diagnostic data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.location_debug_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    device_name TEXT,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    is_background BOOLEAN DEFAULT false,
    app_state TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.location_debug_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow public insert on location_debug_logs" ON public.location_debug_logs;
DROP POLICY IF EXISTS "Allow public select on location_debug_logs" ON public.location_debug_logs;

CREATE POLICY "Allow public insert on location_debug_logs"
ON public.location_debug_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on location_debug_logs"
ON public.location_debug_logs FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_location_debug_logs_device_id ON public.location_debug_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_location_debug_logs_created_at ON public.location_debug_logs(created_at DESC);

-- =====================================================
-- 4. REGISTROS_CARRERAS - Taxi fare tracking (PRO)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.registros_carreras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    importe DECIMAL(10,2) NOT NULL,
    propina DECIMAL(10,2) DEFAULT 0,
    metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
    zona TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.registros_carreras ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow public insert on registros_carreras" ON public.registros_carreras;
DROP POLICY IF EXISTS "Allow public select on registros_carreras" ON public.registros_carreras;

CREATE POLICY "Allow public insert on registros_carreras"
ON public.registros_carreras FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select on registros_carreras"
ON public.registros_carreras FOR SELECT USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_carreras_device_date ON public.registros_carreras(device_id, created_at DESC);

-- =====================================================
-- 5. DEVICE_REGISTRY - Device number assignments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.device_registry (
    id SERIAL PRIMARY KEY,
    device_uuid TEXT UNIQUE NOT NULL,
    device_number INTEGER UNIQUE NOT NULL,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_registry_uuid ON public.device_registry(device_uuid);
CREATE INDEX IF NOT EXISTS idx_device_registry_number ON public.device_registry(device_number);

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
ALTER TABLE public.device_registry ENABLE ROW LEVEL SECURITY;

-- Allow anonymous device registration
DROP POLICY IF EXISTS "Allow anonymous device registration" ON public.device_registry;
CREATE POLICY "Allow anonymous device registration"
ON public.device_registry FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- =====================================================
-- DONE! Your database is now set up.
-- =====================================================
