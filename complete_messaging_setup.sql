-- Complete messaging system setup for Supabase
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Create messages table for realtime chat
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

-- Step 2: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_name ON messages(room_name);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_name, created_at DESC);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all messages" ON "public"."messages";
DROP POLICY IF EXISTS "Users can insert their own messages" ON "public"."messages";
DROP POLICY IF EXISTS "Users can update their own messages" ON "public"."messages";
DROP POLICY IF EXISTS "Users can delete their own messages" ON "public"."messages";

-- Step 5: Create security policies for messages table
CREATE POLICY "Users can view all messages" ON "public"."messages"
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own messages" ON "public"."messages"
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON "public"."messages"
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON "public"."messages"
FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 7: Grant necessary permissions
GRANT ALL ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."messages" TO service_role;

-- Step 8: Add helpful comments
COMMENT ON TABLE "public"."messages" IS 'Real-time chat messages for the messaging system';
COMMENT ON COLUMN "public"."messages"."room_name" IS 'The chat room/channel identifier';
COMMENT ON COLUMN "public"."messages"."user_name" IS 'Display name of the user who sent the message';

-- Step 9: Verify the setup by checking table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        RAISE NOTICE '✅ Messages table created successfully';
    ELSE
        RAISE EXCEPTION '❌ Messages table creation failed';
    END IF;
END $$;
