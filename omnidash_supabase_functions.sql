-- OmniDash Supabase Functions & Missing Tables
-- Add all missing RPCs and tables referenced by the frontend

-- 1. is_admin_safe
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. check_profile_exists
CREATE OR REPLACE FUNCTION public.check_profile_exists(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = user_email
  );
$$;

-- 3. create_admin_profile
CREATE OR REPLACE FUNCTION public.create_admin_profile(user_id uuid, email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (user_id, email, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 4. update_admin_roles
CREATE OR REPLACE FUNCTION public.update_admin_roles(user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles SET role = new_role WHERE user_id = user_id;
END;
$$;

-- 5. get_user_profile
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.profiles WHERE user_id = get_user_profile.user_id;
$$;

-- 6. get_all_profiles_safe
CREATE OR REPLACE FUNCTION public.get_all_profiles_safe()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, user_id, email, role, display_name, avatar_url, created_at, updated_at FROM public.profiles;
$$;

-- 7. save_settings
CREATE OR REPLACE FUNCTION public.save_settings(key text, value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.settings (key, value, updated_at)
  VALUES (key, value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;

-- 8. match_documents (vector search stub)
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding public.vector, match_count int DEFAULT 5)
RETURNS TABLE(id text, content text, metadata jsonb, similarity float)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, content, metadata, 1 - (embedding <#> query_embedding) AS similarity
  FROM public.documents
  ORDER BY embedding <#> query_embedding
  LIMIT match_count;
$$;

-- 9. Slack functions (stubs)
CREATE OR REPLACE FUNCTION public.slack_get_unread_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 0;
$$;

CREATE OR REPLACE FUNCTION public.slack_get_channels()
RETURNS TABLE(id text, name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'general' AS id, 'General' AS name;
$$;

CREATE OR REPLACE FUNCTION public.slack_get_messages(channel_id text)
RETURNS TABLE(id text, message text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT '1', 'Welcome to the channel!', now();
$$;

CREATE OR REPLACE FUNCTION public.slack_send_message(channel_id text, message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- stub
END;
$$;

CREATE OR REPLACE FUNCTION public.slack_send_attachment(channel_id text, file_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- stub
END;
$$;

-- 10. Redis cache stubs
CREATE OR REPLACE FUNCTION public.redis_set(key text, value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- stub
END;
$$;

CREATE OR REPLACE FUNCTION public.redis_get(key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NULL::text;
$$;

CREATE OR REPLACE FUNCTION public.redis_del(key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- stub
END;
$$;

CREATE OR REPLACE FUNCTION public.redis_keys(pattern text)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NULL::text;
$$;

CREATE OR REPLACE FUNCTION public.redis_del_pattern(pattern text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- stub
END;
$$;

CREATE OR REPLACE FUNCTION public.redis_incr(key text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 1;
$$;

-- 11. Create any missing tables
CREATE TABLE IF NOT EXISTS public.file_processing_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id text,
    status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.image_embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url text,
    embedding public.vector(1536),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    file_count integer DEFAULT 0,
    used_bytes bigint DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Add RLS for new tables
ALTER TABLE public.file_processing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All users can view file processing log" ON public.file_processing_log;
CREATE POLICY "All users can view file processing log" ON public.file_processing_log FOR SELECT USING (true);
ALTER TABLE public.image_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All users can view image embeddings" ON public.image_embeddings;
CREATE POLICY "All users can view image embeddings" ON public.image_embeddings FOR SELECT USING (true);
ALTER TABLE public.storage_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their storage stats" ON public.storage_stats;
CREATE POLICY "Users can view their storage stats" ON public.storage_stats FOR SELECT USING (user_id = auth.uid());

-- End of functions and missing tables 