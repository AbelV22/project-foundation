-- Create table for detailed geofence event logs (for developer testing)
CREATE TABLE public.geofence_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- ENTER_ZONE, EXIT_ZONE, POSITION_UPDATE
  zona TEXT, -- Current zone (null if outside all zones)
  previous_zona TEXT, -- Previous zone (for transition tracking)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION, -- GPS accuracy in meters
  device_id TEXT NOT NULL,
  device_name TEXT, -- Optional friendly name for device
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.geofence_logs ENABLE ROW LEVEL SECURITY;

-- Allow edge function to insert logs
CREATE POLICY "Service can insert logs"
ON public.geofence_logs
FOR INSERT
WITH CHECK (true);

-- Allow authenticated read for admin panel
CREATE POLICY "Anyone can view logs"
ON public.geofence_logs
FOR SELECT
USING (true);

-- Index for efficient querying by device and time
CREATE INDEX idx_geofence_logs_device_created 
ON public.geofence_logs(device_id, created_at DESC);

-- Index for event type filtering
CREATE INDEX idx_geofence_logs_event_type 
ON public.geofence_logs(event_type);

-- Comment on table
COMMENT ON TABLE public.geofence_logs IS 'Detailed geofence event logs for developer testing and debugging';
