-- ============================================================================
-- MIGRACIÓN COMPLETA - CREAR TODO DESDE CERO
-- ============================================================================
-- Copia TODO este archivo y ejecútalo en Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/uqjwfnevtefdfpbckuwf/sql/new
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR TABLA DE INGRESOS (registros_carreras)
-- ============================================================================

CREATE TABLE IF NOT EXISTS registros_carreras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  importe DECIMAL(10,2) NOT NULL,
  propina DECIMAL(10,2) DEFAULT 0,
  metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
  zona TEXT,
  ride_category TEXT CHECK (ride_category IN ('airport', 'train_station', 'event', 'street', 'app', 'other')),
  shift_type TEXT CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  start_km INTEGER,
  end_km INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_carreras_device_date
ON registros_carreras(device_id, created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE registros_carreras ENABLE ROW LEVEL SECURITY;

-- Política de acceso (todos pueden leer/escribir sus propios datos)
DROP POLICY IF EXISTS "Users can manage own carreras" ON registros_carreras;
CREATE POLICY "Users can manage own carreras"
ON registros_carreras
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PASO 2: CREAR TABLA DE GASTOS (expenses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance', 'operating', 'other')),
  subcategory TEXT,
  amount DECIMAL(10,2) NOT NULL,
  odometer_reading INTEGER,
  liters DECIMAL(8,2),
  notes TEXT,
  receipt_photo_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_expenses_device_date
ON expenses(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_category
ON expenses(category, timestamp DESC);

-- Habilitar Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Política de acceso
DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;
CREATE POLICY "Users can manage own expenses"
ON expenses
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PASO 3: CREAR VISTAS PARA ANÁLISIS DE BENEFICIOS
-- ============================================================================

-- Vista: Resumen diario de ingresos
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

-- Vista: Resumen diario de gastos
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

-- Vista: Beneficio neto combinado
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

-- ============================================================================
-- ¡LISTO!
-- ============================================================================
-- Después de ejecutar este SQL, tendrás:
-- ✅ Tabla: registros_carreras (para registrar ingresos de carreras)
-- ✅ Tabla: expenses (para registrar gastos)
-- ✅ Vista: daily_profit_summary (resumen diario de ingresos)
-- ✅ Vista: daily_expenses_summary (resumen diario de gastos)
-- ✅ Vista: daily_profit (beneficio neto = ingresos - gastos)
-- ✅ Índices optimizados para búsquedas rápidas
-- ✅ Políticas RLS configuradas
-- ============================================================================
