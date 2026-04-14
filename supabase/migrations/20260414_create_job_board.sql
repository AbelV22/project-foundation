-- Bolsa de trabajo: conductores buscan taxi / titulares buscan conductor
CREATE TABLE IF NOT EXISTS job_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  ad_type TEXT NOT NULL CHECK (ad_type IN ('busco_conductor', 'busco_taxi')),
  title TEXT NOT NULL,
  description TEXT,
  shift TEXT CHECK (shift IN ('morning', 'afternoon', 'night', 'flexible')),
  rest_day TEXT,
  vehicle_type TEXT,
  zone TEXT,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  contact_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_job_board_type_status ON job_board(ad_type, status, created_at DESC);
CREATE INDEX idx_job_board_device ON job_board(device_id);

ALTER TABLE job_board ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_board_select" ON job_board FOR SELECT USING (true);
CREATE POLICY "job_board_insert" ON job_board FOR INSERT WITH CHECK (true);
CREATE POLICY "job_board_update" ON job_board FOR UPDATE USING (true);
CREATE POLICY "job_board_delete" ON job_board FOR DELETE USING (true);
