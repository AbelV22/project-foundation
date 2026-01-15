CREATE TABLE public.geofence_logs (
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

ALTER TABLE public.geofence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_logs" ON public.geofence_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "view_logs" ON public.geofence_logs FOR SELECT USING (true);