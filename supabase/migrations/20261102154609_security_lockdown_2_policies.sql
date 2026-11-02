-- Security lockdown (2/5): close anonymous access to location data, devices,
-- debug logs, baselines writes, zones and job board.
-- Applied to production 2026-11-02 via Supabase MCP. Existing policies are
-- altered in place (production policy names differ from older migrations).

-- Registration stays anonymous but reads device_registry as owner
ALTER FUNCTION public.get_or_create_device_number(text, text) SECURITY DEFINER SET search_path = public;

-- Location data: admin only (writes come from fn_process_geofence_event via service_role)
ALTER POLICY "Allow all" ON public.registros_reten
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER POLICY "Allow service update" ON public.registros_reten
    TO authenticated USING (public.is_admin());

ALTER POLICY "Allow all" ON public.geofence_logs
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER POLICY "Allow anonymous device registration" ON public.device_registry
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Native clients still insert debug logs, only admins read them
ALTER POLICY "Allow anon select own logs" ON public.location_debug_logs
    TO authenticated USING (public.is_admin());
ALTER POLICY "Allow select debug logs" ON public.location_debug_logs
    TO authenticated USING (public.is_admin());

-- Baselines: public read, no client writes
ALTER POLICY "baselines_insert" ON public.transport_hourly_baselines
    TO authenticated WITH CHECK (public.is_admin());
ALTER POLICY "baselines_update" ON public.transport_hourly_baselines
    TO authenticated USING (public.is_admin());

-- Zones had RLS disabled and anon could insert/update/delete geofence polygons
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_select" ON public.zones
    FOR SELECT USING (true);
CREATE POLICY "zones_admin_write" ON public.zones
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Job board: ads owned by the Supabase Auth account that created them
ALTER TABLE public.job_board
    ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_job_board_user_id ON public.job_board(user_id);

ALTER POLICY "job_board_select" ON public.job_board
    USING (
        (status = 'active' AND (expires_at IS NULL OR expires_at > now()))
        OR user_id = auth.uid()
        OR public.is_admin()
    );
ALTER POLICY "job_board_insert" ON public.job_board
    TO authenticated WITH CHECK (user_id = auth.uid());
ALTER POLICY "job_board_update" ON public.job_board
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());
ALTER POLICY "job_board_delete" ON public.job_board
    TO authenticated USING (user_id = auth.uid() OR public.is_admin());
