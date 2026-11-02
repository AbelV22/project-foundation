-- Security lockdown (5/5): views ran as SECURITY DEFINER and bypassed RLS,
-- exposing every session with lat/lng (registros_reten_capped) and drivers'
-- revenue/expenses (daily_profit*). Applied to production 2026-11-02 via Supabase MCP.

ALTER VIEW public.registros_reten_capped SET (security_invoker = true);
ALTER VIEW public.daily_profit SET (security_invoker = true);
ALTER VIEW public.daily_profit_summary SET (security_invoker = true);
ALTER VIEW public.daily_expenses_summary SET (security_invoker = true);
ALTER VIEW public.transport_hourly_averages SET (security_invoker = true);
