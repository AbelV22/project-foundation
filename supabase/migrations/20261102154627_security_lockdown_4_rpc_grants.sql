-- Security lockdown (4/5): geofence processing only through the Edge Function.
-- Applied to production 2026-11-02 via Supabase MCP.

REVOKE EXECUTE ON FUNCTION public.fn_process_geofence_event(text, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_transit_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_process_geofence_event(text, double precision, double precision, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_transit_sessions() TO service_role;
