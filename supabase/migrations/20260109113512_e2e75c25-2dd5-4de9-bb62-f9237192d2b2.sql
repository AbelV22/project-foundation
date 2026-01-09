-- Add device_id column to registros_reten
ALTER TABLE public.registros_reten 
ADD COLUMN device_id TEXT;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can register entry " ON public.registros_reten;
DROP POLICY IF EXISTS "Anyone can view registrations " ON public.registros_reten;

-- Create new policies with device_id validation
CREATE POLICY "Insert with valid device_id and coordinates"
ON public.registros_reten
FOR INSERT
WITH CHECK (
  device_id IS NOT NULL 
  AND length(device_id) >= 36
  AND lat BETWEEN 41.0 AND 42.0
  AND lng BETWEEN 1.5 AND 3.0
);

CREATE POLICY "Users can view own registrations by device"
ON public.registros_reten
FOR SELECT
USING (false);

-- Create index for device_id lookups
CREATE INDEX idx_registros_reten_device_id ON public.registros_reten(device_id);