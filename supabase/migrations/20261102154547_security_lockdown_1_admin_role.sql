-- Security lockdown (1/5): admin role + aggregated waiting times RPC.
-- Applied to production 2026-11-02 via Supabase MCP.
-- After creating the admin account in Authentication → Users:
--   INSERT INTO public.admin_users (user_id) SELECT id FROM auth.users WHERE email = '<email>';

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

-- Waiting times aggregated server-side (clients can no longer read registros_reten).
-- Window by exit time, NULL tipo_zona kept, zombie-closed sessions (exactly +3h) excluded,
-- active = open sessions without pending exit in the last 3h. Null average under 5 waits.
CREATE OR REPLACE FUNCTION public.fn_get_waiting_times()
RETURNS TABLE (
    zona TEXT,
    espera_minutos INTEGER,
    taxistas_activos INTEGER,
    esperas_completadas INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH completadas AS (
        SELECT r.zona::text AS zona,
               EXTRACT(EPOCH FROM (r.exited_at - r.created_at)) / 60 AS minutos
        FROM registros_reten r
        WHERE r.exited_at >= now() - INTERVAL '2 hours'
          AND r.tipo_zona IS DISTINCT FROM 'TRANSIT'
          AND r.exited_at - r.created_at >= INTERVAL '30 minutes'
          AND r.exited_at <> r.created_at + INTERVAL '3 hours'
    ),
    medias AS (
        SELECT c.zona, count(*) AS n, avg(c.minutos) AS media
        FROM completadas c
        GROUP BY c.zona
    ),
    activos AS (
        SELECT r.zona::text AS zona, count(*) AS n
        FROM registros_reten r
        WHERE r.exited_at IS NULL
          AND r.pending_exit_at IS NULL
          AND r.created_at >= now() - INTERVAL '3 hours'
          AND r.tipo_zona IS DISTINCT FROM 'TRANSIT'
        GROUP BY r.zona
    ),
    zonas AS (
        SELECT m.zona FROM medias m
        UNION
        SELECT a.zona FROM activos a
    )
    SELECT z.zona,
           CASE WHEN coalesce(m.n, 0) >= 5 THEN round(m.media)::int END,
           coalesce(a.n, 0)::int,
           coalesce(m.n, 0)::int
    FROM zonas z
    LEFT JOIN medias m ON m.zona = z.zona
    LEFT JOIN activos a ON a.zona = z.zona;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_waiting_times() TO anon, authenticated;
