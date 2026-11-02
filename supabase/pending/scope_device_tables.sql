-- =============================================================================
-- SECURITY LOCKDOWN (fase 2) — NO APLICAR TODAVÍA
-- =============================================================================
-- Limita smart_alerts e imet_calendar al dispositivo que hace la petición.
--
-- El cliente envía su UUID secreto (hardware ID / UUID aleatorio, guardado en
-- localStorage 'itaxi_device_uuid') en la cabecera x-device-uuid, que añade
-- src/integrations/supabase/client.ts. El UUID ya no es legible por terceros
-- tras la fase 1, a diferencia de los IDs públicos "D<n>".
--
-- Las APKs anteriores no envían esa cabecera: aplicar SOLO cuando la mayoría
-- de dispositivos tenga la versión nueva. Para aplicarla, mover este archivo a
-- supabase/migrations/ con un prefijo de fecha.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.request_device_ids()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH h AS (
        SELECT nullif(current_setting('request.headers', true), '')::json ->> 'x-device-uuid' AS uuid
    )
    SELECT array_remove(
        ARRAY[
            h.uuid,
            (SELECT 'D' || d.device_number FROM device_registry d WHERE d.device_uuid = h.uuid)
        ],
        NULL
    )
    FROM h
    WHERE h.uuid IS NOT NULL AND length(h.uuid) >= 16;
$$;

REVOKE ALL ON FUNCTION public.request_device_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_device_ids() TO anon, authenticated;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('smart_alerts', 'imet_calendar')
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imet_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_alerts_own_device" ON public.smart_alerts
    FOR ALL
    USING (device_id = ANY (public.request_device_ids()) OR public.is_admin())
    WITH CHECK (device_id = ANY (public.request_device_ids()) OR public.is_admin());

CREATE POLICY "imet_calendar_own_device" ON public.imet_calendar
    FOR ALL
    USING (device_id = ANY (public.request_device_ids()))
    WITH CHECK (device_id = ANY (public.request_device_ids()));
