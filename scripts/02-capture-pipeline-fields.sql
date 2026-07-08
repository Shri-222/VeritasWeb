-- =====================================================
-- VeritasWeb: Capture Pipeline Artifact Fields
-- =====================================================
-- Backward-compatible migration for the Phase 3 monitor-to-capture pipeline.
-- Existing columns remain:
-- - storage_url continues to point to the screenshot object path.
-- - sha256_hash now stores the deterministic evidence manifest hash.

ALTER TABLE captures
ADD COLUMN IF NOT EXISTS screenshot_path TEXT,
ADD COLUMN IF NOT EXISTS html_path TEXT,
ADD COLUMN IF NOT EXISTS screenshot_sha256 TEXT,
ADD COLUMN IF NOT EXISTS html_sha256 TEXT,
ADD COLUMN IF NOT EXISTS manifest_sha256 TEXT,
ADD COLUMN IF NOT EXISTS original_url TEXT,
ADD COLUMN IF NOT EXISTS final_url TEXT,
ADD COLUMN IF NOT EXISTS page_title TEXT,
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS capture_status TEXT NOT NULL DEFAULT 'success',
ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_captures_captured_at
ON captures(captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_captures_manifest_sha256
ON captures(manifest_sha256);

COMMENT ON COLUMN captures.sha256_hash IS
'Backward-compatible evidence hash field. For Phase 3 captures this stores manifest_sha256.';

COMMENT ON COLUMN captures.storage_url IS
'Backward-compatible screenshot object path field. For Phase 3 captures this stores screenshot_path.';

COMMENT ON COLUMN captures.manifest_sha256 IS
'SHA-256 hash of the deterministic evidence manifest.';

COMMENT ON COLUMN captures.screenshot_sha256 IS
'SHA-256 hash of the captured screenshot bytes.';

COMMENT ON COLUMN captures.html_sha256 IS
'SHA-256 hash of the captured raw HTML string.';
