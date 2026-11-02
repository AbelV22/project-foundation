-- Security lockdown (3/5): private tickets bucket, each user limited to <user_id>/...
-- Applied to production 2026-11-02 via Supabase MCP.

ALTER POLICY "Anyone can read tickets" ON storage.objects
    TO authenticated
    USING (bucket_id = 'tickets' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER POLICY "Anyone can upload tickets" ON storage.objects
    TO authenticated
    WITH CHECK (bucket_id = 'tickets' AND (storage.foldername(name))[1] = auth.uid()::text);

UPDATE storage.buckets SET public = false WHERE id = 'tickets';
