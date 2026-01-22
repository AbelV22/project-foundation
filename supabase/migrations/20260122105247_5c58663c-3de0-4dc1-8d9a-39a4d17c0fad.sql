-- Create location_debug_logs table for tracking diagnostics
CREATE TABLE public.location_debug_logs (
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

-- Allow anyone to insert logs (for debugging)
CREATE POLICY "Allow public insert on location_debug_logs" 
ON public.location_debug_logs 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to read logs
CREATE POLICY "Allow public select on location_debug_logs" 
ON public.location_debug_logs 
FOR SELECT 
USING (true);

-- Add index for faster queries
CREATE INDEX idx_location_debug_logs_device_id ON public.location_debug_logs(device_id);
CREATE INDEX idx_location_debug_logs_created_at ON public.location_debug_logs(created_at DESC);