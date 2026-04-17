-- Scope ticket_diario by auth.uid(), same pattern as registros_carreras
-- and expenses. Previous policies were "Device can insert/read own tickets"
-- with USING(true) / WITH CHECK(true) on the public role — anyone with the
-- anon key could read or insert any row. Existing rows keep user_id NULL
-- and are invisible under the new policies.

ALTER TABLE public.ticket_diario
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_ticket_diario_user_id
  ON public.ticket_diario(user_id);

DROP POLICY IF EXISTS "Device can insert own tickets" ON public.ticket_diario;
DROP POLICY IF EXISTS "Device can read own tickets" ON public.ticket_diario;

CREATE POLICY "ticket_diario_select_own" ON public.ticket_diario
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ticket_diario_insert_own" ON public.ticket_diario
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ticket_diario_update_own" ON public.ticket_diario
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ticket_diario_delete_own" ON public.ticket_diario
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
