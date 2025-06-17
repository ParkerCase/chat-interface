-- Create messages table for realtime chat
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_name ON messages(room_name);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_name, created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Create policies for messages table
CREATE POLICY "Users can view all messages" ON "public"."messages"
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own messages" ON "public"."messages"
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON "public"."messages"
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON "public"."messages"
FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Grant necessary permissions
GRANT ALL ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."messages" TO service_role;

-- Add comments
COMMENT ON TABLE "public"."messages" IS 'Real-time chat messages for the messaging system';
COMMENT ON COLUMN "public"."messages"."room_name" IS 'The chat room/channel identifier';
COMMENT ON COLUMN "public"."messages"."user_name" IS 'Display name of the user who sent the message';
