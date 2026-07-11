-- Prevent case-name duplicates after trimming, whitespace folding, and case folding.
-- This migration does not update or delete existing case rows. If an existing
-- project contains duplicates, resolve them manually before applying this index.
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_case_name_normalized
ON cases (
  user_id,
  lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
);

