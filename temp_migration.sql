-- Quick Earnings Log - Track taxi fares with one tap
-- This is a PRO feature for paid subscribers

CREATE TABLE IF NOT EXISTS registros_carreras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  importe DECIMAL(10,2) NOT NULL,
  propina DECIMAL(10,2) DEFAULT 0,
  metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
  zona TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by device and date
CREATE INDEX IF NOT EXISTS idx_carreras_device_date 
ON registros_carreras(device_id, created_at DESC);

-- Row Level Security (optional, for multi-tenant)
ALTER TABLE registros_carreras ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own data
CREATE POLICY "Users can manage own carreras"
ON registros_carreras
FOR ALL
USING (true)
WITH CHECK (true);
-- Expense Tracking System
-- Track all taxi-related expenses for profit calculation

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance', 'operating', 'other')),
  subcategory TEXT, -- 'oil_change', 'insurance', 'parking', 'tires', 'car_wash', etc.
  amount DECIMAL(10,2) NOT NULL,
  odometer_reading INTEGER, -- km on odometer at time of expense
  liters DECIMAL(8,2), -- for fuel purchases
  notes TEXT,
  receipt_photo_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- 'monthly', 'weekly', 'yearly'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by device and date
CREATE INDEX IF NOT EXISTS idx_expenses_device_date
ON expenses(device_id, timestamp DESC);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_expenses_category
ON expenses(category, timestamp DESC);

-- Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own expenses
CREATE POLICY "Users can manage own expenses"
ON expenses
FOR ALL
USING (true)
WITH CHECK (true);

-- Enhanced earnings tracking with odometer and categories
-- Add new columns to existing registros_carreras table
ALTER TABLE registros_carreras
ADD COLUMN IF NOT EXISTS ride_category TEXT CHECK (ride_category IN ('airport', 'train_station', 'event', 'street', 'app', 'other')),
ADD COLUMN IF NOT EXISTS shift_type TEXT CHECK (shift_type IN ('morning', 'afternoon', 'night')),
ADD COLUMN IF NOT EXISTS start_km INTEGER,
ADD COLUMN IF NOT EXISTS end_km INTEGER,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Daily summary view for quick insights
CREATE OR REPLACE VIEW daily_profit_summary AS
SELECT
  device_id,
  DATE(created_at) as date,
  SUM(importe + COALESCE(propina, 0)) as total_revenue,
  COUNT(*) as num_rides,
  SUM(CASE WHEN metodo_pago = 'efectivo' THEN importe + COALESCE(propina, 0) ELSE 0 END) as cash_revenue,
  SUM(CASE WHEN metodo_pago = 'tarjeta' THEN importe + COALESCE(propina, 0) ELSE 0 END) as card_revenue
FROM registros_carreras
GROUP BY device_id, DATE(created_at);

-- Daily expenses summary
CREATE OR REPLACE VIEW daily_expenses_summary AS
SELECT
  device_id,
  DATE(timestamp) as date,
  SUM(amount) as total_expenses,
  SUM(CASE WHEN category = 'fuel' THEN amount ELSE 0 END) as fuel_expenses,
  SUM(CASE WHEN category = 'maintenance' THEN amount ELSE 0 END) as maintenance_expenses,
  SUM(CASE WHEN category = 'operating' THEN amount ELSE 0 END) as operating_expenses
FROM expenses
GROUP BY device_id, DATE(timestamp);

-- Combined profit view
CREATE OR REPLACE VIEW daily_profit AS
SELECT
  COALESCE(r.device_id, e.device_id) as device_id,
  COALESCE(r.date, e.date) as date,
  COALESCE(r.total_revenue, 0) as revenue,
  COALESCE(e.total_expenses, 0) as expenses,
  COALESCE(r.total_revenue, 0) - COALESCE(e.total_expenses, 0) as net_profit,
  r.num_rides,
  r.cash_revenue,
  r.card_revenue,
  e.fuel_expenses,
  e.maintenance_expenses,
  e.operating_expenses
FROM daily_profit_summary r
FULL OUTER JOIN daily_expenses_summary e
  ON r.device_id = e.device_id AND r.date = e.date;
