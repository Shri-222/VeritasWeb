-- Optional notification configuration. Delivery remains disabled until configured.
CREATE TABLE IF NOT EXISTS notification_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'email')),
    destination TEXT NOT NULL CHECK (char_length(destination) <= 2048),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS monitor_notification_settings (
    monitor_id UUID PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
    notify_on_change BOOLEAN NOT NULL DEFAULT true,
    notify_on_failure BOOLEAN NOT NULL DEFAULT true,
    notify_on_status_change BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_user_id ON notification_endpoints(user_id);
ALTER TABLE notification_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_notification_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY notification_endpoints_owner_policy ON notification_endpoints FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY monitor_notification_settings_owner_policy ON monitor_notification_settings FOR ALL USING (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())) WITH CHECK (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

