-- =====================================================
-- VeritasWeb: Scheduled Capture Support
-- =====================================================
-- Backward-compatible migration for scheduled monitor captures.

ALTER TABLE monitors
ADD COLUMN IF NOT EXISTS last_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_capture_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_capture_status TEXT,
ADD COLUMN IF NOT EXISTS last_capture_error TEXT,
ADD COLUMN IF NOT EXISTS capture_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS capture_lock_until TIMESTAMPTZ;

ALTER TABLE captures
ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_monitors_due_capture
ON monitors(next_capture_at ASC NULLS FIRST)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_monitors_capture_lock
ON monitors(capture_lock_until);

CREATE INDEX IF NOT EXISTS idx_captures_trigger_type
ON captures(trigger_type);

UPDATE monitors
SET
    next_capture_at = now(),
    capture_count = COALESCE(capture_count, 0)
WHERE status = 'active'
AND next_capture_at IS NULL;

COMMENT ON COLUMN monitors.last_captured_at IS
'Timestamp of the last completed capture attempt that produced a successful capture.';

COMMENT ON COLUMN monitors.next_capture_at IS
'Timestamp when the monitor is next due for scheduled capture.';

COMMENT ON COLUMN monitors.capture_lock_until IS
'Short-lived lock used by scheduled capture runs to avoid duplicate processing.';

COMMENT ON COLUMN captures.trigger_type IS
'Capture trigger source: manual or scheduled.';
