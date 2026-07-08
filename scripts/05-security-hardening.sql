-- =====================================================
-- VeritasWeb: Security Hardening
-- =====================================================
-- Final audit fixes for direct database bypass risks.
-- This migration is intentionally non-destructive: it does not delete
-- monitors or captures.

-- Capture rows must be created only by the server capture pipeline.
DROP POLICY IF EXISTS capture_insert_policy ON captures;
REVOKE INSERT ON captures FROM authenticated;

-- Monitor deletion must go through the server API so evidence-preserving
-- safeguards can run before a monitor is removed.
DROP POLICY IF EXISTS monitor_delete_policy ON monitors;
REVOKE DELETE ON monitors FROM authenticated;

-- Prevent monitor deletion from cascading into evidence capture deletion.
ALTER TABLE captures
DROP CONSTRAINT IF EXISTS captures_monitor_id_fkey;

ALTER TABLE captures
ADD CONSTRAINT captures_monitor_id_fkey
FOREIGN KEY (monitor_id)
REFERENCES monitors(id)
ON DELETE RESTRICT;

-- Atomic monitor success update used by the server capture service.
CREATE OR REPLACE FUNCTION increment_monitor_capture_success(
    p_monitor_id UUID,
    p_captured_at TIMESTAMPTZ,
    p_next_capture_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE monitors
    SET
        last_captured_at = p_captured_at,
        next_capture_at = p_next_capture_at,
        last_capture_status = 'success',
        last_capture_error = NULL,
        capture_count = COALESCE(capture_count, 0) + 1,
        capture_lock_until = NULL
    WHERE id = p_monitor_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_monitor_capture_success(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_monitor_capture_success(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
FROM anon;
REVOKE ALL ON FUNCTION increment_monitor_capture_success(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_monitor_capture_success(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
TO service_role;

COMMENT ON FUNCTION increment_monitor_capture_success(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Server-only helper used by the capture pipeline to atomically increment monitor capture_count.';
