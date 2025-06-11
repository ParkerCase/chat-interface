-- 1. DROP ALL POLICIES THAT REFERENCE profiles IN A SUBQUERY
-- (Replace table and policy names as needed)

-- Themes
DROP POLICY IF EXISTS "Themes are only manageable by admins" ON themes;
-- Settings
DROP POLICY IF EXISTS "Settings are only editable by admins" ON settings;
-- API Keys
DROP POLICY IF EXISTS "API keys are only manageable by admins" ON api_keys;
-- Backups
DROP POLICY IF EXISTS "Backups are only manageable by admins" ON backups;
-- Sessions
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can manage all sessions" ON sessions;
-- File Processing Log
DROP POLICY IF EXISTS "Admins can view all file processing logs" ON file_processing_log;
-- Security Audit Logs
DROP POLICY IF EXISTS "Only admins can view audit logs" ON security_audit_logs;
DROP POLICY IF EXISTS "Only admins can read audit logs" ON security_audit_logs;
-- Users
DROP POLICY IF EXISTS "Only admins can delete users" ON users;
DROP POLICY IF EXISTS "Only admins can select sensitive data" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can read any user" ON users;
-- Storage Stats
DROP POLICY IF EXISTS "Admins can view storage stats" ON storage_stats;
-- Slack Channels
DROP POLICY IF EXISTS "Users can view non-admin channels and admins can view all" ON slack_channels;
DROP POLICY IF EXISTS "Admins can create channels" ON slack_channels;
-- Dashboard Presets
DROP POLICY IF EXISTS "Admins can view and manage all dashboard presets" ON dashboard_presets;
-- Slack Messages
DROP POLICY IF EXISTS "Users can view messages in accessible channels" ON slack_messages;
DROP POLICY IF EXISTS "Users can send messages to accessible channels" ON slack_messages;
-- Integrations
DROP POLICY IF EXISTS "Admins can view all integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
-- Integration Logs
DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_logs;
-- CRM Sync Queue
DROP POLICY IF EXISTS "Admins can manage sync queue" ON crm_sync_queue;
-- Analytics Stats
DROP POLICY IF EXISTS "Admins can view analytics stats" ON analytics_stats;
DROP POLICY IF EXISTS "Admins can update analytics stats" ON analytics_stats;

-- 2. DROP ALL FUNCTIONS THAT QUERY profiles
DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS get_storage_stats();
DROP FUNCTION IF EXISTS get_analytics_data();
DROP FUNCTION IF EXISTS slack_get_channels();
DROP FUNCTION IF EXISTS check_profile_exists();
DROP FUNCTION IF EXISTS get_user_profile();
DROP FUNCTION IF EXISTS create_admin_profile();
DROP FUNCTION IF EXISTS update_admin_roles();

-- 3. RECREATE SAFE, NON-RECURSIVE POLICIES USING JWT CLAIMS

-- THEMES TABLE
CREATE POLICY "All users can read themes"
  ON themes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage themes"
  ON themes
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- SETTINGS TABLE
CREATE POLICY "Admins can manage settings"
  ON settings
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- API KEYS TABLE
CREATE POLICY "Admins can manage api keys"
  ON api_keys
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- BACKUPS TABLE
CREATE POLICY "Admins can manage backups"
  ON backups
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- SESSIONS TABLE
CREATE POLICY "Admins can manage sessions"
  ON sessions
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- FILE PROCESSING LOG
CREATE POLICY "Admins can view file processing logs"
  ON file_processing_log
  FOR SELECT
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- SECURITY AUDIT LOGS
CREATE POLICY "Admins can view audit logs"
  ON security_audit_logs
  FOR SELECT
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- USERS TABLE
CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- STORAGE STATS
CREATE POLICY "Admins can view storage stats"
  ON storage_stats
  FOR SELECT
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- SLACK CHANNELS
CREATE POLICY "All users can read slack channels"
  ON slack_channels
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage slack channels"
  ON slack_channels
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- DASHBOARD PRESETS
CREATE POLICY "Admins can manage dashboard presets"
  ON dashboard_presets
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- SLACK MESSAGES
CREATE POLICY "All users can read slack messages"
  ON slack_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "All users can insert slack messages"
  ON slack_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- INTEGRATIONS
CREATE POLICY "Admins can manage integrations"
  ON integrations
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- INTEGRATION LOGS
CREATE POLICY "Admins can view integration logs"
  ON integration_logs
  FOR SELECT
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- CRM SYNC QUEUE
CREATE POLICY "Admins can manage sync queue"
  ON crm_sync_queue
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- ANALYTICS STATS
CREATE POLICY "Admins can manage analytics stats"
  ON analytics_stats
  FOR ALL
  USING (
    'admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
    OR
    'super_admin' = ANY (string_to_array(current_setting('jwt.claims.roles', true), ','))
  );

-- PROFILES TABLE (NO SUBQUERIES!)
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "All users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can create their own profile" ON profiles;

CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "All users can read all profiles"
  ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can create their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id); 