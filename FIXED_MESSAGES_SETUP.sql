-- FIXED MESSAGES TABLE SETUP
-- This drops the existing broken table and recreates it properly

-- First, drop the table if it exists (to start clean)
DROP TABLE IF EXISTS "public"."messages" CASCADE;

-- Create the messages table with proper structure
CREATE TABLE "public"."messages" (
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

-- Create policies
CREATE POLICY "Enable read access for all users" ON "public"."messages"
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."messages"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for message owners" ON "public"."messages"
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for message owners" ON "public"."messages"
    FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime (this might fail if already exists, that's ok)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
END $$;

-- Grant permissions
GRANT ALL ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."messages" TO service_role;

-- Create indexes
CREATE INDEX idx_messages_room_name ON messages(room_name);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Test that the table was created correctly
SELECT 'Messages table created successfully!' as status;
