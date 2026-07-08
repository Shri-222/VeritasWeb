-- =====================================================
-- VeritasWeb: Final MVP Hardening
-- =====================================================
-- Safe, backward-compatible additions for the final project pass.
-- Monitors with captures are protected in application code from hard delete;
-- this script avoids adding an archived enum value so existing deployments keep
-- the active/paused status model.

CREATE INDEX IF NOT EXISTS idx_monitors_user_status
ON monitors(user_id, status);

CREATE INDEX IF NOT EXISTS idx_captures_monitor_created_at
ON captures(monitor_id, created_at DESC);

COMMENT ON TABLE monitors IS
'Owner-scoped web monitor definitions. Status active means scheduled capture may run; paused means scheduled capture is disabled.';

COMMENT ON TABLE captures IS
'Immutable evidence capture metadata. Screenshot and HTML artifacts are stored in the private captures bucket.';

COMMENT ON COLUMN captures.sha256_hash IS
'Backward-compatible manifest hash value for the capture.';

COMMENT ON COLUMN captures.previous_capture_hash IS
'Previous capture manifest/hash value for simple capture chaining when available.';
