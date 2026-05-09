-- =====================================================
-- VeritasWeb: Forensic Web Capture Platform
-- Refined Production-Oriented Database Schema
-- =====================================================

-- -----------------------------------------------------
-- Extensions
-- -----------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------

DO $$ BEGIN
    CREATE TYPE monitor_frequency AS ENUM (
        'hourly',
        'daily',
        'weekly'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE monitor_status AS ENUM (
        'active',
        'paused'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------
-- MONITORS TABLE
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- Original user-submitted URL
    url TEXT NOT NULL,

    -- Future-proof normalized URL
    normalized_url TEXT NOT NULL,

    frequency monitor_frequency NOT NULL,

    status monitor_status NOT NULL
        DEFAULT 'active',

    -- Structured cookie storage
    session_cookies JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    -- Basic URL length protection
    CONSTRAINT monitor_url_length
        CHECK (char_length(url) <= 2048),

    CONSTRAINT normalized_url_length
        CHECK (char_length(normalized_url) <= 2048)
);

-- -----------------------------------------------------
-- CAPTURES TABLE
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS captures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    monitor_id UUID NOT NULL
        REFERENCES monitors(id)
        ON DELETE CASCADE,

    timestamp TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    storage_url TEXT NOT NULL,

    -- Fixed-length SHA256 hash
    sha256_hash CHAR(64) NOT NULL,

    -- Optional RFC 3161 TSA token
    tsa_token TEXT,

    status_code INT NOT NULL
        CHECK (
            status_code >= 100
            AND status_code <= 599
        ),

    headers JSONB NOT NULL
        DEFAULT '{}',

    -- Optional forensic chain support
    previous_capture_hash CHAR(64),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    CONSTRAINT storage_url_length
        CHECK (char_length(storage_url) <= 2048)
);

-- -----------------------------------------------------
-- INDEXES
-- -----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_monitors_user_id
ON monitors(user_id);

CREATE INDEX IF NOT EXISTS idx_monitors_normalized_url
ON monitors(normalized_url);

CREATE INDEX IF NOT EXISTS idx_captures_monitor_id
ON captures(monitor_id);

CREATE INDEX IF NOT EXISTS idx_captures_timestamp
ON captures(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_captures_hash
ON captures(sha256_hash);

-- -----------------------------------------------------
-- DUPLICATE MONITOR PROTECTION
-- -----------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_monitor
ON monitors(
    user_id,
    normalized_url,
    frequency
);

-- -----------------------------------------------------
-- ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------

ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- MONITOR RLS POLICIES
-- -----------------------------------------------------

DO $$ BEGIN

CREATE POLICY monitor_select_policy
ON monitors
FOR SELECT
USING (
    auth.uid() = user_id
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN

CREATE POLICY monitor_insert_policy
ON monitors
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN

CREATE POLICY monitor_update_policy
ON monitors
FOR UPDATE
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN

CREATE POLICY monitor_delete_policy
ON monitors
FOR DELETE
USING (
    auth.uid() = user_id
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------
-- CAPTURE RLS POLICIES
-- -----------------------------------------------------

DO $$ BEGIN

CREATE POLICY capture_select_policy
ON captures
FOR SELECT
USING (
    monitor_id IN (
        SELECT id
        FROM monitors
        WHERE user_id = auth.uid()
    )
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN

CREATE POLICY capture_insert_policy
ON captures
FOR INSERT
WITH CHECK (
    monitor_id IN (
        SELECT id
        FROM monitors
        WHERE user_id = auth.uid()
    )
);

EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------
-- FORENSIC IMMUTABILITY
-- Prevent evidence modification
-- -----------------------------------------------------

REVOKE UPDATE ON captures FROM authenticated;
REVOKE DELETE ON captures FROM authenticated;

-- -----------------------------------------------------
-- UPDATED_AT TRIGGER
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monitors_timestamp
ON monitors;

CREATE TRIGGER update_monitors_timestamp
BEFORE UPDATE ON monitors
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();