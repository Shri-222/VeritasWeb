-- =====================================================
-- VeritasWeb: Evidence Manifest Artifact
-- =====================================================
-- Stores the exact capture-time manifest JSON path so verification can hash
-- the same stable manifest bytes instead of reconstructing from DB fields.

ALTER TABLE captures
ADD COLUMN IF NOT EXISTS manifest_path TEXT;

CREATE INDEX IF NOT EXISTS idx_captures_manifest_path
ON captures(manifest_path);

COMMENT ON COLUMN captures.manifest_path IS
'Private storage object path for the exact stable evidence manifest JSON used to compute manifest_sha256.';
