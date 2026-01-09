-- Create table for taxi queue registrations
CREATE TABLE public.registros_reten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona TEXT NOT NULL,
  tipo_zona TEXT NOT NULL DEFAULT 'STANDARD',
  evento TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.registros_reten ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for anonymous taxi drivers)
CREATE POLICY "Anyone can register entry"
ON public.registros_reten
FOR INSERT
WITH CHECK (true);

-- Allow anyone to read registrations (for stats)
CREATE POLICY "Anyone can view registrations"
ON public.registros_reten
FOR SELECT
USING (true);