-- Create registros_reten table for tracking taxi drivers in queue
CREATE TABLE public.registros_reten (
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

-- Create registros_carreras table for tracking taxi rides
CREATE TABLE public.registros_carreras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    importe DECIMAL NOT NULL,
    propina DECIMAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    zona TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.registros_reten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_carreras ENABLE ROW LEVEL SECURITY;

-- Allow public insert for registros_reten (anonymous device tracking)
CREATE POLICY "Allow public insert on registros_reten"
ON public.registros_reten
FOR INSERT
WITH CHECK (true);

-- Allow public select for registros_reten (for stats)
CREATE POLICY "Allow public select on registros_reten"
ON public.registros_reten
FOR SELECT
USING (true);

-- Allow public update for registros_reten (for updating exited_at)
CREATE POLICY "Allow public update on registros_reten"
ON public.registros_reten
FOR UPDATE
USING (true);

-- Allow public insert for registros_carreras
CREATE POLICY "Allow public insert on registros_carreras"
ON public.registros_carreras
FOR INSERT
WITH CHECK (true);

-- Allow public select for registros_carreras
CREATE POLICY "Allow public select on registros_carreras"
ON public.registros_carreras
FOR SELECT
USING (true);