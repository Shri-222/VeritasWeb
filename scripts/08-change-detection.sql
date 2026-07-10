-- Change detection records are append-only and never replace evidence artifacts.
CREATE TABLE IF NOT EXISTS capture_diffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    previous_capture_id UUID NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    current_capture_id UUID NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    changed BOOLEAN NOT NULL DEFAULT false,
    change_score NUMERIC,
    text_added_count INTEGER NOT NULL DEFAULT 0,
    text_removed_count INTEGER NOT NULL DEFAULT 0,
    text_diff JSONB,
    metadata_diff JSONB,
    visual_diff_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(previous_capture_id, current_capture_id)
);
CREATE INDEX IF NOT EXISTS idx_capture_diffs_current ON capture_diffs(current_capture_id);
CREATE INDEX IF NOT EXISTS idx_capture_diffs_monitor ON capture_diffs(monitor_id, created_at DESC);
ALTER TABLE capture_diffs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY capture_diffs_select_policy ON capture_diffs FOR SELECT USING (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY capture_diffs_insert_policy ON capture_diffs FOR INSERT WITH CHECK (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE UPDATE, DELETE ON capture_diffs FROM authenticated;

