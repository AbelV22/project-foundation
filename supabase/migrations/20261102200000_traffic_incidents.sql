-- =============================================================================
-- Traffic incidents (accidents, closed roads, congestion) around Barcelona.
-- =============================================================================
-- The traffic-sync Edge Function downloads the official feeds every 3 min
-- (pg_cron → pg_net) and replaces each source's rows through
-- fn_replace_traffic_incidents. Clients only read the table via PostgREST,
-- which doesn't consume Edge Function invocations.
--   * sct          Servei Català de Trànsit: accidents, retentions, closures
--   * bcn_trams    Ajuntament: city sections in congestion (5) or closed (6)
--   * bcn_avisos   Ajuntament: free-text traffic notices
-- The feeds are fetched from the Edge Function because gencat.cat drops
-- connections coming from the database's network (pg_net times out).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.traffic_incidents (
    id          TEXT PRIMARY KEY,           -- "<source>:<source id>"
    source      TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('accidente', 'corte', 'retencion', 'congestion', 'aviso')),
    severity    SMALLINT NOT NULL DEFAULT 1, -- 1 (info) .. 5 (closed road)
    road        TEXT,
    title       TEXT NOT NULL,
    detail      TEXT,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    started_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traffic_incidents_source ON public.traffic_incidents (source);

ALTER TABLE public.traffic_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY traffic_incidents_select ON public.traffic_incidents
    FOR SELECT TO anon, authenticated USING (true);

-- Replace every row of one source with the latest snapshot, atomically.
CREATE OR REPLACE FUNCTION public.fn_replace_traffic_incidents(p_source TEXT, p_items JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM traffic_incidents WHERE source = p_source;

    INSERT INTO traffic_incidents (id, source, kind, severity, road, title, detail, lat, lng, started_at, updated_at)
    SELECT DISTINCT ON (i.id)
           i.id, p_source, i.kind, coalesce(i.severity, 1), i.road, i.title, i.detail,
           i.lat, i.lng, i.started_at, now()
    FROM jsonb_to_recordset(p_items) AS i(
        id TEXT, kind TEXT, severity SMALLINT, road TEXT, title TEXT, detail TEXT,
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, started_at TIMESTAMPTZ
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_replace_traffic_incidents(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_replace_traffic_incidents(TEXT, JSONB) TO service_role;

-- Names and midpoints of the Ajuntament's traffic sections (static; the
-- Edge Function loads it once from transit_relacio_trams.csv).
CREATE TABLE IF NOT EXISTS public.bcn_traffic_sections (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    lat   DOUBLE PRECISION,
    lng   DOUBLE PRECISION
);
ALTER TABLE public.bcn_traffic_sections ENABLE ROW LEVEL SECURITY;  -- no policies: service role only

-- Shared secret between the cron job and the Edge Function (generated in the
-- database, never leaves it except in the cron request header).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'traffic_sync_secret') THEN
        PERFORM vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'traffic_sync_secret');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_traffic_sync_secret()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'traffic_sync_secret';
$$;

REVOKE EXECUTE ON FUNCTION public.fn_traffic_sync_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_traffic_sync_secret() TO service_role;

-- Every 3 minutes: ~14k invocations/month, under 3% of the free plan quota.
SELECT cron.schedule(
    'traffic-sync',
    '*/3 * * * *',
    $cron$
    SELECT net.http_post(
        url := 'https://uqjwfnevtefdfpbckuwf.supabase.co/functions/v1/traffic-sync',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'traffic_sync_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
    $cron$
);
