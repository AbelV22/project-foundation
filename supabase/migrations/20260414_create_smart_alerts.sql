-- Smart alerts: demand spikes, rain, events, flight peaks
CREATE TABLE IF NOT EXISTS smart_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'flight_peak', 'rain_demand', 'event_surge', 'high_demand', 'cruise_arrival', 'low_supply'
  )),
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🔔',
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  zone TEXT,
  demand_score INTEGER,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_smart_alerts_device ON smart_alerts(device_id, created_at DESC);
CREATE INDEX idx_smart_alerts_active ON smart_alerts(device_id, dismissed, expires_at);

ALTER TABLE smart_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smart_alerts_select" ON smart_alerts FOR SELECT USING (true);
CREATE POLICY "smart_alerts_insert" ON smart_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "smart_alerts_update" ON smart_alerts FOR UPDATE USING (true);
CREATE POLICY "smart_alerts_delete" ON smart_alerts FOR DELETE USING (true);
