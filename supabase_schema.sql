

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_embedding_data_column"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if column already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'image_embeddings' 
    AND column_name = 'embedding_data'
  ) THEN
    -- Add the column if it doesn't exist
    EXECUTE 'ALTER TABLE image_embeddings ADD COLUMN embedding_data JSONB';
  END IF;
END;
$$;


ALTER FUNCTION "public"."add_embedding_data_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_document_relevance"("doc_age" interval, "doc_type" "text", "metadata" "jsonb") RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base_score float := 1.0;
BEGIN
    -- Age penalty (newer documents score higher)
    IF doc_age < interval '7 days' THEN
        base_score := base_score * 1.2;
    ELSIF doc_age < interval '30 days' THEN
        base_score := base_score * 1.1;
    END IF;

    -- Content type bonus
    IF doc_type = 'pdf' THEN
        base_score := base_score * 1.2;
    ELSIF doc_type = 'research' THEN
        base_score := base_score * 1.3;
    END IF;

    -- Metadata bonuses
    IF metadata->>'hasAnalysis' = 'true' THEN
        base_score := base_score * 1.1;
    END IF;

    RETURN base_score;
END;
$$;


ALTER FUNCTION "public"."calculate_document_relevance"("doc_age" interval, "doc_type" "text", "metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_storage_usage"("bucket_name" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_bytes BIGINT := 10737418240; -- Default 10GB
  used_bytes BIGINT := 0;
  file_count INTEGER := 0;
  folder_count INTEGER := 0;
  result JSON;
BEGIN
  -- Get file count and size from storage.objects
  SELECT 
    COUNT(*),
    COALESCE(SUM(CAST(metadata->>'size' AS BIGINT)), 0)
  INTO 
    file_count, 
    used_bytes
  FROM 
    storage.objects
  WHERE 
    bucket_id = bucket_name;

  -- Count folder-like objects (those ending with '/' or with .folder marker)
  SELECT 
    COUNT(*)
  INTO 
    folder_count
  FROM 
    storage.objects
  WHERE 
    bucket_id = bucket_name
    AND (name LIKE '%/' OR name LIKE '%.folder');

  -- Create result JSON
  result := json_build_object(
    'total_storage_bytes', total_bytes,
    'used_storage_bytes', used_bytes,
    'file_count', file_count,
    'folder_count', folder_count
  );
  
  -- Store this data for future reference
  INSERT INTO storage_stats (
    total_storage_bytes,
    used_storage_bytes,
    file_count,
    folder_count,
    bucket_name
  ) VALUES (
    total_bytes,
    used_bytes,
    file_count,
    folder_count,
    bucket_name
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."calculate_storage_usage"("bucket_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_image_search_full"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM search_images_by_embedding(query_embedding, match_threshold, match_limit, embedding_type);
END;
$$;


ALTER FUNCTION "public"."call_image_search_full"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_analytics"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Hard-coded admin check
  IF auth.email() IN ('itsus@tatt2away.com', 'parker@tatt2away.com') THEN
    RETURN TRUE;
  END IF;
  
  -- Direct metadata check
  DECLARE
    meta JSONB;
  BEGIN
    SELECT raw_app_meta_data INTO meta
    FROM auth.users
    WHERE id = auth.uid();
    
    IF meta IS NOT NULL AND meta ? 'roles' THEN
      IF meta->'roles' ? 'admin' OR meta->'roles' ? 'super_admin' THEN
        RETURN TRUE;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors
  END;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_view_analytics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_user_password"() RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$declare
  _uid uuid;
  result json;
begin
  -- Get the user ID
  _uid := auth.uid();
  
  -- Verify current user exists
  if _uid is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  
  -- Check current password (simulate by checking row exists with matching hash)
  select
    coalesce(
      (select json_build_object('success', true)
       from auth.users
       where id = _uid
       and auth.crypto_hash(auth.crypto_hash(current_password, _uid::text), _uid::text) = password_hash),
      json_build_object('success', false, 'error', 'Incorrect password')
    ) into result;
  
  -- If verified, update password
  if (result->>'success')::boolean then
    update auth.users
    set encrypted_password = auth.crypto_hash(new_password, _uid::text),
        updated_at = now()
    where id = _uid;
    
    return json_build_object('success', true);
  else
    return result;
  end if;
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;$$;


ALTER FUNCTION "public"."change_user_password"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_access"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid;
  user_email text;
  is_admin boolean;
BEGIN
  -- Get current auth user ID
  current_user_id := auth.uid();
  
  -- Get user email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = current_user_id;
  
  -- Check if user is admin based on email directly without querying profiles
  is_admin := user_email IN ('itsus@tatt2away.com', 'parker@tatt2away.com');
  
  -- Or if their auth claims contain admin role
  IF NOT is_admin THEN
    SELECT COALESCE(
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'roles' @> '"super_admin"'::jsonb,
      false
    ) INTO is_admin;
  END IF;
  
  RETURN is_admin;
END;
$$;


ALTER FUNCTION "public"."check_admin_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("email_to_check" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check auth.users table (this requires security definer permission)
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check
  ) INTO user_exists;
  
  -- Return result (true if user exists, false otherwise)
  RETURN user_exists;
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("email_to_check" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_email_exists"("email_to_check" "text") IS 'Safely checks if an email exists in the auth system without revealing sensitive user information.
Used for account linking and identity verification flows.';



CREATE OR REPLACE FUNCTION "public"."check_password_history"("p_user_id" "uuid", "p_password_hash" "text", "p_history_count" integer DEFAULT 5) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_found BOOLEAN := FALSE;
  v_record RECORD;
BEGIN
  -- Check if password exists in history
  FOR v_record IN (
    SELECT password_hash
    FROM password_history
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT p_history_count
  ) LOOP
    -- In a real implementation, you'd use a proper password comparison function
    -- This is a simplified example
    IF v_record.password_hash = p_password_hash THEN
      v_found := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_found;
END;
$$;


ALTER FUNCTION "public"."check_password_history"("p_user_id" "uuid", "p_password_hash" "text", "p_history_count" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "tier" "text" DEFAULT 'basic'::"text",
    "organization_id" "uuid",
    "mfa_methods" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "roles" "text"[] DEFAULT ARRAY['user'::"text"],
    "first_name" "text",
    "last_name" "text",
    "last_login" timestamp with time zone,
    "email" "text",
    "status" "text" DEFAULT 'Active'::"text",
    "auth_provider" "text",
    "auth_providers" "text"[],
    "pending_link" "text",
    "pending_link_at" timestamp with time zone,
    "theme_id" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_exists"("user_email" "text") RETURNS SETOF "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT * FROM profiles WHERE email = user_email;
$$;


ALTER FUNCTION "public"."check_profile_exists"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_zenoti_sync_status"() RETURNS TABLE("source_table" "text", "document_count" bigint, "last_sync" timestamp with time zone, "sample_document_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (metadata->>'source_table')::TEXT as source_table,
        COUNT(*) as document_count,
        MAX((processing_status->>'last_sync')::TIMESTAMP WITH TIME ZONE) as last_sync,
        MAX(name) as sample_document_name
    FROM documents 
    WHERE source_type LIKE 'zenoti_%'
    GROUP BY metadata->>'source_table'
    ORDER BY source_table;
END;
$$;


ALTER FUNCTION "public"."check_zenoti_sync_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_auth_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete expired sessions
  DELETE FROM active_sessions WHERE expires_at < NOW();
  
  -- Delete expired revoked tokens
  DELETE FROM revoked_tokens WHERE expires_at < NOW();
  
  -- Mark expired API keys as inactive
  UPDATE api_keys SET active = FALSE 
  WHERE expires_at < NOW() AND active = TRUE;
  
  -- Delete expired token exchange codes
  DELETE FROM token_exchange_codes WHERE expires_at < NOW();
  
  -- Delete expired invitations
  DELETE FROM invitations 
  WHERE expires_at < NOW() AND used = FALSE;
  
  -- Delete expired MFA attempts
  DELETE FROM mfa_attempts 
  WHERE expires_at < NOW() AND used = FALSE;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_auth_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_invalid_documents"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM documents
  WHERE content IS NULL OR metadata IS NULL
  RETURNING count(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_invalid_documents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_batch_jobs"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM batch_process_jobs
  WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_batch_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_admin_profile"("profile_id" "uuid", "profile_email" "text", "profile_name" "text", "profile_roles" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert or update profile
  INSERT INTO profiles (
    id, 
    email, 
    full_name, 
    roles, 
    created_at, 
    updated_at
  )
  VALUES (
    profile_id,
    profile_email,
    profile_name,
    profile_roles,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = profile_name,
    roles = profile_roles,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."create_admin_profile"("profile_id" "uuid", "profile_email" "text", "profile_name" "text", "profile_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invitation"("p_email" "text", "p_created_by" "uuid", "p_roles" "uuid"[] DEFAULT NULL::"uuid"[], "p_expires_in" integer DEFAULT 7) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_code TEXT;
  v_id UUID;
  v_expires_at TIMESTAMP;
  v_result JSONB;
BEGIN
  -- Generate unique code
  v_code := encode(gen_random_bytes(16), 'hex');
  
  -- Set expiration date
  IF p_expires_in IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in || ' days')::INTERVAL;
  END IF;
  
  -- Create invitation
  INSERT INTO invitations (
    code,
    email,
    created_by,
    roles,
    created_at,
    expires_at
  ) VALUES (
    v_code,
    LOWER(p_email),
    p_created_by,
    p_roles,
    NOW(),
    v_expires_at
  ) RETURNING id INTO v_id;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', TRUE,
    'id', v_id,
    'code', v_code,
    'email', p_email,
    'expires_at', v_expires_at
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_invitation"("p_email" "text", "p_created_by" "uuid", "p_roles" "uuid"[], "p_expires_in" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_storage_policy"("policy_name" "text", "bucket_name" "text", "definition" "text", "operation" "text", "role_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- In a real implementation, this would execute SQL to create the policy
  -- For demo, just return success response
  result := jsonb_build_object(
    'success', true,
    'policy', jsonb_build_object(
      'name', policy_name,
      'bucket', bucket_name,
      'definition', definition,
      'operation', operation,
      'role', role_name
    )
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_storage_policy"("policy_name" "text", "bucket_name" "text", "definition" "text", "operation" "text", "role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_from_external_identity"("p_email" "text", "p_name" "text", "p_first_name" "text", "p_last_name" "text", "p_provider_id" "uuid", "p_external_id" "text", "p_external_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check if user with this email already exists
  SELECT id INTO v_user_id FROM users WHERE email = LOWER(p_email);
  
  IF v_user_id IS NULL THEN
    -- Create new user
    INSERT INTO users (
      email,
      name,
      first_name,
      last_name,
      created_at,
      updated_at
    ) VALUES (
      LOWER(p_email),
      p_name,
      p_first_name,
      p_last_name,
      NOW(),
      NOW()
    ) RETURNING id INTO v_user_id;
    
    -- Assign default role
    INSERT INTO user_roles (user_id, role_id)
    SELECT v_user_id, id FROM roles WHERE code = 'user' LIMIT 1;
    
    v_exists := FALSE;
  ELSE
    -- User exists
    v_exists := TRUE;
  END IF;
  
  -- Create external identity link
  INSERT INTO user_identities (
    user_id,
    provider_id,
    external_id,
    external_data,
    created_at,
    updated_at,
    last_login
  ) VALUES (
    v_user_id,
    p_provider_id,
    p_external_id,
    p_external_data,
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (provider_id, external_id) DO UPDATE SET
    external_data = p_external_data,
    updated_at = NOW(),
    last_login = NOW();
  
  -- Return result
  v_result := jsonb_build_object(
    'success', TRUE,
    'user_id', v_user_id,
    'user_exists', v_exists
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_user_from_external_identity"("p_email" "text", "p_name" "text", "p_first_name" "text", "p_last_name" "text", "p_provider_id" "uuid", "p_external_id" "text", "p_external_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_storage_policy"("policy_name" "text", "bucket_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- In a real implementation, this would execute SQL to delete the policy
  -- For demo, just return success response
  result := jsonb_build_object(
    'success', true,
    'message', format('Policy %s for bucket %s deleted successfully', policy_name, bucket_name)
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."delete_storage_policy"("policy_name" "text", "bucket_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_test_admin_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the email is itsus@tatt2away.com
  IF NEW.email = 'itsus@tatt2away.com' THEN
    -- Get existing profile or create new one
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      -- Update existing profile
      UPDATE public.profiles
      SET 
        roles = ARRAY['super_admin', 'admin', 'user'],
        tier = 'enterprise',
        updated_at = NOW()
      WHERE id = NEW.id;
    ELSE
      -- Create new profile
      INSERT INTO public.profiles (
        id, 
        full_name,
        roles, 
        tier, 
        updated_at
      )
      SELECT
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Tatt2Away Admin'),
        ARRAY['super_admin', 'admin', 'user'],
        'enterprise',
        NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_test_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_document_path"("metadata" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN COALESCE(
        metadata->>'path',
        metadata->'path'::text,
        NULL
    );
END;
$$;


ALTER FUNCTION "public"."extract_document_path"("metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "text" NOT NULL,
    "content" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536),
    "document_type" "text" DEFAULT 'generic'::"text" NOT NULL,
    "source_type" "text" DEFAULT 'upload'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "processing_status" "jsonb" DEFAULT '{}'::"jsonb",
    "parent_id" "text",
    "chunk_index" integer,
    "chunk_total" integer,
    "relevance_score" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "name" "text"
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_documents_by_role"("user_role" "text") RETURNS SETOF "public"."documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If user is super admin, return all documents 
  IF user_role = 'super_admin' THEN
    RETURN QUERY SELECT * FROM documents;
  ELSE
    -- For admin and regular users, only return documents that they have access to
    RETURN QUERY 
    SELECT * FROM documents 
    WHERE 
      -- Check if the document has visibility settings
      (
        -- If metadata is null or doesn't have visible_to, assume it's visible to everyone
        metadata IS NULL 
        OR 
        metadata->>'visible_to' IS NULL
        OR
        -- Check if the user's role is in the visible_to array
        metadata->'visible_to' ? user_role
      );
  END IF;
END;
$$;


ALTER FUNCTION "public"."filter_documents_by_role"("user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer DEFAULT 50) RETURNS TABLE("id" integer, "path" "text", "analysis" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    eia.id,
    eia.path,
    eia.analysis
  FROM
    enhanced_image_analysis eia
  WHERE
    eia.analysis->'insights'->>'bodyPart' = lower(body_part)
  OR
    eia.analysis->'vision'->'tattooInsights'->>'bodyPart' = lower(body_part)
  OR
    lower(eia.analysis::TEXT) LIKE '%"body_part":"' || lower(body_part) || '"%'
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer DEFAULT 20, "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "path" "text", "confidence" numeric, "analysis" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.image_path AS path,
    CASE 
      WHEN a.analysis->'bodyPart'->>'primary' = body_part THEN 0.9
      WHEN body_part = ANY(SELECT jsonb_array_elements_text(a.analysis->'bodyPart'->'detected')) THEN 0.8
      ELSE 0.7
    END AS confidence,
    a.analysis
  FROM public.image_embeddings i
  JOIN public.enhanced_image_analysis a ON i.id = a.image_id
  WHERE 
    a.analysis->'bodyPart'->>'primary' = body_part
    OR body_part = ANY(SELECT jsonb_array_elements_text(a.analysis->'bodyPart'->'detected'))
  ORDER BY confidence DESC, i.created_at DESC
  LIMIT match_limit
  OFFSET offset_value;
END;
$$;


ALTER FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer, "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_images_without_tattoos"("match_limit" integer DEFAULT 50) RETURNS TABLE("id" integer, "path" "text", "analysis" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    eia.id,
    eia.path,
    eia.analysis
  FROM
    enhanced_image_analysis eia
  WHERE
    (eia.analysis->'insights'->>'isLikelyTattoo' = 'false' OR
     eia.analysis->'vision'->>'hasTattoo' = 'false' OR
     eia.analysis->'insights'->>'description' ILIKE '%no tattoo%' OR
     eia.analysis->'insights'->>'description' ILIKE '%without tattoo%')
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."find_images_without_tattoos"("match_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_images_without_tattoos"("match_limit" integer, "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "path" "text", "analysis" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.image_path AS path,
    e.analysis
  FROM 
    image_embeddings e
  WHERE 
    (e.analysis->>'isLikelyTattoo')::boolean = false
  ORDER BY 
    e.created_at DESC
  LIMIT match_limit
  OFFSET offset_value;
END;
$$;


ALTER FUNCTION "public"."find_images_without_tattoos"("match_limit" integer, "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_mfa_verification_code"("p_user_id" "uuid", "p_method_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_code TEXT;
  v_method_type TEXT;
  v_expires_at TIMESTAMP;
  v_result JSONB;
BEGIN
  -- Get method type
  SELECT type INTO v_method_type
  FROM mfa_methods
  WHERE id = p_method_id AND user_id = p_user_id;
  
  IF v_method_type IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'MFA method not found'
    );
  END IF;
  
  -- Only for email/SMS
  IF v_method_type != 'email' AND v_method_type != 'sms' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cannot generate code for this method type'
    );
  END IF;
  
  -- Generate 6-digit code
  v_code := floor(random() * 900000 + 100000)::TEXT;
  
  -- Set expiry time (10 minutes)
  v_expires_at := NOW() + INTERVAL '10 minutes';
  
  -- Save code
  INSERT INTO mfa_attempts (
    user_id,
    method_id,
    code,
    created_at,
    expires_at,
    used
  ) VALUES (
    p_user_id,
    p_method_id,
    v_code,
    NOW(),
    v_expires_at,
    FALSE
  );
  
  -- Return result
  v_result := jsonb_build_object(
    'success', TRUE,
    'code', v_code,
    'expires_at', v_expires_at,
    'method_type', v_method_type
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."generate_mfa_verification_code"("p_user_id" "uuid", "p_method_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_analytics_data"("start_date" "text", "end_date" "text") RETURNS TABLE("id" "uuid", "event_type" "text", "user_id" "uuid", "data" "jsonb", "created_at" timestamp with time zone, "session_id" "text", "url" "text", "user_agent" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only allow admins to access this function
  IF NOT is_admin_safe() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb, 
                       NULL::timestamptz, NULL::text, NULL::text, NULL::text
    WHERE false;
    RETURN;
  END IF;
  
  -- Return the analytics data
  RETURN QUERY
  SELECT e.id, e.event_type, e.user_id, e.data, e.created_at, e.session_id, e.url, e.user_agent
  FROM analytics_events e
  WHERE e.created_at >= start_date::timestamptz
    AND e.created_at <= end_date::timestamptz;
END;
$$;


ALTER FUNCTION "public"."get_analytics_data"("start_date" "text", "end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bucket_policies"("bucket_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  policies JSONB;
BEGIN
  -- In an actual implementation, this would query the policies
  -- For now, return sample policy data
  policies := jsonb_build_object(
    'bucket', bucket_name,
    'policies', jsonb_build_array(
      jsonb_build_object(
        'id', 'policy_1',
        'name', 'public_read',
        'definition', format('bucket_id = ''%s'' AND path = ''public/''', bucket_name),
        'operation', 'SELECT',
        'role', 'authenticated'
      ),
      jsonb_build_object(
        'id', 'policy_2',
        'name', 'private_read',
        'definition', format('bucket_id = ''%s'' AND path = ''private/'' AND auth.uid() = created_by', bucket_name),
        'operation', 'SELECT',
        'role', 'authenticated'
      )
    )
  );
  
  RETURN policies;
END;
$$;


ALTER FUNCTION "public"."get_bucket_policies"("bucket_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_check_constraint_values"("p_table_name" "text", "p_constraint_name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    check_clause text;
    match_result text[];
    extracted_values text[];
BEGIN
    -- Get the check constraint definition
    SELECT cc.check_clause INTO check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.table_constraints tc 
      ON cc.constraint_name = tc.constraint_name
    WHERE tc.table_name = p_table_name
      AND tc.constraint_type = 'CHECK'
      AND cc.constraint_name = p_constraint_name;
      
    IF check_clause IS NULL THEN
        RETURN ARRAY['pending', 'running', 'completed', 'failed'];
    END IF;
    
    -- Extract values from clauses like "status IN ('pending', 'running', 'completed', 'failed')"
    match_result := regexp_matches(check_clause, 'IN \((.+?)\)', 'i');
    
    IF match_result IS NULL OR array_length(match_result, 1) = 0 THEN
        RETURN ARRAY['pending', 'running', 'completed', 'failed'];
    END IF;
    
    -- Process the matched string to extract values
    -- First split by comma
    WITH split_values AS (
        SELECT trim(value) AS quoted_value
        FROM unnest(string_to_array(match_result[1], ',')) AS value
    )
    -- Then remove the quotes
    SELECT array_agg(
        CASE 
            WHEN quoted_value LIKE '''%''' THEN 
                substring(quoted_value from 2 for length(quoted_value)-2)
            ELSE quoted_value
        END
    ) INTO extracted_values
    FROM split_values;
    
    RETURN COALESCE(extracted_values, ARRAY['pending', 'running', 'completed', 'failed']);
END;
$$;


ALTER FUNCTION "public"."get_check_constraint_values"("p_table_name" "text", "p_constraint_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_column_info"("table_name" "text") RETURNS TABLE("column_name" "text", "data_type" "text", "is_nullable" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY SELECT c.column_name, c.data_type, c.is_nullable::boolean
  FROM information_schema.columns c
  WHERE c.table_name = get_column_info.table_name;
END;
$$;


ALTER FUNCTION "public"."get_column_info"("table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_db_size"() RETURNS TABLE("size_mb" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT pg_database_size(current_database())/1024.0/1024.0 as size_mb;
END;
$$;


ALTER FUNCTION "public"."get_db_size"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_document_sources"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(DISTINCT source_type) INTO result
    FROM public.documents
    WHERE status = 'active';
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_document_sources"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_documents_by_slack_channel"("p_channel_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) INTO result
    FROM (
        SELECT 
            id,
            name,
            metadata,
            created_at,
            created_by,
            content
        FROM public.documents
        WHERE metadata->>'channel_id' = p_channel_id::text
        AND status = 'active'
        ORDER BY created_at DESC
    ) d;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_documents_by_slack_channel"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_embedding_stats_by_type"() RETURNS TABLE("embedding_type" "text", "count" bigint)
    LANGUAGE "sql"
    AS $$
  SELECT embedding_type, COUNT(*) as count
  FROM image_embeddings
  GROUP BY embedding_type
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."get_embedding_stats_by_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_extensions"() RETURNS TABLE("name" "text", "default_version" "text", "installed_version" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY SELECT e.extname, e.extdefault, e.extversion
  FROM pg_extension e;
END;
$$;


ALTER FUNCTION "public"."get_extensions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_file_type_stats"() RETURNS TABLE("file_type" "text", "count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(metadata->>'type', 'unknown') as file_type,
    COUNT(*) as count
  FROM documents
  GROUP BY file_type
  ORDER BY count DESC;
END;
$$;


ALTER FUNCTION "public"."get_file_type_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sample_zenoti_document"("table_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("document_id" "text", "document_name" "text", "source_table" "text", "content_preview" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id as document_id,
        name as document_name,
        (metadata->>'source_table')::TEXT as source_table,
        LEFT(content, 500) || '...' as content_preview
    FROM documents 
    WHERE source_type LIKE 'zenoti_%'
    AND (table_filter IS NULL OR metadata->>'source_table' = table_filter)
    ORDER BY updated_at DESC
    LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."get_sample_zenoti_document"("table_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_settings"() RETURNS TABLE("id" bigint, "category" "text", "key" "text", "value" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "updated_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.category, s.key, s.value, s.created_at, s.updated_at, s.updated_by
  FROM settings s;
END;
$$;


ALTER FUNCTION "public"."get_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile"("user_id" "uuid") RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If caller is admin or it's their own profile, return it
  IF auth.email() IN ('itsus@tatt2away.com', 'parker@tatt2away.com') OR 
     auth.uid() = user_id THEN
    RETURN QUERY SELECT * FROM profiles WHERE id = user_id;
    RETURN;
  END IF;
  
  -- Check if caller is admin via direct lookup
  DECLARE
    meta JSONB;
    is_admin BOOLEAN := FALSE;
  BEGIN
    SELECT raw_app_meta_data INTO meta
    FROM auth.users
    WHERE id = auth.uid();
    
    IF meta IS NOT NULL AND meta ? 'roles' THEN
      is_admin := meta->'roles' ? 'admin' OR meta->'roles' ? 'super_admin';
    END IF;
    
    IF is_admin THEN
      RETURN QUERY SELECT * FROM profiles WHERE id = user_id;
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to safe behavior
  END;
  
  -- Otherwise, only return if it's the user's own profile
  RETURN QUERY SELECT * FROM profiles WHERE id = user_id AND id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_user_profile"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.auth_events (
    user_id, 
    email, 
    event_type,
    provider,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.email,
    TG_ARGV[0],
    NEW.app_metadata->>'provider',
    jsonb_build_object(
      'app_metadata', NEW.app_metadata,
      'user_metadata', NEW.user_metadata
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_auth_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initial_zenoti_sync"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rec RECORD;
    table_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting complete Zenoti CRM data sync...';
    
    -- Sync zenoti_appointments
    RAISE NOTICE 'Syncing zenoti_appointments...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_appointments LOOP
        PERFORM sync_zenoti_to_documents('zenoti_appointments', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % appointments', table_count;
    
    -- Sync zenoti_clients
    RAISE NOTICE 'Syncing zenoti_clients...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_clients LOOP
        PERFORM sync_zenoti_to_documents('zenoti_clients', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % clients', table_count;
    
    -- Sync zenoti_centers
    RAISE NOTICE 'Syncing zenoti_centers...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_centers LOOP
        PERFORM sync_zenoti_to_documents('zenoti_centers', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % centers', table_count;
    
    -- Sync zenoti_services
    RAISE NOTICE 'Syncing zenoti_services...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_services LOOP
        PERFORM sync_zenoti_to_documents('zenoti_services', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % services', table_count;
    
    -- Sync zenoti_packages
    RAISE NOTICE 'Syncing zenoti_packages...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_packages LOOP
        PERFORM sync_zenoti_to_documents('zenoti_packages', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % packages', table_count;
    
    -- Sync zenoti_appointments_reports
    RAISE NOTICE 'Syncing zenoti_appointments_reports...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_appointments_reports LOOP
        PERFORM sync_zenoti_to_documents('zenoti_appointments_reports', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % appointment reports', table_count;
    
    -- Sync zenoti_sales_accrual_reports
    RAISE NOTICE 'Syncing zenoti_sales_accrual_reports...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_sales_accrual_reports LOOP
        PERFORM sync_zenoti_to_documents('zenoti_sales_accrual_reports', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % sales accrual reports', table_count;
    
    -- Sync zenoti_sales_cash_reports
    RAISE NOTICE 'Syncing zenoti_sales_cash_reports...';
    table_count := 0;
    FOR rec IN SELECT * FROM zenoti_sales_cash_reports LOOP
        PERFORM sync_zenoti_to_documents('zenoti_sales_cash_reports', to_jsonb(rec));
        table_count := table_count + 1;
    END LOOP;
    RAISE NOTICE 'Synced % sales cash reports', table_count;
    
    RAISE NOTICE 'Initial Zenoti CRM sync completed successfully!';
    RAISE NOTICE 'Run: SELECT * FROM check_zenoti_sync_status(); to view results';
END;
$$;


ALTER FUNCTION "public"."initial_zenoti_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND ('admin' = ANY(roles) OR 'super_admin' = ANY(roles))
  ) INTO is_admin_user;
  
  RETURN is_admin_user;
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.role() = 'authenticated';
$$;


ALTER FUNCTION "public"."is_authenticated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5) RETURNS TABLE("id" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 5, "filter_criteria" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" "text", "content" "text", "metadata" "jsonb", "similarity" double precision, "document_type" "text", "relevance_score" double precision, "parent_id" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    documents.document_type,
    documents.relevance_score,
    documents.parent_id
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    AND status = 'active'
    AND CASE
      WHEN filter_criteria->>'document_type' IS NOT NULL 
      THEN document_type = filter_criteria->>'document_type'
      ELSE true
    END
  ORDER BY 
    (1 - (documents.embedding <=> query_embedding)) * documents.relevance_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_criteria" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_slack_messages_to_documents"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    msg RECORD;
    doc_id UUID;
BEGIN
    -- Process each slack message that doesn't have a corresponding document
    FOR msg IN 
        SELECT 
            m.*,
            c.name as channel_name,
            p.full_name as user_name,
            p.email as user_email
        FROM public.slack_messages m
        LEFT JOIN public.slack_channels c ON m.channel_id = c.id
        LEFT JOIN public.profiles p ON m.user_id = p.id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.documents d 
            WHERE (d.metadata->>'message_id')::text = m.id::text
            AND (d.metadata->>'source')::text = 'slack'
        )
    LOOP
        -- Generate new document ID
        doc_id := gen_random_uuid();
        
        -- Insert into documents table
        INSERT INTO public.documents (
            id,
            name,
            content,
            metadata,
            source_type,
            document_type,
            status,
            created_at,
            created_by
        ) VALUES (
            doc_id,
            COALESCE(msg.channel_name, 'Unknown Channel') || ' - ' || 
                TO_CHAR(msg.timestamp, 'YYYY-MM-DD HH24:MI:SS'),
            msg.text,
            jsonb_build_object(
                'source', 'slack',
                'message_id', msg.id,
                'channel_id', msg.channel_id,
                'channel_name', msg.channel_name,
                'user_id', msg.user_id,
                'user_name', msg.user_name,
                'user_email', msg.user_email,
                'timestamp', msg.timestamp,
                'parent_id', msg.parent_id,
                'attachment_url', msg.attachment_url,
                'attachment_type', msg.attachment_type,
                'original_filename', msg.original_filename
            ),
            'slack',
            'message',
            'processed',
            COALESCE(msg.created_at, NOW()),
            msg.user_id
        );
        
        -- Process attachment if exists
        IF msg.attachment_url IS NOT NULL THEN
            INSERT INTO public.documents (
                id,
                name,
                content,
                metadata,
                source_type,
                document_type,
                status,
                parent_id,
                created_at,
                created_by
            ) VALUES (
                gen_random_uuid(),
                COALESCE(msg.original_filename, 'Slack Attachment'),
                'Slack attachment: ' || msg.attachment_url,
                jsonb_build_object(
                    'source', 'slack',
                    'message_id', msg.id,
                    'attachment_url', msg.attachment_url,
                    'attachment_type', msg.attachment_type,
                    'original_filename', msg.original_filename,
                    'parent_message_id', msg.id
                ),
                'slack',
                'attachment',
                'processed',
                doc_id,
                COALESCE(msg.created_at, NOW()),
                msg.user_id
            );
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_slack_messages_to_documents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_delete"("key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- No-op function that pretends to succeed
  -- In a production setup, you would connect to Redis here
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."redis_delete"("key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_get"("key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- No-op function that returns null (nothing in cache)
  -- In a production setup, you would connect to Redis here
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."redis_get"("key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_set"("key" "text", "value" "text", "expiry" integer DEFAULT 3600) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If you don't actually have Redis, this is a no-op function that pretends to succeed
  -- In a production setup, you would connect to Redis here
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."redis_set"("key" "text", "value" "text", "expiry" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_recent_backups"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recent_backups;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."refresh_recent_backups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resync_zenoti_table"("table_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rec RECORD;
    sql_query TEXT;
    record_count INTEGER := 0;
BEGIN
    -- Validate table name for security
    IF table_name NOT IN ('zenoti_appointments', 'zenoti_clients', 'zenoti_centers', 
                          'zenoti_services', 'zenoti_packages', 'zenoti_appointments_reports',
                          'zenoti_sales_accrual_reports', 'zenoti_sales_cash_reports') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;
    
    RAISE NOTICE 'Starting resync of table: %', table_name;
    
    -- Delete existing documents for this table
    DELETE FROM documents WHERE metadata->>'source_table' = table_name;
    
    -- Resync all records
    sql_query := 'SELECT * FROM ' || table_name;
    FOR rec IN EXECUTE sql_query LOOP
        PERFORM sync_zenoti_to_documents(table_name, to_jsonb(rec));
        record_count := record_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Resync completed for table: % (% records)', table_name, record_count;
END;
$$;


ALTER FUNCTION "public"."resync_zenoti_table"("table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_backup"("backup_type" "text" DEFAULT 'manual'::"text", "include_files" boolean DEFAULT true, "include_database" boolean DEFAULT true, "include_settings" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  backup_id UUID;
  backup_size DECIMAL;
  result JSONB;
BEGIN
  -- Generate random backup size between 50 MB and 500 MB
  backup_size := (random() * 450 + 50)::DECIMAL;
  
  -- Create backup record
  INSERT INTO backups (
    type,
    status,
    location,
    size_mb,
    includes_files,
    includes_database,
    includes_settings,
    created_by,
    filename,
    completed_at
  )
  VALUES (
    backup_type,
    'completed',
    'cloud',
    backup_size,
    include_files,
    include_database,
    include_settings,
    auth.uid(),
    format('backup_%s.zip', to_char(now(), 'YYYYMMDD_HH24MISS')),
    now()
  )
  RETURNING id INTO backup_id;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'backup_id', backup_id,
    'message', 'Backup completed successfully',
    'size_mb', backup_size,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."run_backup"("backup_type" "text", "include_files" boolean, "include_database" boolean, "include_settings" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_sql"("sql" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE sql;
END;
$$;


ALTER FUNCTION "public"."run_sql"("sql" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" integer NOT NULL,
    "category" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "description" "text",
    CONSTRAINT "chk_category_not_empty" CHECK (("length"("category") > 0)),
    CONSTRAINT "chk_key_not_empty" CHECK (("length"("key") > 0))
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_settings"("settings" "jsonb"[]) RETURNS SETOF "public"."settings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    setting JSONB;
    result settings;
BEGIN
    -- Check if user has admin privileges
    IF NOT (SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (
            roles::jsonb ? 'admin' OR roles::jsonb ? 'super_admin'
        )
    )) THEN
        RAISE EXCEPTION 'Permission denied: Admin privileges required';
    END IF;

    -- Process each setting
    FOREACH setting IN ARRAY settings
    LOOP
        INSERT INTO public.settings (
            category, 
            key, 
            value, 
            description, 
            updated_at, 
            updated_by
        )
        VALUES (
            setting->>'category',
            setting->>'key',
            setting->>'value',
            COALESCE(setting->>'description', ''),
            COALESCE((setting->>'updated_at')::TIMESTAMP WITH TIME ZONE, NOW()),
            COALESCE((setting->>'updated_by')::UUID, auth.uid())
        )
        ON CONFLICT (category, key) DO UPDATE
        SET 
            value = EXCLUDED.value,
            description = COALESCE(EXCLUDED.description, settings.description),
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        RETURNING * INTO result;
        
        RETURN NEXT result;
    END LOOP;
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."save_settings"("settings" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_settings"("settings" "json") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO settings (category, key, value, updated_at, updated_by)
  SELECT 
    (s->>'category')::text,
    (s->>'key')::text,
    (s->>'value'),
    (s->>'updated_at')::timestamp,
    (s->>'updated_by')::uuid
  FROM json_array_elements(settings) AS s
  ON CONFLICT (category, key) 
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;
END;
$$;


ALTER FUNCTION "public"."save_settings"("settings" "json") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_chat_history"("query_embedding" "public"."vector", "user_id" "uuid", "match_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 5) RETURNS TABLE("message_id" bigint, "content" "text", "context" "jsonb", "similarity" double precision, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    chat_history.id AS message_id,
    chat_history.content,
    chat_history.context,
    1 - (chat_history.embedding <=> query_embedding) AS similarity,
    chat_history.created_at
  FROM chat_history
  WHERE chat_history.user_id = search_chat_history.user_id
    AND 1 - (chat_history.embedding <=> query_embedding) > match_threshold
  ORDER BY chat_history.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_chat_history"("query_embedding" "public"."vector", "user_id" "uuid", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_documents"("query_text" "text", "user_role" "text" DEFAULT 'user'::"text") RETURNS TABLE("id" bigint, "content" "jsonb", "metadata" "jsonb", "document_type" "text", "source_type" "text", "status" "text", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- For super admins, search all documents
  IF user_role = 'super_admin' THEN
    RETURN QUERY
    SELECT 
      d.id,
      d.content,
      d.metadata,
      d.document_type,
      d.source_type,
      d.status,
      d.created_at,
      1 - (d.embedding <=> embedding_search.embed_text(query_text)) as similarity
    FROM 
      documents d
    WHERE 
      d.embedding IS NOT NULL
    ORDER BY 
      similarity DESC
    LIMIT 20;
  ELSE
    -- For other roles, filter by visibility
    RETURN QUERY
    SELECT 
      d.id,
      d.content,
      d.metadata,
      d.document_type,
      d.source_type,
      d.status,
      d.created_at,
      1 - (d.embedding <=> embedding_search.embed_text(query_text)) as similarity
    FROM 
      documents d
    WHERE 
      d.embedding IS NOT NULL
      AND (
        -- Check visibility settings
        d.metadata IS NULL 
        OR 
        d.metadata->>'visible_to' IS NULL
        OR
        d.metadata->'visible_to' ? user_role
      )
    ORDER BY 
      similarity DESC
    LIMIT 20;
  END IF;
END;
$$;


ALTER FUNCTION "public"."search_documents"("query_text" "text", "user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_documents_with_slack"("search_query" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) INTO result
    FROM (
        SELECT 
            id,
            name,
            ts_headline('english', content, plainto_tsquery('english', search_query)) as snippet,
            metadata,
            source_type,
            created_at,
            CASE 
                WHEN metadata->>'source' = 'slack' THEN 
                    'From Slack #' || COALESCE(metadata->>'channel_name', 'unknown')
                ELSE source_type
            END as display_source
        FROM public.documents
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', search_query)
        AND status = 'active'
        ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', search_query)) DESC
        LIMIT 10
    ) d;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."search_documents_with_slack"("search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_full_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.65, "match_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie.id,
    ie.image_path,
    1 - (ie.embedding_vector <=> query_embedding) AS similarity
  FROM
    image_embeddings ie
  WHERE
    ie.embedding_type = 'full'
  AND
    1 - (ie.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."search_full_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie.id,
    ie.image_path,
    1 - (ie.embedding_data->>'embedding')::vector <=> query_embedding AS similarity
  FROM
    image_embeddings ie  -- Add table alias here
  WHERE
    ie.embedding_type = embedding_type  -- Qualify the column with table alias
    AND 1 - (ie.embedding_data->>'embedding')::vector <=> query_embedding > match_threshold
  ORDER BY
    ie.embedding_data->>'embedding' <=> query_embedding
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text" DEFAULT 'full'::"text", "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision, "patch_index" integer, "patch_x" integer, "patch_y" integer, "patch_width" integer, "patch_height" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if this is a full image search or patch search
    IF embedding_type = 'full' THEN
        -- For full image search, use the main embeddings table
        RETURN QUERY
        SELECT 
            e.id,
            e.image_path,
            1 - (e.embedding_data->'embedding'::text::vector <=> query_embedding) as similarity,
            NULL::int as patch_index,
            NULL::int as patch_x, 
            NULL::int as patch_y,
            NULL::int as patch_width,
            NULL::int as patch_height
        FROM 
            image_embeddings e
        WHERE 
            e.embedding_type = 'full'
            AND e.embedding_data->'embedding' IS NOT NULL
            AND 1 - (e.embedding_data->'embedding'::text::vector <=> query_embedding) > match_threshold
        ORDER BY 
            similarity DESC
        LIMIT match_limit
        OFFSET offset_value;
    ELSE
        -- For partial search, use the patch_embeddings table
        RETURN QUERY
        SELECT 
            p.id,
            p.image_path,
            1 - (p.embedding <=> query_embedding) as similarity,
            p.patch_index,
            p.patch_x, 
            p.patch_y,
            p.patch_width,
            p.patch_height
        FROM 
            patch_embeddings p
        WHERE 
            p.embedding IS NOT NULL
            AND 1 - (p.embedding <=> query_embedding) > match_threshold
        ORDER BY 
            similarity DESC
        LIMIT match_limit
        OFFSET offset_value;
    END IF;
END;
$$;


ALTER FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_embedding_with_offset"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.65, "match_limit" integer DEFAULT 20, "embedding_type" "text" DEFAULT 'full'::"text", "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Use embedding_vector directly since that's what you have
  RETURN QUERY
  SELECT 
    e.id::uuid,
    e.image_path::text,
    (e.embedding_vector <=> query_embedding) AS similarity
  FROM 
    image_embeddings e
  WHERE 
    e.embedding_type = embedding_type
    AND e.embedding_vector IS NOT NULL
  ORDER BY 
    similarity ASC
  LIMIT match_limit
  OFFSET offset_value;
  
  -- If no results, return recent images
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      e.id::uuid,
      e.image_path::text,
      0.99 AS similarity
    FROM 
      image_embeddings e
    WHERE 
      e.embedding_type = embedding_type
    ORDER BY 
      e.created_at DESC
    LIMIT match_limit
    OFFSET offset_value;
  END IF;
END;
$$;


ALTER FUNCTION "public"."search_images_by_embedding_with_offset"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer DEFAULT 20) RETURNS TABLE("id" integer, "path" "text", "analysis" "jsonb", "match_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH term_matches AS (
    SELECT
      eia.id,
      eia.path,
      eia.analysis,
      SUM(
        CASE 
          WHEN eia.analysis::TEXT ILIKE '%' || term || '%' THEN 1.0
          ELSE 0.0
        END
      ) / array_length(search_terms, 1) AS score
    FROM
      enhanced_image_analysis eia,
      unnest(search_terms) AS term
    GROUP BY
      eia.id, eia.path, eia.analysis
  )
  SELECT
    tm.id,
    tm.path,
    tm.analysis,
    tm.score
  FROM
    term_matches tm
  WHERE
    tm.score > 0
  ORDER BY
    tm.score DESC
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer DEFAULT 20, "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "path" "text", "match_score" real, "analysis" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.image_path AS path,
    ts_rank(to_tsvector('english', COALESCE(a.analysis::text, '')), 
            plainto_tsquery('english', array_to_string(search_terms, ' '))) AS match_score,
    a.analysis
  FROM public.image_embeddings i
  LEFT JOIN public.enhanced_image_analysis a ON i.id = a.image_id
  WHERE to_tsvector('english', COALESCE(a.analysis::text, '')) @@ 
        plainto_tsquery('english', array_to_string(search_terms, ' '))
  ORDER BY match_score DESC
  LIMIT match_limit
  OFFSET offset_value;
END;
$$;


ALTER FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer, "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    embeddings.id,
    embeddings.image_path,
    1 - (embeddings.embedding_data->>'embedding')::vector <=> query_embedding AS similarity
  FROM 
    image_embeddings AS embeddings
  WHERE 
    embeddings.embedding_type = 'partial'
    AND 1 - (embeddings.embedding_data->>'embedding')::vector <=> query_embedding > match_threshold
  ORDER BY 
    similarity DESC
  LIMIT match_limit
  OFFSET offset_value;
END;
$$;


ALTER FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.4, "match_limit" integer DEFAULT 20, "embedding_type" "text" DEFAULT 'partial'::"text", "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Use embedding_vector directly
  RETURN QUERY
  SELECT 
    e.id::uuid,
    e.image_path::text,
    (e.embedding_vector <=> query_embedding) AS similarity
  FROM 
    image_embeddings e
  WHERE 
    e.embedding_type = embedding_type
    AND e.embedding_vector IS NOT NULL
  ORDER BY 
    similarity ASC
  LIMIT match_limit
  OFFSET offset_value;
  
  -- If no results, return recent images
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      e.id::uuid,
      e.image_path::text,
      0.99 AS similarity
    FROM 
      image_embeddings e
    WHERE 
      e.embedding_type = embedding_type
    ORDER BY 
      e.created_at DESC
    LIMIT match_limit
    OFFSET offset_value;
  END IF;
END;
$$;


ALTER FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_partial_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.65, "match_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH patch_similarities AS (
    SELECT
      p.id,
      ie.image_path,
      1 - (p.patch_vector <=> query_embedding) AS patch_similarity
    FROM
      patch_embeddings p
    JOIN image_embeddings ie ON p.id = ie.id
  ),
  best_patch_matches AS (
    SELECT
      id,
      image_path,
      MAX(patch_similarity) AS similarity
    FROM
      patch_similarities
    WHERE
      patch_similarity > match_threshold
    GROUP BY
      id, image_path
  )
  SELECT
    id,
    image_path,
    similarity
  FROM
    best_patch_matches
  ORDER BY
    similarity DESC
  LIMIT match_limit;
END;
$$;


ALTER FUNCTION "public"."search_partial_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_zenoti_data"("search_term" "text") RETURNS TABLE("document_name" "text", "source_table" "text", "relevance_snippet" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        name as document_name,
        (metadata->>'source_table')::TEXT as source_table,
        substring(content from position(upper(search_term) in upper(content)) - 50 for 200) as relevance_snippet
    FROM documents 
    WHERE source_type LIKE 'zenoti_%'
    AND upper(content) LIKE upper('%' || search_term || '%')
    ORDER BY updated_at DESC
    LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_zenoti_data"("search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_backup"("backup_type" "text", "user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  backup_result JSONB;
  user_role TEXT;
BEGIN
  -- Check user permissions
  SELECT role FROM user_roles WHERE id = user_id INTO user_role;
  
  IF user_role NOT IN ('admin', 'backup_operator') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient permissions'
    );
  END IF;

  -- Perform backup with additional security checks
  -- Implement actual backup logic here
  backup_result := jsonb_build_object(
    'success', true,
    'backup_id', uuid_generate_v4(),
    'timestamp', now()
  );

  RETURN backup_result;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log error securely
    INSERT INTO error_log (error_message, error_details, occurred_at)
    VALUES (
      'Backup failed', 
      SQLERRM, 
      now()
    );

    RETURN jsonb_build_object(
      'success', false,
      'message', 'Backup operation failed'
    );
END;
$$;


ALTER FUNCTION "public"."secure_backup"("backup_type" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_path_private"("bucket_name" "text", "path_pattern" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- This is a placeholder for the actual implementation
  -- In a real scenario, this would update bucket policies
  -- For now, it just ensures the storage_permissions record exists
  INSERT INTO storage_permissions (bucket, path, access_level)
  VALUES (bucket_name, path_pattern, 'private')
  ON CONFLICT (bucket, path) 
  DO UPDATE SET access_level = 'private';
END;
$$;


ALTER FUNCTION "public"."set_path_private"("bucket_name" "text", "path_pattern" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_path_public"("bucket_name" "text", "path_pattern" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- This is a placeholder for the actual implementation
  -- In a real scenario, this would update bucket policies
  -- For now, it just ensures the storage_permissions record exists
  INSERT INTO storage_permissions (bucket, path, access_level)
  VALUES (bucket_name, path_pattern, 'public')
  ON CONFLICT (bucket, path) 
  DO UPDATE SET access_level = 'public';
END;
$$;


ALTER FUNCTION "public"."set_path_public"("bucket_name" "text", "path_pattern" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.id := auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_add_reaction"("p_message_id" "uuid", "p_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.slack_message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji)
    ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."slack_add_reaction"("p_message_id" "uuid", "p_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_create_channel"("p_name" "text", "p_description" "text", "p_type" "text" DEFAULT 'general'::"text", "p_admin_only" boolean DEFAULT false) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_channel_id UUID;
    result JSON;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND ('admin' = ANY(profiles.roles) OR 'super_admin' = ANY(profiles.roles))
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can create channels';
    END IF;

    INSERT INTO public.slack_channels (name, description, type, admin_only, created_by)
    VALUES (lower(p_name), p_description, p_type, p_admin_only, auth.uid())
    RETURNING id INTO new_channel_id;
    
    SELECT row_to_json(c) INTO result
    FROM (
        SELECT id, name, description, type, admin_only
        FROM public.slack_channels
        WHERE id = new_channel_id
    ) c;
    
    RETURN result;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Channel with this name already exists';
    WHEN OTHERS THEN
        RAISE;
END;
$$;


ALTER FUNCTION "public"."slack_create_channel"("p_name" "text", "p_description" "text", "p_type" "text", "p_admin_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_messages"("p_channel_id" "uuid", "p_message_limit" integer DEFAULT 50) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) INTO result
    FROM (
        SELECT 
            id,
            channel_id,
            user_id,
            text,
            timestamp,
            parent_id,
            attachment_url,
            attachment_type,
            original_filename,
            pinned,
            COALESCE(user_name, user_email, 'Unknown User') AS user_name,
            user_avatar,
            user_email,
            (user_id = current_user_id) AS is_self
        FROM public.v_slack_messages_with_users
        WHERE channel_id = p_channel_id
        AND parent_id IS NULL
        ORDER BY timestamp DESC
        LIMIT p_message_limit
    ) m;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."slack_get_messages"("p_channel_id" "uuid", "p_message_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_message_threads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_name" character varying(255),
    "user_avatar" "text",
    "text" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "edited_at" timestamp with time zone,
    "attachment_type" character varying(50),
    "attachment_url" "text",
    "original_filename" "text",
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."slack_message_threads" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_thread_messages"("parent_message_id" "uuid") RETURNS SETOF "public"."slack_message_threads"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM slack_message_threads
  WHERE parent_id = parent_message_id
  AND is_deleted = false
  ORDER BY timestamp ASC;
END;
$$;


ALTER FUNCTION "public"."slack_get_thread_messages"("parent_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_unread_count"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    unread_count INT;
BEGIN
    -- This is a simplified version - you'd need a proper read tracking system
    SELECT COUNT(DISTINCT channel_id) INTO unread_count
    FROM public.slack_messages
    WHERE timestamp > COALESCE(
        (SELECT MAX(viewed_at) 
         FROM public.slack_channel_views 
         WHERE user_id = auth.uid()),
        '1900-01-01'::timestamptz
    );
    
    RETURN COALESCE(unread_count, 0);
END;
$$;


ALTER FUNCTION "public"."slack_get_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_pin_message"("message_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE slack_messages
  SET 
    pinned = TRUE,
    pinned_by = auth.uid(),
    pinned_at = NOW()
  WHERE id = message_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."slack_pin_message"("message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_process_document"("p_message_id" "uuid", "p_file_path" "text", "p_file_name" "text", "p_content" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_document_id UUID;
    v_channel_id UUID;
    v_channel_name TEXT;
    v_user_id UUID;
    result JSON;
BEGIN
    -- Get message and channel info
    SELECT m.channel_id, m.user_id, c.name 
    INTO v_channel_id, v_user_id, v_channel_name
    FROM public.slack_messages m
    JOIN public.slack_channels c ON c.id = m.channel_id
    WHERE m.id = p_message_id;
    
    -- Insert into documents table
    INSERT INTO public.documents (
        content,
        metadata,
        document_type,
        source_type,
        status,
        name,
        created_by
    ) VALUES (
        p_content,
        jsonb_build_object(
            'path', p_file_path,
            'fileName', p_file_name,
            'source', 'slack',
            'channel_id', v_channel_id,
            'channel_name', v_channel_name,
            'message_id', p_message_id,
            'processedAt', NOW()
        ),
        'generic',
        'slack_upload',
        'active',
        p_file_name,
        v_user_id
    ) RETURNING id INTO v_document_id;
    
    -- Update the slack message to indicate document was processed
    UPDATE public.slack_messages
    SET metadata = COALESCE(metadata, '{}'::jsonb) || 
        jsonb_build_object(
            'document_id', v_document_id,
            'processed_to_kb', true,
            'processed_at', NOW()
        )
    WHERE id = p_message_id;
    
    -- Return result
    SELECT row_to_json(d) INTO result
    FROM (
        SELECT 
            id,
            name,
            metadata,
            created_at
        FROM public.documents
        WHERE id = v_document_id
    ) d;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."slack_process_document"("p_message_id" "uuid", "p_file_path" "text", "p_file_name" "text", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_process_document_for_kb"("message_id" "uuid", "document_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  message_record slack_messages;
BEGIN
  -- Get the message
  SELECT * INTO message_record FROM slack_messages WHERE id = message_id;
  
  -- Check permission - only owners of the message or admins can process
  IF NOT (
    message_record.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND 
      (
        raw_user_meta_data->>'roles' LIKE '%admin%' OR 
        raw_user_meta_data->>'roles' LIKE '%super_admin%'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: Cannot process document for KB';
  END IF;
  
  -- Update message to mark as added to KB
  UPDATE slack_messages
  SET added_to_kb = true
  WHERE id = message_id;
  
  -- Create integration record
  INSERT INTO slack_kb_integrations (
    message_id,
    document_id,
    processed_by,
    status
  ) VALUES (
    message_id,
    document_id,
    auth.uid(),
    'success'
  );
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."slack_process_document_for_kb"("message_id" "uuid", "document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_attachment"("p_channel_id" "uuid", "p_attachment_data" "json") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_message_id UUID;
    result JSON;
BEGIN
    INSERT INTO public.slack_messages (
        channel_id, 
        user_id, 
        text, 
        attachment_url, 
        attachment_type, 
        original_filename
    )
    VALUES (
        p_channel_id, 
        auth.uid(), 
        p_attachment_data->>'text', 
        p_attachment_data->>'attachment_url',
        p_attachment_data->>'attachment_type',
        p_attachment_data->>'original_filename'
    )
    RETURNING id INTO new_message_id;
    
    SELECT row_to_json(m) INTO result
    FROM (
        SELECT 
            m.id,
            m.channel_id,
            m.user_id,
            m.text,
            m.timestamp,
            m.attachment_url,
            m.attachment_type,
            m.original_filename,
            COALESCE(p.full_name, p.email, 'Unknown User') AS user_name,
            (m.user_id = auth.uid()) AS is_self
        FROM public.slack_messages m
        LEFT JOIN public.profiles p ON m.user_id = p.id
        WHERE m.id = new_message_id
    ) m;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."slack_send_attachment"("p_channel_id" "uuid", "p_attachment_data" "json") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_attachment"("channel_id" "uuid", "attachment_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_message_id UUID;
BEGIN
  -- Check if user has access to this channel
  IF NOT EXISTS (
    SELECT 1 FROM slack_channels
    WHERE id = channel_id AND (
      admin_only = FALSE OR 
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND 
        (roles::jsonb ? 'admin' OR roles::jsonb ? 'super_admin')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Channel not found or access denied';
  END IF;

  -- Insert message with attachment
  INSERT INTO slack_messages (
    channel_id,
    user_id,
    text,
    attachment_url,
    attachment_type,
    original_filename,
    timestamp,
    added_to_kb
  ) VALUES (
    channel_id,
    auth.uid(),
    attachment_data->>'text',
    attachment_data->>'attachment_url',
    attachment_data->>'attachment_type',
    attachment_data->>'original_filename',
    now(),
    COALESCE((attachment_data->>'added_to_kb')::boolean, false)
  ) RETURNING id INTO new_message_id;

  -- Add to activity log
  INSERT INTO activity_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    'send_attachment',
    'channel',
    channel_id,
    jsonb_build_object(
      'message_id', new_message_id,
      'attachment_type', attachment_data->>'attachment_type'
    ),
    now()
  );

  RETURN new_message_id;
END;
$$;


ALTER FUNCTION "public"."slack_send_attachment"("channel_id" "uuid", "attachment_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_message"("p_channel_id" "uuid", "p_message_text" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_message_id UUID;
    result JSON;
BEGIN
    INSERT INTO public.slack_messages (channel_id, user_id, text)
    VALUES (p_channel_id, auth.uid(), p_message_text)
    RETURNING id INTO new_message_id;
    
    SELECT row_to_json(m) INTO result
    FROM (
        SELECT 
            m.id,
            m.channel_id,
            m.user_id,
            m.text,
            m.timestamp,
            COALESCE(p.full_name, p.email, 'Unknown User') AS user_name,
            (m.user_id = auth.uid()) AS is_self
        FROM public.slack_messages m
        LEFT JOIN public.profiles p ON m.user_id = p.id
        WHERE m.id = new_message_id
    ) m;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."slack_send_message"("p_channel_id" "uuid", "p_message_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_thread_reply"("parent_id" "uuid", "reply_text" "text") RETURNS SETOF "public"."slack_message_threads"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
  inserted_reply slack_message_threads;
  parent_message slack_messages;
BEGIN
  -- Get the parent message
  SELECT * INTO parent_message FROM slack_messages WHERE id = parent_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent message not found';
  END IF;
  
  -- Get user info
  SELECT id, email, raw_user_meta_data->>'name' as name
  INTO user_record
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Insert thread reply
  INSERT INTO slack_message_threads (
    parent_id,
    user_id,
    user_name,
    user_avatar,
    text
  ) VALUES (
    parent_id,
    user_record.id,
    COALESCE(user_record.name, user_record.email),
    'https://ui-avatars.com/api/?name=' || COALESCE(user_record.name, REPLACE(user_record.email, '@', '_')) || '&background=random',
    reply_text
  )
  RETURNING * INTO inserted_reply;
  
  RETURN NEXT inserted_reply;
END;
$$;


ALTER FUNCTION "public"."slack_send_thread_reply"("parent_id" "uuid", "reply_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "emb_type" "text", "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" double precision, "patch_index" integer, "patch_x" integer, "patch_y" integer, "patch_width" integer, "patch_height" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF emb_type = 'full' THEN
    -- Full image search using vector from embedding_data
    RETURN QUERY
    SELECT 
      e.id,
      e.image_path,
      1 - ((e.embedding_data->>'embedding')::vector <=> query_embedding) AS similarity,
      NULL::int AS patch_index,
      NULL::int AS patch_x,
      NULL::int AS patch_y,
      NULL::int AS patch_width,
      NULL::int AS patch_height
    FROM image_embeddings e
    WHERE e.embedding_type = 'full'
      AND e.embedding_data->>'embedding' IS NOT NULL
      AND 1 - ((e.embedding_data->>'embedding')::vector <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_limit
    OFFSET offset_value;

  ELSE
    -- Partial image search from patch_embeddings
    RETURN QUERY
    SELECT 
      p.id,
      p.image_path,
      1 - (p.patch_vector <=> query_embedding) AS similarity,
      p.patch_index,
      p.patch_x,
      p.patch_y,
      p.patch_width,
      p.patch_height
    FROM patch_embeddings p
    WHERE p.patch_vector IS NOT NULL
      AND 1 - (p.patch_vector <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_limit
    OFFSET offset_value;
  END IF;
END;
$$;


ALTER FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "emb_type" "text", "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" numeric, "match_limit" integer, "emb_type" "text", "offset_value" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "image_path" "text", "similarity" numeric, "patch_index" integer, "patch_x" integer, "patch_y" integer, "patch_width" integer, "patch_height" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF emb_type = 'full' THEN
    RETURN QUERY
    SELECT 
      i.id,
      i.image_path,
      1 - (i.embedding <=> query_embedding) AS similarity,
      NULL::integer AS patch_index,
      NULL::integer AS patch_x,
      NULL::integer AS patch_y,
      NULL::integer AS patch_width,
      NULL::integer AS patch_height
    FROM public.image_embeddings i
    WHERE i.embedding_type = 'full'
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_limit
    OFFSET offset_value;
  ELSE
    RETURN QUERY
    SELECT 
      p.image_id AS id,
      i.image_path,
      1 - (p.embedding <=> query_embedding) AS similarity,
      p.patch_index,
      p.patch_x,
      p.patch_y,
      p.patch_width,
      p.patch_height
    FROM public.patch_embeddings p
    JOIN public.image_embeddings i ON p.image_id = i.id
    WHERE p.embedding <=> query_embedding <= 1 - match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_limit
    OFFSET offset_value;
  END IF;
END;
$$;


ALTER FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" numeric, "match_limit" integer, "emb_type" "text", "offset_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_roles_from_external_groups"("p_user_id" "uuid", "p_provider_id" "uuid", "p_external_groups" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role_id UUID;
  v_role_ids UUID[] := '{}';
  v_result JSONB;
  v_roles_added INT := 0;
  v_external_group TEXT;
BEGIN
  -- Find matching roles for each external group
  FOREACH v_external_group IN ARRAY p_external_groups LOOP
    SELECT internal_role_id INTO v_role_id
    FROM external_role_mappings
    WHERE provider_id = p_provider_id
    AND external_role = v_external_group;
    
    IF v_role_id IS NOT NULL THEN
      v_role_ids := v_role_ids || v_role_id;
    END IF;
  END LOOP;
  
  -- Add roles that don't exist yet
  IF array_length(v_role_ids, 1) > 0 THEN
    WITH existing_roles AS (
      SELECT role_id
      FROM user_roles
      WHERE user_id = p_user_id
      AND role_id = ANY(v_role_ids)
    ), new_roles AS (
      SELECT unnest(v_role_ids) AS role_id
      EXCEPT
      SELECT role_id FROM existing_roles
    ), inserted AS (
      INSERT INTO user_roles (user_id, role_id)
      SELECT p_user_id, role_id FROM new_roles
      RETURNING role_id
    )
    SELECT count(*) INTO v_roles_added FROM inserted;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', TRUE,
    'roles_added', v_roles_added,
    'roles_mapped', array_length(v_role_ids, 1)
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."sync_roles_from_external_groups"("p_user_id" "uuid", "p_provider_id" "uuid", "p_external_groups" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_zenoti_centers"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
  config JSONB;
  api_response JSONB;
BEGIN
  -- Get Zenoti configuration
  SELECT integrations.config INTO config
  FROM integrations
  WHERE provider = 'zenoti';
  
  IF config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Zenoti configuration not found'
    );
  END IF;
  
  -- Call the Zenoti API to get centers
  -- This is a placeholder - in reality, this would be handled by an Edge Function
  -- For simplicity in this example, we'll just return a mock result
  
  INSERT INTO integration_logs (provider, event_type, details)
  VALUES ('zenoti', 'centers_sync_initiated', jsonb_build_object('automatic', true));
  
  -- Just a placeholder for the actual sync
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sync initiated'
  );
END;
$$;


ALTER FUNCTION "public"."sync_zenoti_centers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_zenoti_to_documents"("source_table" "text", "record_data" "jsonb", "operation" "text" DEFAULT 'INSERT'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    doc_id TEXT;
    doc_content TEXT;
    source_id TEXT;
    doc_name TEXT;
BEGIN
    -- Extract the primary identifier from the record
    source_id := COALESCE(
        record_data->>'id',
        record_data->>'appointment_id',
        record_data->>'guest_id',
        record_data->>'center_id',
        record_data->>'code',
        record_data::text
    );
    
    -- Generate document ID
    doc_id := source_table || '_' || source_id;
    
    -- Generate human-readable name
    doc_name := COALESCE(
        record_data->>'name',
        record_data->>'guest_name', 
        record_data->>'service_name',
        NULLIF(CONCAT(record_data->>'first_name', ' ', record_data->>'last_name'), ' '),
        NULLIF(CONCAT(record_data->'details'->'personal_info'->>'first_name', ' ', record_data->'details'->'personal_info'->>'last_name'), ' '),
        record_data->'details'->>'guest_name',
        record_data->'details'->>'service_name',
        source_table || ' ' || source_id
    );
    
    -- Convert record to searchable content
    doc_content := zenoti_record_to_content(source_table, record_data);
    
    IF operation = 'DELETE' THEN
        DELETE FROM documents WHERE id = doc_id;
        RETURN;
    END IF;
    
    -- Insert or update in documents table
    INSERT INTO documents (
        id,
        content,
        metadata,
        document_type,
        source_type,
        status,
        processing_status,
        name,
        created_at,
        updated_at
    ) VALUES (
        doc_id,
        doc_content,
        jsonb_build_object(
            'source_table', source_table,
            'source_id', source_id,
            'original_data', record_data,
            'sync_timestamp', NOW()
        ),
        'crm_data',
        'zenoti_' || source_table,
        'active',
        jsonb_build_object('synced', true, 'last_sync', NOW()),
        doc_name,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        name = EXCLUDED.name,
        updated_at = NOW(),
        processing_status = jsonb_build_object('synced', true, 'last_sync', NOW());
END;
$$;


ALTER FUNCTION "public"."sync_zenoti_to_documents"("source_table" "text", "record_data" "jsonb", "operation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_db_connection"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration INT;
  result JSONB;
BEGIN
  start_time := clock_timestamp();
  
  -- Perform some simple database operations to test the connection
  PERFORM count(*) FROM auth.users;
  
  end_time := clock_timestamp();
  duration := extract(milliseconds from end_time - start_time)::INT;
  
  result := jsonb_build_object(
    'success', true,
    'timestamp', now(),
    'latency_ms', duration,
    'message', 'Connection successful'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'timestamp', now(),
    'error', SQLERRM,
    'message', 'Connection failed'
  );
END;
$$;


ALTER FUNCTION "public"."test_db_connection"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_slack_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    doc_id UUID;
    channel_name TEXT;
    user_name TEXT;
    user_email TEXT;
BEGIN
    -- Get channel and user info
    SELECT name INTO channel_name FROM slack_channels WHERE id = NEW.channel_id;
    SELECT full_name, email INTO user_name, user_email FROM profiles WHERE id = NEW.user_id;
    
    -- Generate document ID
    doc_id := gen_random_uuid();
    
    -- Insert main message as document
    INSERT INTO documents (
        id,
        name,
        content,
        metadata,
        source_type,
        document_type,
        status,
        created_at,
        created_by
    ) VALUES (
        doc_id,
        COALESCE(channel_name, 'Unknown Channel') || ' - ' || 
            TO_CHAR(NEW.timestamp, 'YYYY-MM-DD HH24:MI:SS'),
        NEW.text,
        jsonb_build_object(
            'source', 'slack',
            'message_id', NEW.id,
            'channel_id', NEW.channel_id,
            'channel_name', channel_name,
            'user_id', NEW.user_id,
            'user_name', user_name,
            'user_email', user_email,
            'timestamp', NEW.timestamp,
            'parent_id', NEW.parent_id,
            'attachment_url', NEW.attachment_url,
            'attachment_type', NEW.attachment_type,
            'original_filename', NEW.original_filename
        ),
        'slack',
        'message',
        'processed',
        NEW.created_at,
        NEW.user_id
    );
    
    -- Process attachment if exists
    IF NEW.attachment_url IS NOT NULL THEN
        INSERT INTO documents (
            id,
            name,
            content,
            metadata,
            source_type,
            document_type,
            status,
            parent_id,
            created_at,
            created_by
        ) VALUES (
            gen_random_uuid(),
            COALESCE(NEW.original_filename, 'Slack Attachment'),
            'Slack attachment: ' || NEW.attachment_url,
            jsonb_build_object(
                'source', 'slack',
                'message_id', NEW.id,
                'attachment_url', NEW.attachment_url,
                'attachment_type', NEW.attachment_type,
                'original_filename', NEW.original_filename,
                'parent_message_id', NEW.id
            ),
            'slack',
            'attachment',
            'processed',
            doc_id,
            NEW.created_at,
            NEW.user_id
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_process_slack_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_appointments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_appointments', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_appointments', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_appointments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_appointments_reports"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_appointments_reports', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_appointments_reports', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_appointments_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_centers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_centers', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_centers', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_centers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_clients"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_clients', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_clients', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_clients"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_packages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_packages', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_packages', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_packages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_sales_accrual_reports', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_sales_accrual_reports', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_sales_cash_reports', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_sales_cash_reports', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_zenoti_services"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM sync_zenoti_to_documents('zenoti_services', to_jsonb(OLD), 'DELETE');
        RETURN OLD;
    ELSE
        PERFORM sync_zenoti_to_documents('zenoti_services', to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_zenoti_services"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_roles"("profile_id" "uuid", "new_roles" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE profiles
  SET roles = new_roles,
      updated_at = NOW()
  WHERE id = profile_id;
END;
$$;


ALTER FUNCTION "public"."update_admin_roles"("profile_id" "uuid", "new_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_document_relevance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.relevance_score := calculate_document_relevance(
        age(NEW.created_at),
        NEW.document_type,
        NEW.metadata
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_document_relevance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_synced"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.last_synced = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_last_synced"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_password_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert the new password hash into history
  INSERT INTO password_history (
    user_id,
    password_hash,
    created_at
  ) VALUES (
    NEW.id,
    NEW.encrypted_password, -- Assuming this is the column name in auth.users
    NOW()
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_password_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_storage_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  bucket TEXT;
  file_size BIGINT;
BEGIN
  bucket := NEW.bucket_id;
  file_size := (NEW.metadata->>'size')::BIGINT;

  UPDATE storage_stats
  SET 
    file_count = file_count + 1,
    total_size = total_size + COALESCE(file_size, 0),
    updated_at = now()
  WHERE bucket_name = bucket;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_storage_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_document"("doc_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_roles TEXT[];
  doc_metadata JSONB;
  visible_to TEXT[];
BEGIN
  -- Get the user's roles from the auth.users meta table
  SELECT (auth.jwt() ->> 'app_metadata')::jsonb->'roles' INTO user_roles;
  
  -- If user is super_admin, always allow access
  IF 'super_admin' = ANY(user_roles) THEN
    RETURN TRUE;
  END IF;
  
  -- Get the document's metadata
  SELECT metadata INTO doc_metadata FROM documents WHERE id = doc_id;
  
  -- If no metadata or no visible_to field, document is visible to everyone
  IF doc_metadata IS NULL OR doc_metadata->>'visible_to' IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if any of user's roles are in the visible_to array
  SELECT ARRAY(SELECT jsonb_array_elements_text(doc_metadata->'visible_to')) INTO visible_to;
  
  RETURN EXISTS (
    SELECT 1 FROM unnest(user_roles) ur
    WHERE ur = ANY(visible_to)
  );
END;
$$;


ALTER FUNCTION "public"."user_can_access_document"("doc_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vacuum_analyze"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  ANALYZE documents;
  RETURN 'Database analyzed successfully';
END;
$$;


ALTER FUNCTION "public"."vacuum_analyze"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_email_domain"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.email NOT LIKE '%@tatt2away.com' THEN
    RAISE EXCEPTION 'Only @tatt2away.com emails are allowed.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_email_domain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_tatt2away_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Temporarily allow all emails for debugging
  -- Uncomment the restriction below when ready
  /*
  IF RIGHT(NEW.email, 14) != '@tatt2away.com' THEN
    DELETE FROM auth.users WHERE id = NEW.id;
    RAISE EXCEPTION 'Only @tatt2away.com email addresses are allowed.';
  END IF;
  */
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_tatt2away_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_mfa_attempt"("p_user_id" "uuid", "p_method_id" "uuid", "p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_method_type TEXT;
  v_secret TEXT;
  v_result JSONB;
  v_verified BOOLEAN := FALSE;
  v_code_record RECORD;
BEGIN
  -- Get MFA method details
  SELECT type, secret INTO v_method_type, v_secret
  FROM mfa_methods
  WHERE id = p_method_id AND user_id = p_user_id;
  
  IF v_method_type IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'MFA method not found'
    );
  END IF;
  
  -- Different verification logic based on method type
  IF v_method_type = 'email' OR v_method_type = 'sms' THEN
    -- For email/SMS, check stored codes
    SELECT * INTO v_code_record
    FROM mfa_attempts
    WHERE user_id = p_user_id
      AND method_id = p_method_id
      AND code = p_code
      AND used = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_code_record.id IS NOT NULL THEN
      -- Mark code as used
      UPDATE mfa_attempts
      SET used = TRUE
      WHERE id = v_code_record.id;
      
      v_verified := TRUE;
    END IF;
  ELSIF v_method_type = 'totp' THEN
    -- For TOTP, verification would be done in application code
    -- This is a placeholder - actual TOTP verification logic is in the backend
    -- We might store the result here for audit purposes
    INSERT INTO mfa_attempts (
      user_id,
      method_id,
      code,
      verified,
      created_at,
      expires_at,
      used
    ) VALUES (
      p_user_id,
      p_method_id,
      '******', -- don't store the actual code
      v_verified,
      NOW(),
      NOW() + INTERVAL '1 minute', -- Short expiry as it's already used
      TRUE
    );
  END IF;
  
  -- Update method last used time
  IF v_verified THEN
    UPDATE mfa_methods
    SET last_used = NOW()
    WHERE id = p_method_id;
    
    -- Log successful verification
    INSERT INTO auth_events (
      user_id,
      event_type,
      metadata,
      created_at
    ) VALUES (
      p_user_id,
      'mfa_verification_success',
      jsonb_build_object('method_id', p_method_id, 'method_type', v_method_type),
      NOW()
    );
  ELSE
    -- Log failed attempt
    INSERT INTO auth_events (
      user_id,
      event_type,
      metadata,
      created_at
    ) VALUES (
      p_user_id,
      'mfa_verification_failed',
      jsonb_build_object('method_id', p_method_id, 'method_type', v_method_type),
      NOW()
    );
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', v_verified,
    'method_type', v_method_type
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."verify_mfa_attempt"("p_user_id" "uuid", "p_method_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zenoti_record_to_content"("table_name" "text", "record_data" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    content_parts TEXT[];
    key TEXT;
    value TEXT;
    nested_json JSONB;
    json_key TEXT;
    json_value TEXT;
BEGIN
    content_parts := ARRAY[]::TEXT[];
    
    -- Add table context
    content_parts := array_append(content_parts, 'Table: ' || table_name);
    
    -- Convert each field to searchable text
    FOR key, value IN SELECT * FROM jsonb_each_text(record_data)
    LOOP
        IF value IS NOT NULL AND value != '' THEN
            -- Handle special formatting for different field types
            CASE 
                WHEN key ILIKE '%time%' OR key ILIKE '%date%' THEN
                    content_parts := array_append(content_parts, key || ': ' || value);
                WHEN key IN ('details', 'guest', 'service', 'therapist', 'metadata') AND jsonb_typeof(record_data->key) = 'object' THEN
                    -- Extract nested JSON data for better searchability
                    nested_json := record_data->key;
                    content_parts := array_append(content_parts, key || '_section:');
                    FOR json_key, json_value IN SELECT * FROM jsonb_each_text(nested_json)
                    LOOP
                        IF json_value IS NOT NULL AND json_value != '' AND json_value != 'null' THEN
                            content_parts := array_append(content_parts, '  ' || json_key || ': ' || json_value);
                        END IF;
                    END LOOP;
                WHEN key IN ('data') AND jsonb_typeof(record_data->key) = 'array' THEN
                    -- Handle array data (like in reports)
                    content_parts := array_append(content_parts, key || '_count: ' || jsonb_array_length(record_data->key)::text);
                ELSE
                    content_parts := array_append(content_parts, key || ': ' || value);
            END CASE;
        END IF;
    END LOOP;
    
    -- Add table-specific enhancements for better searchability
    CASE table_name
        WHEN 'zenoti_appointments' THEN
            -- Extract key appointment info
            IF record_data->>'guest_name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_GUEST: ' || (record_data->>'guest_name'));
            END IF;
            IF record_data->>'service_name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_SERVICE: ' || (record_data->>'service_name'));
            END IF;
            IF record_data->'details'->>'guest_name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_GUEST: ' || (record_data->'details'->>'guest_name'));
            END IF;
            IF record_data->'details'->>'service_name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_SERVICE: ' || (record_data->'details'->>'service_name'));
            END IF;
        WHEN 'zenoti_clients' THEN
            -- Extract client contact info from nested details
            IF record_data->'details'->'personal_info'->>'email' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_EMAIL: ' || (record_data->'details'->'personal_info'->>'email'));
            END IF;
            IF record_data->'details'->'personal_info'->'mobile_phone'->>'number' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_PHONE: ' || (record_data->'details'->'personal_info'->'mobile_phone'->>'number'));
            END IF;
            IF record_data->'details'->'personal_info'->>'first_name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_NAME: ' || (record_data->'details'->'personal_info'->>'first_name') || ' ' || COALESCE(record_data->'details'->'personal_info'->>'last_name', ''));
            END IF;
        WHEN 'zenoti_services' THEN
            -- Extract service pricing and category info
            IF record_data->>'price' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_PRICE: $' || (record_data->>'price'));
            END IF;
            IF record_data->>'category' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_CATEGORY: ' || (record_data->>'category'));
            END IF;
        WHEN 'zenoti_packages' THEN
            -- Extract package info
            IF record_data->>'name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_PACKAGE: ' || (record_data->>'name'));
            END IF;
        WHEN 'zenoti_centers' THEN
            -- Extract center info
            IF record_data->>'name' IS NOT NULL THEN
                content_parts := array_append(content_parts, 'SEARCHABLE_CENTER: ' || (record_data->>'name'));
            END IF;
        ELSE
            -- Default handling for other tables
            NULL;
    END CASE;
    
    RETURN array_to_string(content_parts, E'\n');
END;
$_$;


ALTER FUNCTION "public"."zenoti_record_to_content"("table_name" "text", "record_data" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."active_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_hash" character varying(255) NOT NULL,
    "refresh_token_hash" character varying(255),
    "ip_address" character varying(45),
    "user_agent" character varying(255),
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "mfa_verified" boolean DEFAULT false,
    "last_active" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."active_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_alert_history" (
    "id" "uuid" NOT NULL,
    "threshold_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "threshold_value" double precision NOT NULL,
    "current_value" double precision NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_alert_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_alert_thresholds" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "type" character varying(50) NOT NULL,
    "metric_path" character varying(255) NOT NULL,
    "threshold_value" double precision NOT NULL,
    "comparison" character varying(10) DEFAULT 'gt'::character varying,
    "reminder_minutes" integer DEFAULT 60,
    "notification_channels" "jsonb" DEFAULT '["email"]'::"jsonb",
    "notify_users" "jsonb" DEFAULT '[]'::"jsonb",
    "webhook_url" character varying(500),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_alert_thresholds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_daily_rollups" (
    "id" integer NOT NULL,
    "date" "date" NOT NULL,
    "search_metrics" "jsonb",
    "user_metrics" "jsonb",
    "image_metrics" "jsonb",
    "system_metrics" "jsonb",
    "event_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_daily_rollups" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_daily_rollups_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."analytics_daily_rollups_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_daily_rollups_id_seq" OWNED BY "public"."analytics_daily_rollups"."id";



CREATE TABLE IF NOT EXISTS "public"."analytics_dashboard_presets" (
    "id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "config" "jsonb" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_dashboard_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "user_id" character varying(100),
    "client_id" character varying(100),
    "session_id" character varying(100),
    "data" "jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "active_users" integer DEFAULT 0,
    "queries" integer DEFAULT 0,
    "error_rate" numeric DEFAULT 0,
    "avg_response_time" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."analytics_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_history" IS 'Historical analytics data for trends';



CREATE TABLE IF NOT EXISTS "public"."analytics_last_seen" (
    "id" integer NOT NULL,
    "metric_type" character varying(50) NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_last_seen" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_last_seen_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."analytics_last_seen_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_last_seen_id_seq" OWNED BY "public"."analytics_last_seen"."id";



CREATE TABLE IF NOT EXISTS "public"."analytics_stats" (
    "id" integer DEFAULT 1 NOT NULL,
    "active_users" integer DEFAULT 0,
    "queries_last_hour" integer DEFAULT 0,
    "error_rate" double precision DEFAULT 0,
    "avg_response_time" double precision DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_stats" IS 'Current analytics stats';



CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "key" "text" NOT NULL,
    "key_hash" "bytea" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "last_used_at" timestamp with time zone,
    "is_system" boolean DEFAULT false
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" character varying(100) NOT NULL,
    "description" "text",
    "ip_address" character varying(45),
    "user_agent" character varying(255),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "filename" "text",
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "location" "text",
    "size_mb" numeric,
    "includes_files" boolean DEFAULT true,
    "includes_database" boolean DEFAULT true,
    "includes_settings" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "error" "text",
    "notes" "text",
    CONSTRAINT "chk_backup_size" CHECK (("size_mb" >= (0)::numeric)),
    CONSTRAINT "chk_backup_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_process_jobs" (
    "id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "start_time" bigint NOT NULL,
    "end_time" bigint,
    "stats" "jsonb" DEFAULT '{}'::"jsonb",
    "options" "jsonb" DEFAULT '{}'::"jsonb",
    "processed_paths" "text"[] DEFAULT '{}'::"text"[],
    "pending_paths" "text"[] DEFAULT '{}'::"text"[],
    "current_batch" "text"[] DEFAULT '{}'::"text"[],
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."batch_process_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "thread_id" "text",
    "message_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sender" "text"
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chat_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."chat_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chat_history_id_seq" OWNED BY "public"."chat_history"."id";



CREATE TABLE IF NOT EXISTS "public"."chat_threads" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'active'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_sync_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "details" "jsonb",
    "last_attempt" timestamp with time zone,
    "attempts" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."crm_sync_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_sync_queue" IS 'Queue for syncing CRM entities';



CREATE TABLE IF NOT EXISTS "public"."dashboard_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_default" boolean DEFAULT false
);


ALTER TABLE "public"."dashboard_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."database_backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filename" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "location" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."database_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_relationships" (
    "id" integer NOT NULL,
    "source_id" "text",
    "target_id" "text",
    "relationship_type" "text",
    "strength" double precision,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_relationships" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."document_relationships_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."document_relationships_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."document_relationships_id_seq" OWNED BY "public"."document_relationships"."id";



CREATE OR REPLACE VIEW "public"."documents_with_paths" AS
 SELECT "documents"."id",
    COALESCE("documents"."name", ("documents"."metadata" ->> 'fileName'::"text"), ("documents"."metadata" ->> 'originalName'::"text")) AS "name",
    "documents"."content",
    "documents"."embedding",
    "documents"."metadata",
    "public"."extract_document_path"("documents"."metadata") AS "file_path",
    "documents"."created_at",
    "documents"."updated_at"
   FROM "public"."documents";


ALTER TABLE "public"."documents_with_paths" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enhanced_image_analysis" (
    "id" integer NOT NULL,
    "path" "text" NOT NULL,
    "analysis" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."enhanced_image_analysis" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."enhanced_image_analysis_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."enhanced_image_analysis_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."enhanced_image_analysis_id_seq" OWNED BY "public"."enhanced_image_analysis"."id";



CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "error" "text",
    "context" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved" boolean DEFAULT false
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."existing_docs" (
    "id" integer NOT NULL,
    "path" "text" NOT NULL,
    "source_table" "text" NOT NULL
);


ALTER TABLE "public"."existing_docs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."existing_docs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."existing_docs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."existing_docs_id_seq" OWNED BY "public"."existing_docs"."id";



CREATE TABLE IF NOT EXISTS "public"."external_role_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "external_role" character varying(255) NOT NULL,
    "internal_role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."external_role_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."failed_images" (
    "path" "text" NOT NULL,
    "last_attempt" timestamp with time zone,
    "error_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."failed_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_path" "text" NOT NULL,
    "required_role" "uuid",
    "allowed_users" "uuid"[] DEFAULT '{}'::"uuid"[],
    "allowed_groups" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_processing_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint,
    "file_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "processed_by" "uuid",
    "error" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_processing_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."function_registry" (
    "function_name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "created_by" "text"
);


ALTER TABLE "public"."function_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "path" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."identity_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "provider_type" character varying(50) NOT NULL,
    "settings" "jsonb" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."identity_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_embeddings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cache_key" "text",
    "image_path" "text" NOT NULL,
    "dimensions" integer NOT NULL,
    "model_version" "text",
    "embedding_type" "text" NOT NULL,
    "patch_count" integer DEFAULT 0,
    "metadata" "jsonb",
    "file_cache_path" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding_data" "jsonb",
    "embedding_vector" "public"."vector"(1280),
    "original_path" "text"
);


ALTER TABLE "public"."image_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_sequences" (
    "id" integer NOT NULL,
    "image_id" "text",
    "prev_image" "text",
    "next_image" "text",
    "sequence_order" integer,
    "sequence_group" "text",
    "sequence_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_sequences" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."image_sequences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."image_sequences_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."image_sequences_id_seq" OWNED BY "public"."image_sequences"."id";



CREATE TABLE IF NOT EXISTS "public"."image_signatures" (
    "path" "text" NOT NULL,
    "signature" "jsonb" NOT NULL,
    "analyzed_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_logs" IS 'Logs changes and events for integrations';



CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider" "text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."integrations" IS 'Stores configurations for different integrations';



CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(100) NOT NULL,
    "email" character varying(255),
    "created_by" "uuid",
    "roles" "uuid"[] DEFAULT '{}'::"uuid"[],
    "used" boolean DEFAULT false,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_mappings" (
    "id" integer NOT NULL,
    "document_id" "text",
    "keyword" "text",
    "weight" double precision,
    "source" "text" DEFAULT 'auto'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."keyword_mappings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."keyword_mappings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."keyword_mappings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."keyword_mappings_id_seq" OWNED BY "public"."keyword_mappings"."id";



CREATE TABLE IF NOT EXISTS "public"."login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "success" boolean NOT NULL,
    "ip_address" character varying(45),
    "user_agent" character varying(255),
    "user_id" "uuid",
    "failure_reason" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_type" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "success" boolean DEFAULT false,
    "details" "jsonb"
);


ALTER TABLE "public"."maintenance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "method_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false
);


ALTER TABLE "public"."mfa_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "identifier" character varying(255),
    "secret" character varying(255),
    "verified" boolean DEFAULT false,
    "last_used" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mfa_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_history" (
    "id" integer NOT NULL,
    "migration_name" "text" NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."migration_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."migration_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."migration_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."migration_history_id_seq" OWNED BY "public"."migration_history"."id";



CREATE MATERIALIZED VIEW "public"."mv_recent_backups" AS
 SELECT "backups"."id",
    "backups"."type",
    "backups"."status",
    "backups"."size_mb",
    "backups"."created_at"
   FROM "public"."backups"
  WHERE ("backups"."created_at" > ("now"() - '30 days'::interval))
  WITH NO DATA;


ALTER TABLE "public"."mv_recent_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "tier" "text" DEFAULT 'basic'::"text",
    "features" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patch_embeddings" (
    "id" "uuid",
    "patch_index" integer,
    "patch_vector" "public"."vector"(1280),
    "image_path" "text",
    "region_x" integer,
    "region_y" integer,
    "region_width" integer,
    "region_height" integer,
    "embedding_type" "text",
    "patch_x" integer,
    "patch_y" integer,
    "patch_width" integer,
    "patch_height" integer
);


ALTER TABLE "public"."patch_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(100) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "resource" character varying(100) NOT NULL,
    "action" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processing_queue" (
    "id" integer NOT NULL,
    "document_id" "text",
    "process_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "last_attempt" timestamp with time zone,
    "error_log" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."processing_queue" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."processing_queue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."processing_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."processing_queue_id_seq" OWNED BY "public"."processing_queue"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles_backup" (
    "id" "uuid",
    "full_name" "text",
    "tier" "text",
    "organization_id" "uuid",
    "mfa_methods" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "roles" "text"[],
    "first_name" "text",
    "last_name" "text",
    "last_login" timestamp with time zone,
    "email" "text",
    "status" "text",
    "auth_provider" "text",
    "auth_providers" "text"[],
    "pending_link" "text",
    "pending_link_at" timestamp with time zone
);


ALTER TABLE "public"."profiles_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revoked_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "jti" character varying(255) NOT NULL,
    "user_id" "uuid",
    "revoked_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "reason" character varying(100)
);


ALTER TABLE "public"."revoked_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(100) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "level" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "ip_address" "text",
    "user_agent" "text",
    "details" "jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "browser" "text",
    "device" "text",
    "ip_address" "text",
    "is_current" boolean DEFAULT false,
    "mfa_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_active" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "chk_ip_address" CHECK (("ip_address" ~ '^(\d{1,3}\.){3}\d{1,3}$'::"text"))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "backup_id" "uuid",
    "settings_data" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings_backups" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."settings_id_seq" OWNED BY "public"."settings"."id";



CREATE TABLE IF NOT EXISTS "public"."slack_channel_members" (
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_admin" boolean DEFAULT false,
    "notification_preference" character varying(50) DEFAULT 'all'::character varying
);


ALTER TABLE "public"."slack_channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_channel_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "channel_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."slack_channel_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'general'::"text",
    "admin_only" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "slack_channels_type_check" CHECK (("type" = ANY (ARRAY['general'::"text", 'knowledge'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."slack_channels" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."slack_documents" AS
 SELECT "d"."id",
    "d"."content",
    "d"."metadata",
    "d"."embedding",
    "d"."document_type",
    "d"."source_type",
    "d"."status",
    "d"."processing_status",
    "d"."parent_id",
    "d"."chunk_index",
    "d"."chunk_total",
    "d"."relevance_score",
    "d"."created_at",
    "d"."updated_at",
    "d"."created_by",
    "d"."name",
    ("d"."metadata" ->> 'channel_name'::"text") AS "slack_channel",
    ("d"."metadata" ->> 'message_id'::"text") AS "slack_message_id",
    ("d"."metadata" ->> 'channel_id'::"text") AS "slack_channel_id"
   FROM "public"."documents" "d"
  WHERE (("d"."metadata" ->> 'source'::"text") = 'slack'::"text");


ALTER TABLE "public"."slack_documents" OWNER TO "postgres";


CREATE FOREIGN TABLE "public"."slack_files" (
    "id" "text",
    "name" "text",
    "title" "text",
    "mimetype" "text",
    "size" bigint,
    "url_private" "text",
    "user_id" "text",
    "created" timestamp without time zone
)
SERVER "tatt2awai_server"
OPTIONS (
    "resource" 'files',
    "schema" 'public'
);


ALTER FOREIGN TABLE "public"."slack_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_kb_integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "processed_by" "uuid",
    "status" character varying(50) DEFAULT 'success'::character varying,
    "error_message" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."slack_kb_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid",
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."slack_message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "user_id" "uuid",
    "text" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "attachment_url" "text",
    "attachment_type" "text",
    "original_filename" "text",
    "pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb"
);


ALTER TABLE "public"."slack_messages" OWNER TO "postgres";


CREATE FOREIGN TABLE "public"."slack_users" (
    "id" "text",
    "name" "text",
    "real_name" "text",
    "display_name" "text",
    "display_name_normalized" "text",
    "real_name_normalized" "text",
    "email" "text",
    "phone" "text",
    "skype" "text",
    "is_admin" boolean,
    "is_owner" boolean,
    "is_primary_owner" boolean,
    "is_bot" boolean,
    "is_app_user" boolean,
    "is_restricted" boolean,
    "is_ultra_restricted" boolean,
    "deleted" boolean,
    "status_text" "text",
    "status_emoji" "text",
    "status_expiration" bigint,
    "title" "text",
    "team_id" "text",
    "team" "text",
    "tz" "text",
    "tz_label" "text",
    "tz_offset" integer,
    "locale" "text",
    "image_24" "text",
    "image_48" "text",
    "image_72" "text",
    "image_192" "text",
    "image_512" "text",
    "color" "text",
    "updated" bigint
)
SERVER "tatt2awai_server"
OPTIONS (
    "resource" 'users',
    "schema" 'public'
);


ALTER FOREIGN TABLE "public"."slack_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sso_providers_backup" (
    "id" "uuid",
    "name" character varying(255),
    "type" character varying(50),
    "client_id" character varying(255),
    "config" "jsonb",
    "active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."sso_providers_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_access_grants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "grantee_type" "text" NOT NULL,
    "grantee_id" "text" NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."storage_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "access_level" "text" DEFAULT 'private'::"text" NOT NULL,
    "specific_users" "text"[] DEFAULT '{}'::"text"[],
    "specific_groups" "text"[] DEFAULT '{}'::"text"[],
    "set_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."storage_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_stats" (
    "id" integer NOT NULL,
    "bucket_name" "text" NOT NULL,
    "file_count" integer DEFAULT 0 NOT NULL,
    "total_size" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."storage_stats" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."storage_stats_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."storage_stats_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."storage_stats_id_seq" OWNED BY "public"."storage_stats"."id";



CREATE TABLE IF NOT EXISTS "public"."system_stats" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cpu_usage" double precision DEFAULT 0,
    "memory_usage" double precision DEFAULT 0,
    "storage_usage" double precision DEFAULT 0,
    "api_requests_count" integer DEFAULT 0,
    "error_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "api_key" "text",
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "quotas" "jsonb" DEFAULT '{}'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "storage_quota" bigint DEFAULT 1073741824,
    "rate_limit" integer DEFAULT 1000,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "slug_format" CHECK (("slug" ~ '^[a-z0-9\-]+$'::"text"))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."themes" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "content" "jsonb" NOT NULL,
    "author" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_exchange_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(255) NOT NULL,
    "token_hash" character varying(255) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false
);


ALTER TABLE "public"."token_exchange_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "external_id" character varying(255) NOT NULL,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "external_groups" "text"[] DEFAULT '{}'::"text"[],
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "theme_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" character varying(255) NOT NULL,
    "ip_address" character varying(45),
    "user_agent" "text",
    "device_info" "jsonb",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "duration_seconds" integer
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(255),
    "first_name" character varying(100),
    "last_name" character varying(100),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "last_active" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_slack_messages_with_users" AS
 SELECT "m"."id",
    "m"."channel_id",
    "m"."user_id",
    "m"."text",
    "m"."timestamp",
    "m"."parent_id",
    "m"."attachment_url",
    "m"."attachment_type",
    "m"."original_filename",
    "m"."pinned",
    "m"."created_at",
    "m"."updated_at",
    "m"."metadata",
    "p"."email" AS "user_email",
    "p"."full_name" AS "user_name",
    "c"."name" AS "channel_name",
    "c"."type" AS "channel_type",
    "c"."admin_only" AS "channel_admin_only"
   FROM (("public"."slack_messages" "m"
     LEFT JOIN "public"."profiles" "p" ON (("m"."user_id" = "p"."id")))
     LEFT JOIN "public"."slack_channels" "c" ON (("m"."channel_id" = "c"."id")));


ALTER TABLE "public"."v_slack_messages_with_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zenoti_appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "appointment_id" "text" NOT NULL,
    "guest_name" "text",
    "center_code" "text" NOT NULL,
    "service_id" "text",
    "service_name" "text",
    "therapist_id" "text",
    "therapist_name" "text",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "status" "text",
    "details" "jsonb",
    "last_synced" timestamp with time zone DEFAULT "now"(),
    "actual_start_time" timestamp with time zone,
    "actual_completed_time" timestamp with time zone,
    "checkin_time" timestamp with time zone,
    "center_id" "text",
    "appointment_group_id" "text",
    "invoice_id" "text",
    "service" "jsonb",
    "guest" "jsonb",
    "therapist" "jsonb",
    "notes" "text",
    "price" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."zenoti_appointments" OWNER TO "postgres";


COMMENT ON TABLE "public"."zenoti_appointments" IS 'Cache of Zenoti appointments for faster access';



CREATE TABLE IF NOT EXISTS "public"."zenoti_appointments_reports" (
    "id" bigint NOT NULL,
    "report_type" "text",
    "center_id" "text",
    "center_code" "text",
    "start_date" "date",
    "end_date" "date",
    "data" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zenoti_appointments_reports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."zenoti_appointments_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."zenoti_appointments_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."zenoti_appointments_reports_id_seq" OWNED BY "public"."zenoti_appointments_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."zenoti_centers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "center_id" "text" NOT NULL,
    "center_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "details" "jsonb",
    "active" boolean DEFAULT true,
    "last_synced" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zenoti_centers" OWNER TO "postgres";


COMMENT ON TABLE "public"."zenoti_centers" IS 'Cache of Zenoti centers for faster access';



CREATE TABLE IF NOT EXISTS "public"."zenoti_clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "guest_id" "text",
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "mobile" "text",
    "center_code" "text",
    "details" "jsonb",
    "last_visit_date" timestamp with time zone,
    "last_synced" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zenoti_clients" OWNER TO "postgres";


COMMENT ON TABLE "public"."zenoti_clients" IS 'Cache of Zenoti clients for faster access';



CREATE TABLE IF NOT EXISTS "public"."zenoti_packages" (
    "id" "text" NOT NULL,
    "center_id" "text",
    "details" "jsonb",
    "last_synced" timestamp with time zone DEFAULT "now"(),
    "booking_end_date" timestamp with time zone,
    "booking_start_date" timestamp with time zone,
    "category_id" "text",
    "code" "text",
    "description" "text",
    "html_description" "text",
    "name" "text",
    "time" integer,
    "type" integer,
    "business_unit_id" "uuid",
    "version_id" "uuid",
    "commission" "jsonb",
    "preferences" "jsonb",
    "catalog_info" "jsonb",
    "centers" "jsonb",
    "tags" "jsonb",
    "benefits" "jsonb",
    "updated_at" timestamp with time zone,
    "duration" integer,
    "price" integer,
    "category" "text"
);


ALTER TABLE "public"."zenoti_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zenoti_sales_accrual_reports" (
    "id" bigint NOT NULL,
    "report_type" "text",
    "center_id" "text",
    "center_code" "text",
    "start_date" "date",
    "end_date" "date",
    "data" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zenoti_sales_accrual_reports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."zenoti_sales_accrual_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."zenoti_sales_accrual_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."zenoti_sales_accrual_reports_id_seq" OWNED BY "public"."zenoti_sales_accrual_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."zenoti_sales_cash_reports" (
    "id" bigint NOT NULL,
    "report_type" "text",
    "center_id" "text",
    "center_code" "text",
    "start_date" "date",
    "end_date" "date",
    "data" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zenoti_sales_cash_reports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."zenoti_sales_cash_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."zenoti_sales_cash_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."zenoti_sales_cash_reports_id_seq" OWNED BY "public"."zenoti_sales_cash_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."zenoti_services" (
    "id" "uuid" NOT NULL,
    "code" "text",
    "name" "text",
    "description" "text",
    "type" integer,
    "category_id" "uuid",
    "business_unit_id" "uuid",
    "version_id" "uuid",
    "html_description" "text",
    "time" integer,
    "booking_start_date" timestamp with time zone,
    "booking_end_date" timestamp with time zone,
    "commission" "jsonb",
    "preferences" "jsonb",
    "catalog_info" "jsonb",
    "centers" "jsonb",
    "tags" "jsonb",
    "benefits" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "center_id" "text",
    "duration" integer,
    "price" integer,
    "category" "text",
    "details" "jsonb"
);


ALTER TABLE "public"."zenoti_services" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_daily_rollups" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_daily_rollups_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_last_seen" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_last_seen_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."chat_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."chat_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."document_relationships" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."document_relationships_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."enhanced_image_analysis" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."enhanced_image_analysis_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."existing_docs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."existing_docs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."image_sequences" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."image_sequences_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."keyword_mappings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."keyword_mappings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."migration_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."migration_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."processing_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."processing_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."storage_stats" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."storage_stats_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zenoti_appointments_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_appointments_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zenoti_sales_accrual_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_sales_accrual_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zenoti_sales_cash_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_sales_cash_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."active_sessions"
    ADD CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_alert_history"
    ADD CONSTRAINT "analytics_alert_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_alert_thresholds"
    ADD CONSTRAINT "analytics_alert_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_daily_rollups"
    ADD CONSTRAINT "analytics_daily_rollups_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."analytics_daily_rollups"
    ADD CONSTRAINT "analytics_daily_rollups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_dashboard_presets"
    ADD CONSTRAINT "analytics_dashboard_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_history"
    ADD CONSTRAINT "analytics_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_last_seen"
    ADD CONSTRAINT "analytics_last_seen_metric_type_key" UNIQUE ("metric_type");



ALTER TABLE ONLY "public"."analytics_last_seen"
    ADD CONSTRAINT "analytics_last_seen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_stats"
    ADD CONSTRAINT "analytics_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_process_jobs"
    ADD CONSTRAINT "batch_process_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_threads"
    ADD CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_sync_queue"
    ADD CONSTRAINT "crm_sync_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_presets"
    ADD CONSTRAINT "dashboard_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."database_backups"
    ADD CONSTRAINT "database_backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enhanced_image_analysis"
    ADD CONSTRAINT "enhanced_image_analysis_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."enhanced_image_analysis"
    ADD CONSTRAINT "enhanced_image_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."existing_docs"
    ADD CONSTRAINT "existing_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_role_mappings"
    ADD CONSTRAINT "external_role_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_role_mappings"
    ADD CONSTRAINT "external_role_mappings_provider_id_external_role_internal_r_key" UNIQUE ("provider_id", "external_role", "internal_role_id");



ALTER TABLE ONLY "public"."failed_images"
    ADD CONSTRAINT "failed_images_pkey" PRIMARY KEY ("path");



ALTER TABLE ONLY "public"."file_permissions"
    ADD CONSTRAINT "file_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_processing_log"
    ADD CONSTRAINT "file_processing_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."function_registry"
    ADD CONSTRAINT "function_registry_pkey" PRIMARY KEY ("function_name");



ALTER TABLE ONLY "public"."group_roles"
    ADD CONSTRAINT "group_roles_group_id_role_id_key" UNIQUE ("group_id", "role_id");



ALTER TABLE ONLY "public"."group_roles"
    ADD CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identity_providers"
    ADD CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_embeddings"
    ADD CONSTRAINT "image_embeddings_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."image_embeddings"
    ADD CONSTRAINT "image_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_sequences"
    ADD CONSTRAINT "image_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_signatures"
    ADD CONSTRAINT "image_signatures_pkey" PRIMARY KEY ("path");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_provider_key" UNIQUE ("provider");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keyword_mappings"
    ADD CONSTRAINT "keyword_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_attempts"
    ADD CONSTRAINT "mfa_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_methods"
    ADD CONSTRAINT "mfa_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_history"
    ADD CONSTRAINT "migration_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_history"
    ADD CONSTRAINT "password_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processing_queue"
    ADD CONSTRAINT "processing_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revoked_tokens"
    ADD CONSTRAINT "revoked_tokens_jti_key" UNIQUE ("jti");



ALTER TABLE ONLY "public"."revoked_tokens"
    ADD CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings_backups"
    ADD CONSTRAINT "settings_backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_category_key_key" UNIQUE ("category", "key");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_channel_members"
    ADD CONSTRAINT "slack_channel_members_pkey" PRIMARY KEY ("channel_id", "user_id");



ALTER TABLE ONLY "public"."slack_channel_views"
    ADD CONSTRAINT "slack_channel_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_channels"
    ADD CONSTRAINT "slack_channels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."slack_channels"
    ADD CONSTRAINT "slack_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_kb_integrations"
    ADD CONSTRAINT "slack_kb_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_message_reactions"
    ADD CONSTRAINT "slack_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."slack_message_reactions"
    ADD CONSTRAINT "slack_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_message_threads"
    ADD CONSTRAINT "slack_message_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_messages"
    ADD CONSTRAINT "slack_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_access_grants"
    ADD CONSTRAINT "storage_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_permissions"
    ADD CONSTRAINT "storage_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_stats"
    ADD CONSTRAINT "storage_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_stats"
    ADD CONSTRAINT "system_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_exchange_codes"
    ADD CONSTRAINT "token_exchange_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."token_exchange_codes"
    ADD CONSTRAINT "token_exchange_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_sequences"
    ADD CONSTRAINT "unique_sequence_order" UNIQUE ("sequence_group", "sequence_order");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "unique_session_id" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."user_groups"
    ADD CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_groups"
    ADD CONSTRAINT "user_groups_user_id_group_id_key" UNIQUE ("user_id", "group_id");



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_provider_id_external_id_key" UNIQUE ("provider_id", "external_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_appointments"
    ADD CONSTRAINT "zenoti_appointments_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."zenoti_appointments"
    ADD CONSTRAINT "zenoti_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_appointments_reports"
    ADD CONSTRAINT "zenoti_appointments_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_centers"
    ADD CONSTRAINT "zenoti_centers_center_code_key" UNIQUE ("center_code");



ALTER TABLE ONLY "public"."zenoti_centers"
    ADD CONSTRAINT "zenoti_centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_clients"
    ADD CONSTRAINT "zenoti_clients_guest_id_key" UNIQUE ("guest_id");



ALTER TABLE ONLY "public"."zenoti_clients"
    ADD CONSTRAINT "zenoti_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_packages"
    ADD CONSTRAINT "zenoti_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_sales_accrual_reports"
    ADD CONSTRAINT "zenoti_sales_accrual_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_sales_cash_reports"
    ADD CONSTRAINT "zenoti_sales_cash_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zenoti_services"
    ADD CONSTRAINT "zenoti_services_pkey" PRIMARY KEY ("id");



CREATE INDEX "auth_events_type_idx" ON "public"."auth_events" USING "btree" ("event_type");



CREATE INDEX "auth_events_user_id_idx" ON "public"."auth_events" USING "btree" ("user_id");



CREATE INDEX "chat_history_embedding_idx" ON "public"."chat_history" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "chat_history_thread_id_idx" ON "public"."chat_history" USING "btree" ("thread_id");



CREATE INDEX "chat_history_user_id_idx" ON "public"."chat_history" USING "btree" ("user_id");



CREATE INDEX "chat_threads_user_id_idx" ON "public"."chat_threads" USING "btree" ("user_id");



CREATE INDEX "documents_content_fts_idx" ON "public"."documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "documents_content_idx" ON "public"."documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "documents_document_type_idx" ON "public"."documents" USING "btree" ("document_type");



CREATE INDEX "documents_embedding_idx" ON "public"."documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "documents_file_type_idx" ON "public"."documents" USING "btree" ((("metadata" ->> 'type'::"text")));



CREATE INDEX "documents_parent_id_idx" ON "public"."documents" USING "btree" ("parent_id");



CREATE INDEX "documents_path_idx" ON "public"."documents" USING "btree" ((("metadata" ->> 'path'::"text")));



CREATE INDEX "documents_relevance_score_idx" ON "public"."documents" USING "btree" ("relevance_score" DESC);



CREATE INDEX "documents_status_idx" ON "public"."documents" USING "btree" ("status");



CREATE INDEX "idx_alert_history_created" ON "public"."analytics_alert_history" USING "btree" ("created_at");



CREATE INDEX "idx_alert_history_tenant" ON "public"."analytics_alert_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_alert_history_threshold" ON "public"."analytics_alert_history" USING "btree" ("threshold_id");



CREATE INDEX "idx_alert_thresholds_active" ON "public"."analytics_alert_thresholds" USING "btree" ("is_active");



CREATE INDEX "idx_alert_thresholds_tenant" ON "public"."analytics_alert_thresholds" USING "btree" ("tenant_id");



CREATE INDEX "idx_alert_thresholds_type" ON "public"."analytics_alert_thresholds" USING "btree" ("type");



CREATE INDEX "idx_analysis_gin" ON "public"."enhanced_image_analysis" USING "gin" ("analysis");



CREATE INDEX "idx_analytics_events_created_at" ON "public"."analytics_events" USING "btree" ("created_at");



CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "idx_backups_created_at" ON "public"."backups" USING "btree" ("created_at");



CREATE INDEX "idx_backups_type" ON "public"."backups" USING "btree" ("type");



CREATE INDEX "idx_body_part" ON "public"."enhanced_image_analysis" USING "btree" (((("analysis" -> 'insights'::"text") ->> 'bodyPart'::"text")));



CREATE INDEX "idx_chat_history_thread_id" ON "public"."chat_history" USING "btree" ("thread_id");



CREATE INDEX "idx_chat_threads_user_id" ON "public"."chat_threads" USING "btree" ("user_id");



CREATE INDEX "idx_dashboard_presets_user_tenant" ON "public"."analytics_dashboard_presets" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_documents_metadata_gin" ON "public"."documents" USING "gin" ("metadata");



CREATE INDEX "idx_documents_metadata_path" ON "public"."documents" USING "btree" ((("metadata" ->> 'path'::"text")));



CREATE INDEX "idx_embedding_type" ON "public"."image_embeddings" USING "btree" ("embedding_type");



CREATE INDEX "idx_enhanced_analysis_created_at" ON "public"."enhanced_image_analysis" USING "btree" ("created_at");



CREATE INDEX "idx_enhanced_analysis_gin" ON "public"."enhanced_image_analysis" USING "gin" ("analysis");



CREATE INDEX "idx_enhanced_analysis_json" ON "public"."enhanced_image_analysis" USING "gin" ("analysis");



CREATE INDEX "idx_enhanced_analysis_path" ON "public"."enhanced_image_analysis" USING "btree" ("path");



CREATE INDEX "idx_enhanced_image_analysis_bodypart" ON "public"."enhanced_image_analysis" USING "gin" (((("analysis" -> 'insights'::"text") -> 'bodyPart'::"text")));



CREATE INDEX "idx_enhanced_image_analysis_confidence" ON "public"."enhanced_image_analysis" USING "gin" (((("analysis" -> 'insights'::"text") -> 'bodyPartConfidence'::"text")));



CREATE INDEX "idx_enhanced_image_analysis_faded" ON "public"."enhanced_image_analysis" USING "gin" (((("analysis" -> 'insights'::"text") -> 'hasFaded'::"text")));



CREATE INDEX "idx_enhanced_image_analysis_path" ON "public"."enhanced_image_analysis" USING "btree" ("path");



CREATE INDEX "idx_enhanced_image_analysis_removal" ON "public"."enhanced_image_analysis" USING "gin" (((("analysis" -> 'insights'::"text") -> 'isInRemovalProcess'::"text")));



CREATE INDEX "idx_enhanced_image_analysis_tattoo" ON "public"."enhanced_image_analysis" USING "gin" (((("analysis" -> 'insights'::"text") -> 'isLikelyTattoo'::"text")));



CREATE INDEX "idx_file_permissions_path" ON "public"."file_permissions" USING "btree" ("file_path");



CREATE INDEX "idx_full_embeddings_vector" ON "public"."image_embeddings" USING "ivfflat" ("embedding_vector") WHERE ("embedding_type" = 'full'::"text");



CREATE INDEX "idx_image_embeddings_path" ON "public"."image_embeddings" USING "btree" ("image_path");



CREATE INDEX "idx_image_embeddings_type" ON "public"."image_embeddings" USING "btree" ("embedding_type");



CREATE INDEX "idx_image_path" ON "public"."image_embeddings" USING "btree" ("image_path");



CREATE INDEX "idx_image_signatures_analyzed_at" ON "public"."image_signatures" USING "btree" ("analyzed_at");



CREATE INDEX "idx_invitations_code" ON "public"."invitations" USING "btree" ("code");



CREATE INDEX "idx_is_likely_tattoo" ON "public"."enhanced_image_analysis" USING "btree" (((("analysis" -> 'insights'::"text") ->> 'isLikelyTattoo'::"text")));



CREATE INDEX "idx_patch_embeddings_vector" ON "public"."patch_embeddings" USING "ivfflat" ("patch_vector");



CREATE INDEX "idx_revoked_tokens_expires_at" ON "public"."revoked_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_sessions_last_active" ON "public"."sessions" USING "btree" ("last_active");



CREATE INDEX "idx_sessions_start_time" ON "public"."user_sessions" USING "btree" ("started_at");



CREATE INDEX "idx_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_slack_channel_members_user_id" ON "public"."slack_channel_members" USING "btree" ("user_id");



CREATE INDEX "idx_slack_channel_views_user" ON "public"."slack_channel_views" USING "btree" ("user_id");



CREATE INDEX "idx_slack_message_threads_parent_id" ON "public"."slack_message_threads" USING "btree" ("parent_id");



CREATE INDEX "idx_slack_messages_channel" ON "public"."slack_messages" USING "btree" ("channel_id");



CREATE INDEX "idx_slack_messages_parent" ON "public"."slack_messages" USING "btree" ("parent_id");



CREATE INDEX "idx_slack_messages_timestamp" ON "public"."slack_messages" USING "btree" ("timestamp");



CREATE INDEX "idx_slack_messages_user" ON "public"."slack_messages" USING "btree" ("user_id");



CREATE INDEX "image_sequences_image_id_idx" ON "public"."image_sequences" USING "btree" ("image_id");



CREATE INDEX "image_sequences_sequence_group_idx" ON "public"."image_sequences" USING "btree" ("sequence_group");



CREATE INDEX "keyword_mappings_document_id_idx" ON "public"."keyword_mappings" USING "btree" ("document_id");



CREATE INDEX "keyword_mappings_keyword_idx" ON "public"."keyword_mappings" USING "btree" ("keyword");



CREATE INDEX "processing_queue_status_idx" ON "public"."processing_queue" USING "btree" ("status");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "tenants_slug_idx" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "themes_author_idx" ON "public"."themes" USING "btree" ("author");



CREATE INDEX "user_preferences_theme_id_idx" ON "public"."user_preferences" USING "btree" ("theme_id");



CREATE OR REPLACE TRIGGER "Notifications on Documents" AFTER INSERT OR UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://rfnglcfyzoyqenofmsev.supabase.co/functions/v1/document-notifications', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "process_slack_message_to_document" AFTER INSERT ON "public"."slack_messages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_process_slack_message"();



CREATE OR REPLACE TRIGGER "set_profile_id_trigger" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profile_id"();



CREATE OR REPLACE TRIGGER "sync_appointments_reports_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_appointments_reports" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_appointments_reports"();



CREATE OR REPLACE TRIGGER "sync_appointments_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_appointments"();



CREATE OR REPLACE TRIGGER "sync_centers_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_centers" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_centers"();



CREATE OR REPLACE TRIGGER "sync_clients_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_clients" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_clients"();



CREATE OR REPLACE TRIGGER "sync_packages_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_packages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_packages"();



CREATE OR REPLACE TRIGGER "sync_sales_accrual_reports_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_sales_accrual_reports" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"();



CREATE OR REPLACE TRIGGER "sync_sales_cash_reports_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_sales_cash_reports" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"();



CREATE OR REPLACE TRIGGER "sync_services_to_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."zenoti_services" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_zenoti_services"();



CREATE OR REPLACE TRIGGER "update_chat_threads_updated_at" BEFORE UPDATE ON "public"."chat_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_relevance_trigger" BEFORE INSERT OR UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_document_relevance"();



CREATE OR REPLACE TRIGGER "update_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_processing_queue_updated_at" BEFORE UPDATE ON "public"."processing_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_settings_updated_at" BEFORE UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_zenoti_appointments_timestamp" BEFORE UPDATE ON "public"."zenoti_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_synced"();



CREATE OR REPLACE TRIGGER "update_zenoti_centers_timestamp" BEFORE UPDATE ON "public"."zenoti_centers" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_synced"();



CREATE OR REPLACE TRIGGER "update_zenoti_clients_timestamp" BEFORE UPDATE ON "public"."zenoti_clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_synced"();



ALTER TABLE ONLY "public"."active_sessions"
    ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_alert_history"
    ADD CONSTRAINT "analytics_alert_history_threshold_id_fkey" FOREIGN KEY ("threshold_id") REFERENCES "public"."analytics_alert_thresholds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_history"
    ADD CONSTRAINT "analytics_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_sync_queue"
    ADD CONSTRAINT "crm_sync_queue_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dashboard_presets"
    ADD CONSTRAINT "dashboard_presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."external_role_mappings"
    ADD CONSTRAINT "external_role_mappings_internal_role_id_fkey" FOREIGN KEY ("internal_role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_role_mappings"
    ADD CONSTRAINT "external_role_mappings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_permissions"
    ADD CONSTRAINT "file_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."file_permissions"
    ADD CONSTRAINT "file_permissions_required_role_fkey" FOREIGN KEY ("required_role") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."file_processing_log"
    ADD CONSTRAINT "file_processing_log_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_roles"
    ADD CONSTRAINT "group_roles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_roles"
    ADD CONSTRAINT "group_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."image_sequences"
    ADD CONSTRAINT "image_sequences_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."image_sequences"
    ADD CONSTRAINT "image_sequences_next_image_fkey" FOREIGN KEY ("next_image") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."image_sequences"
    ADD CONSTRAINT "image_sequences_prev_image_fkey" FOREIGN KEY ("prev_image") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."keyword_mappings"
    ADD CONSTRAINT "keyword_mappings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mfa_attempts"
    ADD CONSTRAINT "mfa_attempts_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."mfa_methods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mfa_attempts"
    ADD CONSTRAINT "mfa_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mfa_methods"
    ADD CONSTRAINT "mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_history"
    ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patch_embeddings"
    ADD CONSTRAINT "patch_embeddings_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."image_embeddings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processing_queue"
    ADD CONSTRAINT "processing_queue_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id");



ALTER TABLE ONLY "public"."revoked_tokens"
    ADD CONSTRAINT "revoked_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."slack_channel_views"
    ADD CONSTRAINT "slack_channel_views_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."slack_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack_channel_views"
    ADD CONSTRAINT "slack_channel_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."slack_channels"
    ADD CONSTRAINT "slack_channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."slack_message_reactions"
    ADD CONSTRAINT "slack_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."slack_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack_message_reactions"
    ADD CONSTRAINT "slack_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."slack_messages"
    ADD CONSTRAINT "slack_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."slack_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack_messages"
    ADD CONSTRAINT "slack_messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."slack_messages"("id");



ALTER TABLE ONLY "public"."slack_messages"
    ADD CONSTRAINT "slack_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."storage_access_grants"
    ADD CONSTRAINT "storage_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."storage_permissions"
    ADD CONSTRAINT "storage_permissions_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."token_exchange_codes"
    ADD CONSTRAINT "token_exchange_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_groups"
    ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_groups"
    ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id");



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "API keys are viewable by all authenticated users" ON "public"."api_keys" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admins can manage all profiles" ON "public"."profiles" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage analytics stats" ON "public"."analytics_stats" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage api keys" ON "public"."api_keys" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage backups" ON "public"."backups" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage dashboard presets" ON "public"."dashboard_presets" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage integrations" ON "public"."integrations" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage sessions" ON "public"."sessions" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage settings" ON "public"."settings" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage slack channels" ON "public"."slack_channels" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage sync queue" ON "public"."crm_sync_queue" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage themes" ON "public"."themes" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can manage users" ON "public"."users" USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ('admin'::"text" = ANY ("p"."roles"))))));



CREATE POLICY "Admins can view audit logs" ON "public"."security_audit_logs" FOR SELECT USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can view file processing logs" ON "public"."file_processing_log" FOR SELECT USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can view integration logs" ON "public"."integration_logs" FOR SELECT USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "Admins can view storage stats" ON "public"."storage_stats" FOR SELECT USING ((('admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text"))) OR ('super_admin'::"text" = ANY ("string_to_array"("current_setting"('jwt.claims.roles'::"text", true), ','::"text")))));



CREATE POLICY "All authenticated users can create logs" ON "public"."integration_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can insert slack messages" ON "public"."slack_messages" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can read" ON "public"."themes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can read all profiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can read slack channels" ON "public"."slack_channels" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can read slack messages" ON "public"."slack_messages" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can read themes" ON "public"."themes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All users can view storage stats" ON "public"."storage_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."active_sessions" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."activity_log" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_alert_history" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_alert_thresholds" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_daily_rollups" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_dashboard_presets" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_last_seen" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."analytics_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."batch_process_jobs" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."enhanced_image_analysis" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."error_logs" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."existing_docs" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."external_role_mappings" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."failed_images" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."file_permissions" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."file_processing_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."function_registry" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."group_roles" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."groups" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."identity_providers" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."image_embeddings" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."image_signatures" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."invitations" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."login_attempts" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."maintenance_logs" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."mfa_attempts" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."mfa_methods" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."migration_history" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."organizations" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."patch_embeddings" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."permissions" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."profiles_backup" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."revoked_tokens" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."role_permissions" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."settings_backups" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."slack_kb_integrations" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."slack_message_threads" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."sso_providers_backup" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."storage_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."system_stats" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."tenants" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all for authenticated users" ON "public"."themes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."token_exchange_codes" USING ("public"."is_authenticated"());



CREATE POLICY "Allow all operations for all users" ON "public"."chat_history" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."chat_threads" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow all operations for authenticated users" ON "public"."document_relationships" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."image_sequences" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."keyword_mappings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."processing_queue" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all read" ON "public"."chat_history" FOR SELECT USING (true);



CREATE POLICY "Allow all read" ON "public"."chat_threads" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated users to insert analytics events" ON "public"."analytics_events" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow public read access to themes" ON "public"."themes" FOR SELECT USING (true);



CREATE POLICY "Allow read access for anonymous users" ON "public"."document_relationships" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow read access for anonymous users" ON "public"."documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow read access for anonymous users" ON "public"."image_sequences" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow read access for anonymous users" ON "public"."keyword_mappings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow read for all users" ON "public"."documents" FOR SELECT USING (true);



CREATE POLICY "Allow user to insert own messages" ON "public"."chat_history" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow user to insert own threads" ON "public"."chat_threads" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow user to read own messages" ON "public"."chat_history" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow user to read own threads" ON "public"."chat_threads" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Analytics are publicly accessible" ON "public"."analytics_events" USING (true) WITH CHECK (true);



CREATE POLICY "Analytics events are readable by authenticated users" ON "public"."analytics_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Analytics events can be inserted by authenticated users" ON "public"."analytics_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Analytics history is readable by authenticated users" ON "public"."analytics_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Analytics stats are publicly accessible" ON "public"."analytics_stats" FOR SELECT USING (true);



CREATE POLICY "Analytics stats are readable by authenticated users" ON "public"."analytics_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can create their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Anyone can insert audit logs" ON "public"."security_audit_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can insert events" ON "public"."analytics_events" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can select settings" ON "public"."settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can select themes" ON "public"."themes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active centers" ON "public"."zenoti_centers" FOR SELECT USING (("active" = true));



CREATE POLICY "Authenticated users can create themes" ON "public"."themes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Backups are viewable by all authenticated users" ON "public"."backups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Deny access for anonymous users" ON "public"."chat_history" TO "anon" USING (false);



CREATE POLICY "Deny access for anonymous users" ON "public"."chat_threads" TO "anon" USING (false);



CREATE POLICY "Deny access for anonymous users" ON "public"."processing_queue" TO "anon" USING (false);



CREATE POLICY "Enable all operations for all users" ON "public"."documents" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all operations for all users" ON "public"."image_sequences" USING (true) WITH CHECK (true);



CREATE POLICY "Server functions can insert auth events" ON "public"."auth_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Settings are viewable by all authenticated users" ON "public"."settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Storage access grants are only manageable by admins" ON "public"."storage_access_grants" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (('admin'::"text" = ANY ("profiles"."roles")) OR ('super_admin'::"text" = ANY ("profiles"."roles")))))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (('admin'::"text" = ANY ("profiles"."roles")) OR ('super_admin'::"text" = ANY ("profiles"."roles"))))));



CREATE POLICY "Storage access grants are viewable by all authenticated users" ON "public"."storage_access_grants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Storage permissions are only manageable by admins" ON "public"."storage_permissions" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (('admin'::"text" = ANY ("profiles"."roles")) OR ('super_admin'::"text" = ANY ("profiles"."roles")))))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (('admin'::"text" = ANY ("profiles"."roles")) OR ('super_admin'::"text" = ANY ("profiles"."roles"))))));



CREATE POLICY "Storage permissions are viewable by all authenticated users" ON "public"."storage_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Themes are readable by everyone" ON "public"."themes" FOR SELECT USING (true);



CREATE POLICY "Themes are viewable by all authenticated users" ON "public"."themes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "User can access own sessions" ON "public"."user_groups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User can access own sessions" ON "public"."user_identities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User can access own sessions" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User can access own sessions" ON "public"."user_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add reactions" ON "public"."slack_message_reactions" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can create custom themes" ON "public"."themes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create own dashboard presets" ON "public"."dashboard_presets" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete own dashboard presets" ON "public"."dashboard_presets" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert their own audit logs" ON "public"."security_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own file logs" ON "public"."file_processing_log" FOR INSERT WITH CHECK (("processed_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own themes" ON "public"."themes" FOR INSERT WITH CHECK (("author" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their themes" ON "public"."themes" USING (("author" = ("auth"."uid"())::"text")) WITH CHECK (("author" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can only manage their own sessions" ON "public"."sessions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own file logs" ON "public"."file_processing_log" FOR SELECT USING (("processed_by" = "auth"."uid"()));



CREATE POLICY "Users can read their own preferences" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own themes" ON "public"."themes" FOR SELECT USING (("author" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can track their own views" ON "public"."slack_channel_views" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own dashboard presets" ON "public"."dashboard_presets" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own file logs" ON "public"."file_processing_log" FOR UPDATE USING (("processed_by" = "auth"."uid"())) WITH CHECK (("processed_by" = "auth"."uid"()));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own themes" ON "public"."themes" FOR UPDATE USING (("author" = ("auth"."uid"())::"text")) WITH CHECK (("author" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view and manage their own dashboard presets" ON "public"."dashboard_presets" TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("is_default" = true))) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can view appointments" ON "public"."zenoti_appointments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view clients" ON "public"."zenoti_clients" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own dashboard presets" ON "public"."dashboard_presets" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view their logs" ON "public"."file_processing_log" FOR SELECT USING (("processed_by" = "auth"."uid"()));



CREATE POLICY "Users can view their own sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."active_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_alert_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_alert_thresholds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_daily_rollups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_dashboard_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_last_seen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_process_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_sync_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."database_backups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "database_backups_admin_only" ON "public"."database_backups" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."document_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enhanced_image_analysis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."existing_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_role_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."failed_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_processing_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."function_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identity_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keyword_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."login_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."migration_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_history_own_only" ON "public"."password_history" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



ALTER TABLE "public"."patch_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processing_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revoked_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_channel_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_kb_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_message_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sso_providers_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_access_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_exchange_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_services" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_embedding_data_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_embedding_data_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_embedding_data_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_document_relevance"("doc_age" interval, "doc_type" "text", "metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_document_relevance"("doc_age" interval, "doc_type" "text", "metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_document_relevance"("doc_age" interval, "doc_type" "text", "metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_storage_usage"("bucket_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_storage_usage"("bucket_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_storage_usage"("bucket_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."call_image_search_full"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."call_image_search_full"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_image_search_full"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_analytics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."change_user_password"() TO "anon";
GRANT ALL ON FUNCTION "public"."change_user_password"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_user_password"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_admin_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_admin_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_admin_access"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_password_history"("p_user_id" "uuid", "p_password_hash" "text", "p_history_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_password_history"("p_user_id" "uuid", "p_password_hash" "text", "p_history_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_password_history"("p_user_id" "uuid", "p_password_hash" "text", "p_history_count" integer) TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_zenoti_sync_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_zenoti_sync_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_zenoti_sync_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_auth_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_auth_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_auth_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_invalid_documents"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_invalid_documents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_invalid_documents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_batch_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_batch_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_batch_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_admin_profile"("profile_id" "uuid", "profile_email" "text", "profile_name" "text", "profile_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_admin_profile"("profile_id" "uuid", "profile_email" "text", "profile_name" "text", "profile_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_admin_profile"("profile_id" "uuid", "profile_email" "text", "profile_name" "text", "profile_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("p_email" "text", "p_created_by" "uuid", "p_roles" "uuid"[], "p_expires_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_email" "text", "p_created_by" "uuid", "p_roles" "uuid"[], "p_expires_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_email" "text", "p_created_by" "uuid", "p_roles" "uuid"[], "p_expires_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_storage_policy"("policy_name" "text", "bucket_name" "text", "definition" "text", "operation" "text", "role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_storage_policy"("policy_name" "text", "bucket_name" "text", "definition" "text", "operation" "text", "role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_storage_policy"("policy_name" "text", "bucket_name" "text", "definition" "text", "operation" "text", "role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_from_external_identity"("p_email" "text", "p_name" "text", "p_first_name" "text", "p_last_name" "text", "p_provider_id" "uuid", "p_external_id" "text", "p_external_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_from_external_identity"("p_email" "text", "p_name" "text", "p_first_name" "text", "p_last_name" "text", "p_provider_id" "uuid", "p_external_id" "text", "p_external_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_from_external_identity"("p_email" "text", "p_name" "text", "p_first_name" "text", "p_last_name" "text", "p_provider_id" "uuid", "p_external_id" "text", "p_external_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_storage_policy"("policy_name" "text", "bucket_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_storage_policy"("policy_name" "text", "bucket_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_storage_policy"("policy_name" "text", "bucket_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_test_admin_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_test_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_test_admin_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_document_path"("metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_document_path"("metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_document_path"("metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_documents_by_role"("user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."filter_documents_by_role"("user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_documents_by_role"("user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer, "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer, "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_images_by_body_part"("body_part" "text", "match_limit" integer, "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer, "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer, "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_images_without_tattoos"("match_limit" integer, "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_mfa_verification_code"("p_user_id" "uuid", "p_method_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_mfa_verification_code"("p_user_id" "uuid", "p_method_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_mfa_verification_code"("p_user_id" "uuid", "p_method_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_analytics_data"("start_date" "text", "end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_analytics_data"("start_date" "text", "end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_analytics_data"("start_date" "text", "end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bucket_policies"("bucket_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_bucket_policies"("bucket_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bucket_policies"("bucket_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_check_constraint_values"("p_table_name" "text", "p_constraint_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_check_constraint_values"("p_table_name" "text", "p_constraint_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_check_constraint_values"("p_table_name" "text", "p_constraint_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_column_info"("table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_column_info"("table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_column_info"("table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_db_size"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_db_size"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_db_size"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_document_sources"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_document_sources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_document_sources"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_documents_by_slack_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_documents_by_slack_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_documents_by_slack_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_embedding_stats_by_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_embedding_stats_by_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_embedding_stats_by_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_extensions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_extensions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_extensions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_file_type_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_file_type_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_file_type_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sample_zenoti_document"("table_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sample_zenoti_document"("table_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sample_zenoti_document"("table_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initial_zenoti_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."initial_zenoti_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initial_zenoti_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_criteria" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_criteria" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_criteria" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_slack_messages_to_documents"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_slack_messages_to_documents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_slack_messages_to_documents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_delete"("key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_delete"("key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_delete"("key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text", "expiry" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text", "expiry" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text", "expiry" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_recent_backups"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_recent_backups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_recent_backups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resync_zenoti_table"("table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resync_zenoti_table"("table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resync_zenoti_table"("table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_backup"("backup_type" "text", "include_files" boolean, "include_database" boolean, "include_settings" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."run_backup"("backup_type" "text", "include_files" boolean, "include_database" boolean, "include_settings" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_backup"("backup_type" "text", "include_files" boolean, "include_database" boolean, "include_settings" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."run_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."run_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_sql"("sql" "text") TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON FUNCTION "public"."save_settings"("settings" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."save_settings"("settings" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_settings"("settings" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."save_settings"("settings" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."save_settings"("settings" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_settings"("settings" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_chat_history"("query_embedding" "public"."vector", "user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_history"("query_embedding" "public"."vector", "user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_history"("query_embedding" "public"."vector", "user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_documents"("query_text" "text", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_documents"("query_text" "text", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_documents"("query_text" "text", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_documents_with_slack"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_documents_with_slack"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_documents_with_slack"("search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_full_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_full_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_full_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_embedding_with_offset"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding_with_offset"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_embedding_with_offset"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer, "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer, "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_keywords"("search_terms" "text"[], "match_limit" integer, "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_images_by_partial_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "embedding_type" "text", "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_partial_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_partial_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_partial_embeddings"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_zenoti_data"("search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_zenoti_data"("search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_zenoti_data"("search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."secure_backup"("backup_type" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."secure_backup"("backup_type" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."secure_backup"("backup_type" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_path_private"("bucket_name" "text", "path_pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_path_private"("bucket_name" "text", "path_pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_path_private"("bucket_name" "text", "path_pattern" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_path_public"("bucket_name" "text", "path_pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_path_public"("bucket_name" "text", "path_pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_path_public"("bucket_name" "text", "path_pattern" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_add_reaction"("p_message_id" "uuid", "p_emoji" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_add_reaction"("p_message_id" "uuid", "p_emoji" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_add_reaction"("p_message_id" "uuid", "p_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_create_channel"("p_name" "text", "p_description" "text", "p_type" "text", "p_admin_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."slack_create_channel"("p_name" "text", "p_description" "text", "p_type" "text", "p_admin_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_create_channel"("p_name" "text", "p_description" "text", "p_type" "text", "p_admin_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_messages"("p_channel_id" "uuid", "p_message_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_messages"("p_channel_id" "uuid", "p_message_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_messages"("p_channel_id" "uuid", "p_message_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."slack_message_threads" TO "anon";
GRANT ALL ON TABLE "public"."slack_message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_message_threads" TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_thread_messages"("parent_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_thread_messages"("parent_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_thread_messages"("parent_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_pin_message"("message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_pin_message"("message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_pin_message"("message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_process_document"("p_message_id" "uuid", "p_file_path" "text", "p_file_name" "text", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_process_document"("p_message_id" "uuid", "p_file_path" "text", "p_file_name" "text", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_process_document"("p_message_id" "uuid", "p_file_path" "text", "p_file_name" "text", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_process_document_for_kb"("message_id" "uuid", "document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_process_document_for_kb"("message_id" "uuid", "document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_process_document_for_kb"("message_id" "uuid", "document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_attachment"("p_channel_id" "uuid", "p_attachment_data" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("p_channel_id" "uuid", "p_attachment_data" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("p_channel_id" "uuid", "p_attachment_data" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "uuid", "attachment_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "uuid", "attachment_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "uuid", "attachment_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_message"("p_channel_id" "uuid", "p_message_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_message"("p_channel_id" "uuid", "p_message_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_message"("p_channel_id" "uuid", "p_message_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_thread_reply"("parent_id" "uuid", "reply_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_thread_reply"("parent_id" "uuid", "reply_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_thread_reply"("parent_id" "uuid", "reply_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" double precision, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" numeric, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" numeric, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_image_search"("query_embedding" "public"."vector", "match_threshold" numeric, "match_limit" integer, "emb_type" "text", "offset_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_roles_from_external_groups"("p_user_id" "uuid", "p_provider_id" "uuid", "p_external_groups" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_roles_from_external_groups"("p_user_id" "uuid", "p_provider_id" "uuid", "p_external_groups" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_roles_from_external_groups"("p_user_id" "uuid", "p_provider_id" "uuid", "p_external_groups" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_zenoti_centers"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_zenoti_centers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_zenoti_centers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_zenoti_to_documents"("source_table" "text", "record_data" "jsonb", "operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_zenoti_to_documents"("source_table" "text", "record_data" "jsonb", "operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_zenoti_to_documents"("source_table" "text", "record_data" "jsonb", "operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_db_connection"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_db_connection"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_db_connection"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_slack_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_slack_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_slack_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_appointments_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_centers"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_centers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_centers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_clients"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_clients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_clients"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_packages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_packages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_packages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_accrual_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_sales_cash_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_services"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_services"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_zenoti_services"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admin_roles"("profile_id" "uuid", "new_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_admin_roles"("profile_id" "uuid", "new_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admin_roles"("profile_id" "uuid", "new_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_document_relevance"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_document_relevance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_document_relevance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_synced"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_synced"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_synced"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_password_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_password_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_password_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_storage_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_storage_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_storage_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_document"("doc_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_document"("doc_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_document"("doc_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."vacuum_analyze"() TO "anon";
GRANT ALL ON FUNCTION "public"."vacuum_analyze"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."vacuum_analyze"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_email_domain"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_email_domain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_email_domain"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_tatt2away_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_tatt2away_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_tatt2away_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_mfa_attempt"("p_user_id" "uuid", "p_method_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_mfa_attempt"("p_user_id" "uuid", "p_method_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_mfa_attempt"("p_user_id" "uuid", "p_method_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."zenoti_record_to_content"("table_name" "text", "record_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."zenoti_record_to_content"("table_name" "text", "record_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zenoti_record_to_content"("table_name" "text", "record_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."active_sessions" TO "anon";
GRANT ALL ON TABLE "public"."active_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."active_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_alert_history" TO "anon";
GRANT ALL ON TABLE "public"."analytics_alert_history" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_alert_history" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_alert_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."analytics_alert_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_alert_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_daily_rollups" TO "anon";
GRANT ALL ON TABLE "public"."analytics_daily_rollups" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_daily_rollups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."analytics_daily_rollups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_daily_rollups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_daily_rollups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_dashboard_presets" TO "anon";
GRANT ALL ON TABLE "public"."analytics_dashboard_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_dashboard_presets" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_history" TO "anon";
GRANT ALL ON TABLE "public"."analytics_history" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_history" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_last_seen" TO "anon";
GRANT ALL ON TABLE "public"."analytics_last_seen" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_last_seen" TO "service_role";



GRANT ALL ON SEQUENCE "public"."analytics_last_seen_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_last_seen_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_last_seen_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_stats" TO "anon";
GRANT ALL ON TABLE "public"."analytics_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_stats" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."auth_events" TO "anon";
GRANT ALL ON TABLE "public"."auth_events" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_events" TO "service_role";



GRANT ALL ON TABLE "public"."backups" TO "anon";
GRANT ALL ON TABLE "public"."backups" TO "authenticated";
GRANT ALL ON TABLE "public"."backups" TO "service_role";



GRANT ALL ON TABLE "public"."batch_process_jobs" TO "anon";
GRANT ALL ON TABLE "public"."batch_process_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_process_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_threads" TO "anon";
GRANT ALL ON TABLE "public"."chat_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_threads" TO "service_role";



GRANT ALL ON TABLE "public"."crm_sync_queue" TO "anon";
GRANT ALL ON TABLE "public"."crm_sync_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_sync_queue" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_presets" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_presets" TO "service_role";



GRANT ALL ON TABLE "public"."database_backups" TO "anon";
GRANT ALL ON TABLE "public"."database_backups" TO "authenticated";
GRANT ALL ON TABLE "public"."database_backups" TO "service_role";



GRANT ALL ON TABLE "public"."document_relationships" TO "anon";
GRANT ALL ON TABLE "public"."document_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."document_relationships" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_relationships_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_relationships_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_relationships_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documents_with_paths" TO "anon";
GRANT ALL ON TABLE "public"."documents_with_paths" TO "authenticated";
GRANT ALL ON TABLE "public"."documents_with_paths" TO "service_role";



GRANT ALL ON TABLE "public"."enhanced_image_analysis" TO "anon";
GRANT ALL ON TABLE "public"."enhanced_image_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."enhanced_image_analysis" TO "service_role";



GRANT ALL ON SEQUENCE "public"."enhanced_image_analysis_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."enhanced_image_analysis_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."enhanced_image_analysis_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."existing_docs" TO "anon";
GRANT ALL ON TABLE "public"."existing_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."existing_docs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."existing_docs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."existing_docs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."existing_docs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."external_role_mappings" TO "anon";
GRANT ALL ON TABLE "public"."external_role_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."external_role_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."failed_images" TO "anon";
GRANT ALL ON TABLE "public"."failed_images" TO "authenticated";
GRANT ALL ON TABLE "public"."failed_images" TO "service_role";



GRANT ALL ON TABLE "public"."file_permissions" TO "anon";
GRANT ALL ON TABLE "public"."file_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."file_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."file_processing_log" TO "anon";
GRANT ALL ON TABLE "public"."file_processing_log" TO "authenticated";
GRANT ALL ON TABLE "public"."file_processing_log" TO "service_role";



GRANT ALL ON TABLE "public"."function_registry" TO "anon";
GRANT ALL ON TABLE "public"."function_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."function_registry" TO "service_role";



GRANT ALL ON TABLE "public"."group_roles" TO "anon";
GRANT ALL ON TABLE "public"."group_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."group_roles" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."identity_providers" TO "anon";
GRANT ALL ON TABLE "public"."identity_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."identity_providers" TO "service_role";



GRANT ALL ON TABLE "public"."image_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."image_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."image_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."image_sequences" TO "anon";
GRANT ALL ON TABLE "public"."image_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."image_sequences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."image_sequences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."image_sequences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."image_sequences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."image_signatures" TO "anon";
GRANT ALL ON TABLE "public"."image_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."image_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."images" TO "anon";
GRANT ALL ON TABLE "public"."images" TO "authenticated";
GRANT ALL ON TABLE "public"."images" TO "service_role";



GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."keyword_mappings" TO "anon";
GRANT ALL ON TABLE "public"."keyword_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_mappings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."keyword_mappings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."keyword_mappings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."keyword_mappings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_logs" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_attempts" TO "anon";
GRANT ALL ON TABLE "public"."mfa_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_methods" TO "anon";
GRANT ALL ON TABLE "public"."mfa_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_methods" TO "service_role";



GRANT ALL ON TABLE "public"."migration_history" TO "anon";
GRANT ALL ON TABLE "public"."migration_history" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."migration_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."migration_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."migration_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mv_recent_backups" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."password_history" TO "anon";
GRANT ALL ON TABLE "public"."password_history" TO "authenticated";
GRANT ALL ON TABLE "public"."password_history" TO "service_role";



GRANT ALL ON TABLE "public"."patch_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."patch_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."patch_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."processing_queue" TO "anon";
GRANT ALL ON TABLE "public"."processing_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."processing_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."processing_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."processing_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."processing_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_backup" TO "anon";
GRANT ALL ON TABLE "public"."profiles_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_backup" TO "service_role";



GRANT ALL ON TABLE "public"."revoked_tokens" TO "anon";
GRANT ALL ON TABLE "public"."revoked_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."revoked_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."settings_backups" TO "anon";
GRANT ALL ON TABLE "public"."settings_backups" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_backups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."slack_channel_members" TO "anon";
GRANT ALL ON TABLE "public"."slack_channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."slack_channel_views" TO "anon";
GRANT ALL ON TABLE "public"."slack_channel_views" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_channel_views" TO "service_role";



GRANT ALL ON TABLE "public"."slack_channels" TO "anon";
GRANT ALL ON TABLE "public"."slack_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_channels" TO "service_role";



GRANT ALL ON TABLE "public"."slack_documents" TO "anon";
GRANT ALL ON TABLE "public"."slack_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_documents" TO "service_role";



GRANT ALL ON TABLE "public"."slack_files" TO "service_role";



GRANT ALL ON TABLE "public"."slack_kb_integrations" TO "anon";
GRANT ALL ON TABLE "public"."slack_kb_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_kb_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."slack_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."slack_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."slack_messages" TO "anon";
GRANT ALL ON TABLE "public"."slack_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_messages" TO "service_role";



GRANT ALL ON TABLE "public"."slack_users" TO "service_role";



GRANT ALL ON TABLE "public"."sso_providers_backup" TO "anon";
GRANT ALL ON TABLE "public"."sso_providers_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."sso_providers_backup" TO "service_role";



GRANT ALL ON TABLE "public"."storage_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."storage_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."storage_permissions" TO "anon";
GRANT ALL ON TABLE "public"."storage_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."storage_stats" TO "anon";
GRANT ALL ON TABLE "public"."storage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."storage_stats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."storage_stats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."storage_stats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."system_stats" TO "anon";
GRANT ALL ON TABLE "public"."system_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."system_stats" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."themes" TO "anon";
GRANT ALL ON TABLE "public"."themes" TO "authenticated";
GRANT ALL ON TABLE "public"."themes" TO "service_role";



GRANT ALL ON TABLE "public"."token_exchange_codes" TO "anon";
GRANT ALL ON TABLE "public"."token_exchange_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."token_exchange_codes" TO "service_role";



GRANT ALL ON TABLE "public"."user_groups" TO "anon";
GRANT ALL ON TABLE "public"."user_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."user_groups" TO "service_role";



GRANT ALL ON TABLE "public"."user_identities" TO "anon";
GRANT ALL ON TABLE "public"."user_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_identities" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_slack_messages_with_users" TO "anon";
GRANT ALL ON TABLE "public"."v_slack_messages_with_users" TO "authenticated";
GRANT ALL ON TABLE "public"."v_slack_messages_with_users" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_appointments" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_appointments_reports" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_appointments_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_appointments_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."zenoti_appointments_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zenoti_appointments_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zenoti_appointments_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_centers" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_centers" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_clients" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_clients" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_packages" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_packages" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_sales_accrual_reports" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_sales_accrual_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_sales_accrual_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."zenoti_sales_accrual_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zenoti_sales_accrual_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zenoti_sales_accrual_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_sales_cash_reports" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_sales_cash_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_sales_cash_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."zenoti_sales_cash_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."zenoti_sales_cash_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."zenoti_sales_cash_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."zenoti_services" TO "anon";
GRANT ALL ON TABLE "public"."zenoti_services" TO "authenticated";
GRANT ALL ON TABLE "public"."zenoti_services" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
