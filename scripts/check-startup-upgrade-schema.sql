-- Read-only startup upgrade diagnostic. This file does not modify schema or data.

SELECT
  expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS exists
FROM (
  VALUES
    ('cases'),
    ('capture_diffs'),
    ('notification_endpoints'),
    ('monitor_notification_settings')
) AS expected(table_name)
ORDER BY expected.table_name;

SELECT
  expected.table_name,
  expected.column_name,
  columns.column_name IS NOT NULL AS exists,
  columns.is_nullable,
  columns.column_default
FROM (
  VALUES
    ('monitors', 'case_id'),
    ('captures', 'storage_provider'),
    ('captures', 'timestamp_provider'),
    ('captures', 'timestamp_status'),
    ('captures', 'timestamp_token_path'),
    ('captures', 'timestamp_requested_at'),
    ('captures', 'timestamp_issued_at')
) AS expected(table_name, column_name)
LEFT JOIN information_schema.columns AS columns
  ON columns.table_schema = 'public'
 AND columns.table_name = expected.table_name
 AND columns.column_name = expected.column_name
ORDER BY expected.table_name, expected.column_name;

SELECT
  classes.relname AS table_name,
  classes.relrowsecurity AS rls_enabled
FROM pg_class AS classes
JOIN pg_namespace AS namespaces
  ON namespaces.oid = classes.relnamespace
WHERE namespaces.nspname = 'public'
  AND classes.relname IN (
    'monitors',
    'captures',
    'cases',
    'capture_diffs',
    'notification_endpoints',
    'monitor_notification_settings'
  )
ORDER BY classes.relname;

SELECT
  'unique_user_monitor' AS index_name,
  to_regclass('public.unique_user_monitor') IS NOT NULL AS exists
UNION ALL
SELECT
  'unique_user_case_name_normalized' AS index_name,
  to_regclass('public.unique_user_case_name_normalized') IS NOT NULL AS exists
ORDER BY index_name;
