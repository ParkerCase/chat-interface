-- OmniDash Supabase Extension Migration
-- Adds missing tables, RBAC, and RLS policies for dashboard, chat, analytics, file permissions, and settings
-- Safe to run on top of your current schema (will not duplicate existing tables)

-- 1. User Profiles Table (RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE,
    role text NOT NULL DEFAULT 'basic', -- 'super_admin', 'admin', 'basic'
    display_name text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Themes Table (per-user and custom themes)
CREATE TABLE IF NOT EXISTS public.themes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    data jsonb NOT NULL,
    is_custom boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. System Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- 4. API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    key text UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    is_active boolean DEFAULT true
);

-- 5. File Permissions Table
CREATE TABLE IF NOT EXISTS public.file_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'basic',
    can_view boolean DEFAULT true,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_permissions_file_id ON public.file_permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_user_id ON public.file_permissions(user_id);

-- 6. Chat Threads Table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text,
    created_at timestamptz DEFAULT now()
);

-- 7. Chat History Table
CREATE TABLE IF NOT EXISTS public.chat_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    message text NOT NULL,
    role text NOT NULL, -- 'user', 'assistant', 'system'
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_history_thread_id ON public.chat_history(thread_id);

-- 8. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    data jsonb,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

-- 9. Analytics Stats Table
CREATE TABLE IF NOT EXISTS public.analytics_stats (
    id integer PRIMARY KEY DEFAULT 1,
    active_users integer DEFAULT 0,
    queries_last_hour integer DEFAULT 0,
    error_rate float DEFAULT 0,
    avg_response_time float DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- 10. Storage Stats Table
CREATE TABLE IF NOT EXISTS public.storage_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    used_bytes bigint DEFAULT 0,
    quota_bytes bigint DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 11. Backups Table
CREATE TABLE IF NOT EXISTS public.backups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    backup_type text NOT NULL,
    backup_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 12. Settings Backups Table
CREATE TABLE IF NOT EXISTS public.settings_backups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settings_id uuid REFERENCES public.settings(id) ON DELETE CASCADE,
    backup_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 13. RLS Policies for RBAC and Security
-- Profiles: Only user or super_admin can update/delete
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Super Admins can manage all profiles" ON public.profiles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- Themes: Only owner can update/delete
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their themes" ON public.themes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their themes" ON public.themes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Settings: Only super_admin can update
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins can manage settings" ON public.settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- API Keys: Only owner can manage
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their API keys" ON public.api_keys FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- File Permissions: Only owner or super_admin can manage
ALTER TABLE public.file_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their file permissions" ON public.file_permissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their file permissions" ON public.file_permissions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super Admins can manage all file permissions" ON public.file_permissions FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- Chat Threads/History: Only owner can access
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their chat threads" ON public.chat_threads FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their chat history" ON public.chat_history FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Analytics Events/Stats: Only super_admin or admin can update stats, all can insert events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can insert analytics events" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Super Admins/Admins can view all analytics events" ON public.analytics_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin')));
CREATE POLICY "Users can view their analytics events" ON public.analytics_events FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.analytics_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins/Admins can update analytics stats" ON public.analytics_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin')));

-- Storage Stats: Only owner can view
ALTER TABLE public.storage_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their storage stats" ON public.storage_stats FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their storage stats" ON public.storage_stats FOR UPDATE USING (user_id = auth.uid());

-- Backups: Only owner or super_admin can view
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their backups" ON public.backups FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super Admins can view all backups" ON public.backups FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- Settings Backups: Only super_admin can view
ALTER TABLE public.settings_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins can view settings backups" ON public.settings_backups FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- 14. Indexes for performance (already included above where needed)

-- 15. (Optional) Add stubs for key RPCs if needed (not included here, but can be added on request)

-- End of migration 