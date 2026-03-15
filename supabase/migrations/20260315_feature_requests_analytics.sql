-- ============================================================
-- Feature Requests + Voting + App Analytics
-- 2026-03-15
-- ============================================================

-- ── Feature requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT        NOT NULL,
  user_email   TEXT,                          -- filled if logged in
  title        TEXT        NOT NULL,
  description  TEXT,
  category     TEXT        NOT NULL DEFAULT 'general',
  vote_count   INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending',
    -- pending | planned | in_progress | done | rejected
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Votes (one per device per feature) ───────────────────────
CREATE TABLE IF NOT EXISTS feature_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id  UUID        NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  device_id   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_id, device_id)
);

-- Keep vote_count in sync automatically
CREATE OR REPLACE FUNCTION sync_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feature_requests SET vote_count = vote_count + 1 WHERE id = NEW.feature_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feature_requests SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.feature_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vote_count ON feature_votes;
CREATE TRIGGER trg_sync_vote_count
  AFTER INSERT OR DELETE ON feature_votes
  FOR EACH ROW EXECUTE FUNCTION sync_vote_count();

-- ── App analytics events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,   -- 'view' | 'action'
  event_name  TEXT        NOT NULL,   -- 'tab_vuelos' | 'quick_earnings' | etc.
  properties  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_app_events_name_ts
  ON app_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_device
  ON app_events (device_id, created_at DESC);

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_events       ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature requests and votes
CREATE POLICY "public read feature_requests"
  ON feature_requests FOR SELECT USING (true);

CREATE POLICY "public read feature_votes"
  ON feature_votes FOR SELECT USING (true);

-- Anyone (anon key) can insert
CREATE POLICY "anon insert feature_requests"
  ON feature_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "anon insert feature_votes"
  ON feature_votes FOR INSERT WITH CHECK (true);

CREATE POLICY "anon delete own vote"
  ON feature_votes FOR DELETE USING (true);

CREATE POLICY "anon insert app_events"
  ON app_events FOR INSERT WITH CHECK (true);

-- Aggregated analytics readable by all (admin page)
CREATE POLICY "public read app_events"
  ON app_events FOR SELECT USING (true);
