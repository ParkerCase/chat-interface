-- Add missing user_name column to your existing messages table
-- This will make your table compatible with the messaging system

-- Add the user_name column
ALTER TABLE "public"."messages" 
ADD COLUMN IF NOT EXISTS "user_name" TEXT;

-- Add the user_email column  
ALTER TABLE "public"."messages" 
ADD COLUMN IF NOT EXISTS "user_email" TEXT;

-- Enable Row Level Security if not already enabled
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."messages";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."messages";
DROP POLICY IF EXISTS "Enable update for message owners" ON "public"."messages";
DROP POLICY IF EXISTS "Enable delete for message owners" ON "public"."messages";

-- Create new policies
CREATE POLICY "Enable read access for all users" ON "public"."messages"
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."messages"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for message owners" ON "public"."messages"
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for message owners" ON "public"."messages"
    FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime if not already enabled
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Success message
SELECT 'Messages table updated successfully for chat system!' as status;
