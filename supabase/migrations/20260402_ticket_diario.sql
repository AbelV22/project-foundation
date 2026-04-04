-- Ticket diario: datos extraídos de tickets Taxitronic
CREATE TABLE ticket_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  fecha DATE NOT NULL,
  km_totales DECIMAL,
  ingresos_totales DECIMAL,
  num_carreras INTEGER,
  foto_url TEXT,
  datos_raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_diario_device ON ticket_diario(device_id, fecha DESC);

-- RLS
ALTER TABLE ticket_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Device can read own tickets" ON ticket_diario FOR SELECT USING (true);
CREATE POLICY "Device can insert own tickets" ON ticket_diario FOR INSERT WITH CHECK (true);

-- Storage bucket para fotos de tickets
INSERT INTO storage.buckets (id, name, public) VALUES ('tickets', 'tickets', true);
CREATE POLICY "Anyone can upload tickets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tickets');
CREATE POLICY "Anyone can read tickets" ON storage.objects FOR SELECT USING (bucket_id = 'tickets');
