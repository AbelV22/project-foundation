-- ============================================================================
-- DATA RETENTION POLICY
-- Clean up old debug logs to save storage
-- ============================================================================

-- Function to clean logs older than 7 days
CREATE OR REPLACE FUNCTION cleanup_old_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.location_debug_logs
    WHERE created_at < now() - INTERVAL '7 days';
END;
$$;

-- Note: In Supabase, you can schedule this using pg_cron extension if enabled:
-- SELECT cron.schedule('0 0 * * *', 'SELECT cleanup_old_debug_logs()');

-- Or just run it manually for now.
SELECT cleanup_old_debug_logs();
