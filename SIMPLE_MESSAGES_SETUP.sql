-- SIMPLE MESSAGES TABLE SETUP
-- Copy this ENTIRE block and paste in Supabase SQL Editor
-- This is the minimal setup needed to fix your messaging system

-- Create the messages table
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "content" TEXT NOT NULL,
    "room_name" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "edited" BOOLEAN DEFAULT FALSE,
    "deleted" BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Enable read access for all users" ON "public"."messages"
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."messages"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Grant permissions
GRANT ALL ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."messages" TO service_role;

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_name ON messages(room_name);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
