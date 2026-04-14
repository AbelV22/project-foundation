-- Transport hourly baselines: real data collected over time
-- Used by smart alerts to compare current vs normal conditions
CREATE TABLE IF NOT EXISTS transport_hourly_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  zone TEXT NOT NULL,
  avg_flights NUMERIC(6,2) DEFAULT 0,
  avg_pax NUMERIC(8,2) DEFAULT 0,
  avg_trains NUMERIC(6,2) DEFAULT 0,
  avg_demand_score NUMERIC(5,2) DEFAULT 0,
  sample_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(day_of_week, hour_of_day, zone)
);

CREATE INDEX idx_baselines_lookup ON transport_hourly_baselines(day_of_week, hour_of_day);

-- Raw hourly snapshots (kept for 90 days, then pruned)
CREATE TABLE IF NOT EXISTS transport_hourly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ DEFAULT now(),
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,
  zone TEXT NOT NULL,
  flight_count INTEGER DEFAULT 0,
  pax_estimate INTEGER DEFAULT 0,
  train_count INTEGER DEFAULT 0,
  demand_score INTEGER DEFAULT 0,
  weather_multiplier NUMERIC(4,2) DEFAULT 1.0,
  is_raining BOOLEAN DEFAULT false,
  taxistas_activos INTEGER DEFAULT 0
);

CREATE INDEX idx_snapshots_time ON transport_hourly_snapshots(captured_at DESC);
CREATE INDEX idx_snapshots_lookup ON transport_hourly_snapshots(day_of_week, hour_of_day, zone);

ALTER TABLE transport_hourly_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_hourly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baselines_select" ON transport_hourly_baselines FOR SELECT USING (true);
CREATE POLICY "baselines_insert" ON transport_hourly_baselines FOR INSERT WITH CHECK (true);
CREATE POLICY "baselines_update" ON transport_hourly_baselines FOR UPDATE USING (true);

CREATE POLICY "snapshots_select" ON transport_hourly_snapshots FOR SELECT USING (true);
CREATE POLICY "snapshots_insert" ON transport_hourly_snapshots FOR INSERT WITH CHECK (true);

-- Function to update rolling averages from a new snapshot
CREATE OR REPLACE FUNCTION fn_update_baseline_from_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transport_hourly_baselines (day_of_week, hour_of_day, zone, avg_flights, avg_pax, avg_trains, avg_demand_score, sample_count, last_updated_at)
  VALUES (NEW.day_of_week, NEW.hour_of_day, NEW.zone, NEW.flight_count, NEW.pax_estimate, NEW.train_count, NEW.demand_score, 1, now())
  ON CONFLICT (day_of_week, hour_of_day, zone)
  DO UPDATE SET
    avg_flights = (transport_hourly_baselines.avg_flights * transport_hourly_baselines.sample_count + NEW.flight_count) / (transport_hourly_baselines.sample_count + 1),
    avg_pax = (transport_hourly_baselines.avg_pax * transport_hourly_baselines.sample_count + NEW.pax_estimate) / (transport_hourly_baselines.sample_count + 1),
    avg_trains = (transport_hourly_baselines.avg_trains * transport_hourly_baselines.sample_count + NEW.train_count) / (transport_hourly_baselines.sample_count + 1),
    avg_demand_score = (transport_hourly_baselines.avg_demand_score * transport_hourly_baselines.sample_count + NEW.demand_score) / (transport_hourly_baselines.sample_count + 1),
    sample_count = transport_hourly_baselines.sample_count + 1,
    last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_baseline
AFTER INSERT ON transport_hourly_snapshots
FOR EACH ROW
EXECUTE FUNCTION fn_update_baseline_from_snapshot();
