

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



CREATE OR REPLACE FUNCTION "public"."check_profile_exists"("user_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = user_email
  );
$$;


ALTER FUNCTION "public"."check_profile_exists"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_admin_profile"("user_id" "uuid", "email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (user_id, email, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."create_admin_profile"("user_id" "uuid", "email" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "role" "text" DEFAULT 'basic'::"text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_profiles_safe"() RETURNS SETOF "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT id, user_id, email, role, display_name, avatar_url, created_at, updated_at FROM public.profiles;
$$;


ALTER FUNCTION "public"."get_all_profiles_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile"("user_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT * FROM public.profiles WHERE user_id = get_user_profile.user_id;
$$;


ALTER FUNCTION "public"."get_user_profile"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_safe"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;


ALTER FUNCTION "public"."is_admin_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT id, content, metadata, 1 - (embedding <#> query_embedding) AS similarity
  FROM public.documents
  ORDER BY embedding <#> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_del"("key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- stub
END;
$$;


ALTER FUNCTION "public"."redis_del"("key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_del_pattern"("pattern" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- stub
END;
$$;


ALTER FUNCTION "public"."redis_del_pattern"("pattern" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_get"("key" "text") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT NULL::text;
$$;


ALTER FUNCTION "public"."redis_get"("key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_incr"("key" "text") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 1;
$$;


ALTER FUNCTION "public"."redis_incr"("key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_keys"("pattern" "text") RETURNS SETOF "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT NULL::text;
$$;


ALTER FUNCTION "public"."redis_keys"("pattern" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redis_set"("key" "text", "value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- stub
END;
$$;


ALTER FUNCTION "public"."redis_set"("key" "text", "value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_settings"("key" "text", "value" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.settings (key, value, updated_at)
  VALUES (key, value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."save_settings"("key" "text", "value" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_channels"() RETURNS TABLE("id" "text", "name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 'general' AS id, 'General' AS name;
$$;


ALTER FUNCTION "public"."slack_get_channels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_messages"("channel_id" "text") RETURNS TABLE("id" "text", "message" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT '1', 'Welcome to the channel!', now();
$$;


ALTER FUNCTION "public"."slack_get_messages"("channel_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_get_unread_count"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 0;
$$;


ALTER FUNCTION "public"."slack_get_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_attachment"("channel_id" "text", "file_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- stub
END;
$$;


ALTER FUNCTION "public"."slack_send_attachment"("channel_id" "text", "file_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slack_send_message"("channel_id" "text", "message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- stub
END;
$$;


ALTER FUNCTION "public"."slack_send_message"("channel_id" "text", "message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_roles"("user_id" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles SET role = new_role WHERE user_id = user_id;
END;
$$;


ALTER FUNCTION "public"."update_admin_roles"("user_id" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_stats" (
    "id" integer DEFAULT 1 NOT NULL,
    "active_users" integer DEFAULT 0,
    "queries_last_hour" integer DEFAULT 0,
    "error_rate" double precision DEFAULT 0,
    "avg_response_time" double precision DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."analytics_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "key" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "backup_type" "text" NOT NULL,
    "backup_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "thread_id" "uuid",
    "message" "text" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "conversation_title" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."claude_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "user_id" "uuid",
    "query_text" "text" NOT NULL,
    "response_data" "jsonb" NOT NULL,
    "sources_used" "text"[] DEFAULT '{}'::"text"[],
    "citations" "jsonb" DEFAULT '[]'::"jsonb",
    "research_duration" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", (("query_text" || ' '::"text") || ("response_data" ->> 'content'::"text")))) STORED
);


ALTER TABLE "public"."claude_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_source_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "cached_data" "jsonb" NOT NULL,
    "last_updated" timestamp without time zone DEFAULT "now"(),
    "expires_at" timestamp without time zone,
    "user_id" "uuid"
);


ALTER TABLE "public"."claude_source_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_contacts" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."file_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "text" NOT NULL,
    "user_id" "uuid",
    "role" "text" DEFAULT 'basic'::"text" NOT NULL,
    "can_view" boolean DEFAULT true,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_processing_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_processing_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "image_url" "text",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings_backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settings_id" "uuid",
    "backup_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "used_bytes" bigint DEFAULT 0,
    "quota_bytes" bigint DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."storage_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "is_custom" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."themes" OWNER TO "postgres";


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


ALTER TABLE ONLY "public"."zenoti_appointments_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_appointments_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zenoti_sales_accrual_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_sales_accrual_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."zenoti_sales_cash_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."zenoti_sales_cash_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_stats"
    ADD CONSTRAINT "analytics_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_threads"
    ADD CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_conversations"
    ADD CONSTRAINT "claude_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_responses"
    ADD CONSTRAINT "claude_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_source_cache"
    ADD CONSTRAINT "claude_source_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_source_cache"
    ADD CONSTRAINT "claude_source_cache_source_type_source_id_key" UNIQUE ("source_type", "source_id");



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_permissions"
    ADD CONSTRAINT "file_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_processing_log"
    ADD CONSTRAINT "file_processing_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_embeddings"
    ADD CONSTRAINT "image_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."settings_backups"
    ADD CONSTRAINT "settings_backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_stats"
    ADD CONSTRAINT "storage_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "documents_content_idx" ON "public"."documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "documents_document_type_idx" ON "public"."documents" USING "btree" ("document_type");



CREATE INDEX "documents_embedding_idx" ON "public"."documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "documents_file_type_idx" ON "public"."documents" USING "btree" ((("metadata" ->> 'type'::"text")));



CREATE INDEX "documents_parent_id_idx" ON "public"."documents" USING "btree" ("parent_id");



CREATE INDEX "documents_path_idx" ON "public"."documents" USING "btree" ((("metadata" ->> 'path'::"text")));



CREATE INDEX "documents_relevance_score_idx" ON "public"."documents" USING "btree" ("relevance_score" DESC);



CREATE INDEX "documents_status_idx" ON "public"."documents" USING "btree" ("status");



CREATE INDEX "idx_analytics_events_created_at" ON "public"."analytics_events" USING "btree" ("created_at");



CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "idx_chat_history_thread_id" ON "public"."chat_history" USING "btree" ("thread_id");



CREATE INDEX "idx_claude_responses_search" ON "public"."claude_responses" USING "gin" ("search_vector");



CREATE INDEX "idx_claude_responses_user" ON "public"."claude_responses" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_documents_metadata_gin" ON "public"."documents" USING "gin" ("metadata");



CREATE INDEX "idx_documents_metadata_path" ON "public"."documents" USING "btree" ((("metadata" ->> 'path'::"text")));



CREATE INDEX "idx_file_permissions_file_id" ON "public"."file_permissions" USING "btree" ("file_id");



CREATE INDEX "idx_file_permissions_user_id" ON "public"."file_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_source_cache_lookup" ON "public"."claude_source_cache" USING "btree" ("source_type", "source_id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_stats"
    ADD CONSTRAINT "analytics_stats_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_threads"
    ADD CONSTRAINT "chat_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claude_conversations"
    ADD CONSTRAINT "claude_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."claude_responses"
    ADD CONSTRAINT "claude_responses_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."claude_conversations"("id");



ALTER TABLE ONLY "public"."claude_responses"
    ADD CONSTRAINT "claude_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."claude_source_cache"
    ADD CONSTRAINT "claude_source_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."file_permissions"
    ADD CONSTRAINT "file_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings_backups"
    ADD CONSTRAINT "settings_backups_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "public"."settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_stats"
    ADD CONSTRAINT "storage_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "All users can insert analytics events" ON "public"."analytics_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "All users can view file processing log" ON "public"."file_processing_log" FOR SELECT USING (true);



CREATE POLICY "All users can view image embeddings" ON "public"."image_embeddings" FOR SELECT USING (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow read access for anonymous users" ON "public"."documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can view active centers" ON "public"."zenoti_centers" FOR SELECT USING (("active" = true));



CREATE POLICY "Enable all operations for all users" ON "public"."documents" USING (true) WITH CHECK (true);



CREATE POLICY "Super Admins can manage all file permissions" ON "public"."file_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super Admins can manage all profiles" ON "public"."profiles" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super Admins can manage settings" ON "public"."settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super Admins can view all backups" ON "public"."backups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super Admins can view settings backups" ON "public"."settings_backups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super Admins/Admins can update analytics stats" ON "public"."analytics_stats" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Super Admins/Admins can view all analytics events" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can access their own contacts" ON "public"."crm_contacts" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can access their own conversations" ON "public"."claude_conversations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can access their own responses" ON "public"."claude_responses" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can access their own source cache" ON "public"."claude_source_cache" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can manage their API keys" ON "public"."api_keys" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their chat history" ON "public"."chat_history" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their chat threads" ON "public"."chat_threads" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their file permissions" ON "public"."file_permissions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their themes" ON "public"."themes" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their profile" ON "public"."profiles" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their storage stats" ON "public"."storage_stats" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view appointments" ON "public"."zenoti_appointments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view clients" ON "public"."zenoti_clients" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their analytics events" ON "public"."analytics_events" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their backups" ON "public"."backups" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their file permissions" ON "public"."file_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their profile" ON "public"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their storage stats" ON "public"."storage_stats" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their themes" ON "public"."themes" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_source_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_processing_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings_backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zenoti_services" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_exists"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_admin_profile"("user_id" "uuid", "email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_admin_profile"("user_id" "uuid", "email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_admin_profile"("user_id" "uuid", "email" "text") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_profiles_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_profiles_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_profiles_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_del"("key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_del"("key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_del"("key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_del_pattern"("pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_del_pattern"("pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_del_pattern"("pattern" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_get"("key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_incr"("key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_incr"("key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_incr"("key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_keys"("pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_keys"("pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_keys"("pattern" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redis_set"("key" "text", "value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_settings"("key" "text", "value" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_settings"("key" "text", "value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_settings"("key" "text", "value" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_channels"() TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_channels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_channels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_messages"("channel_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_messages"("channel_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_messages"("channel_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_get_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "text", "file_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "text", "file_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_attachment"("channel_id" "text", "file_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slack_send_message"("channel_id" "text", "message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slack_send_message"("channel_id" "text", "message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slack_send_message"("channel_id" "text", "message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admin_roles"("user_id" "uuid", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_admin_roles"("user_id" "uuid", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admin_roles"("user_id" "uuid", "new_role" "text") TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_stats" TO "anon";
GRANT ALL ON TABLE "public"."analytics_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_stats" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."backups" TO "anon";
GRANT ALL ON TABLE "public"."backups" TO "authenticated";
GRANT ALL ON TABLE "public"."backups" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."chat_threads" TO "anon";
GRANT ALL ON TABLE "public"."chat_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_threads" TO "service_role";



GRANT ALL ON TABLE "public"."claude_conversations" TO "anon";
GRANT ALL ON TABLE "public"."claude_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."claude_responses" TO "anon";
GRANT ALL ON TABLE "public"."claude_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_responses" TO "service_role";



GRANT ALL ON TABLE "public"."claude_source_cache" TO "anon";
GRANT ALL ON TABLE "public"."claude_source_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_source_cache" TO "service_role";



GRANT ALL ON TABLE "public"."crm_contacts" TO "anon";
GRANT ALL ON TABLE "public"."crm_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."file_permissions" TO "anon";
GRANT ALL ON TABLE "public"."file_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."file_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."file_processing_log" TO "anon";
GRANT ALL ON TABLE "public"."file_processing_log" TO "authenticated";
GRANT ALL ON TABLE "public"."file_processing_log" TO "service_role";



GRANT ALL ON TABLE "public"."image_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."image_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."image_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."settings_backups" TO "anon";
GRANT ALL ON TABLE "public"."settings_backups" TO "authenticated";
GRANT ALL ON TABLE "public"."settings_backups" TO "service_role";



GRANT ALL ON TABLE "public"."storage_stats" TO "anon";
GRANT ALL ON TABLE "public"."storage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."themes" TO "anon";
GRANT ALL ON TABLE "public"."themes" TO "authenticated";
GRANT ALL ON TABLE "public"."themes" TO "service_role";



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
