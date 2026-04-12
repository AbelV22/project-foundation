-- Add ride source field to track where each ride came from
ALTER TABLE registros_carreras
ADD COLUMN IF NOT EXISTS ride_source TEXT DEFAULT 'street';

COMMENT ON COLUMN registros_carreras.ride_source IS 'Source: street, stand, freenow, picmi, cabify, app, other';

-- Create IMET compliance calendar table for tracking deadlines
CREATE TABLE IF NOT EXISTS imet_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- itv, taximeter, insurance, metro_review, license_review, other
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  remind_days_before INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imet_calendar_device ON imet_calendar(device_id, due_date);

ALTER TABLE imet_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imet_select" ON imet_calendar FOR SELECT USING (true);
CREATE POLICY "imet_insert" ON imet_calendar FOR INSERT WITH CHECK (true);
CREATE POLICY "imet_update" ON imet_calendar FOR UPDATE USING (true);
CREATE POLICY "imet_delete" ON imet_calendar FOR DELETE USING (true);
