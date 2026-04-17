-- Make earnings + expenses user-scoped instead of device-scoped.
-- Existing rows keep user_id NULL; the new RLS policies require
-- user_id = auth.uid(), so those orphan rows become invisible to
-- everyone (previously leaked via USING(true) to any client regardless
-- of device_id).

-- 1. Add user_id columns (nullable, default to current auth uid on insert
--    so authenticated clients don't have to remember to pass it).
ALTER TABLE public.registros_carreras
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

-- 2. Indexes for the new filter column.
CREATE INDEX IF NOT EXISTS idx_registros_carreras_user_id
  ON public.registros_carreras(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id
  ON public.expenses(user_id);

-- 3. Replace the permissive USING(true) policies with proper per-user
--    policies, one per operation.
DROP POLICY IF EXISTS "Users can manage own carreras" ON public.registros_carreras;
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;

-- registros_carreras
CREATE POLICY "carreras_select_own" ON public.registros_carreras
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "carreras_insert_own" ON public.registros_carreras
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "carreras_update_own" ON public.registros_carreras
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "carreras_delete_own" ON public.registros_carreras
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- expenses
CREATE POLICY "expenses_select_own" ON public.expenses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "expenses_insert_own" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update_own" ON public.expenses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_delete_own" ON public.expenses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
