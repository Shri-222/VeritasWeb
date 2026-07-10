-- Provider metadata and future trusted timestamp state. No provider is enabled by this migration.
ALTER TABLE captures ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase';
ALTER TABLE captures ADD COLUMN IF NOT EXISTS timestamp_provider TEXT;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS timestamp_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (timestamp_status IN ('not_configured', 'pending', 'issued', 'failed'));
ALTER TABLE captures ADD COLUMN IF NOT EXISTS timestamp_token_path TEXT;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS timestamp_requested_at TIMESTAMPTZ;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS timestamp_issued_at TIMESTAMPTZ;

