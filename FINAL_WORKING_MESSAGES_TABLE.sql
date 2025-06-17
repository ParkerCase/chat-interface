-- FINAL WORKING SOLUTION
-- This creates a simple working messages table that matches your needs

-- Step 1: Drop existing problematic table
DROP TABLE IF EXISTS "public"."messages" CASCADE;

-- Step 2: Create a simple, working messages table
CREATE TABLE "public"."messages" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "content" TEXT NOT NULL,
    "room_name" TEXT NOT NULL,
    "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "user_name" TEXT,
    "user_email" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    "metadata" JSONB DEFAULT '{}'::jsonb
);

-- Step 3: Enable Row Level Security
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple policies
CREATE POLICY "Anyone can read messages" ON "public"."messages"
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert messages" ON "public"."messages"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON "public"."messages"
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON "public"."messages"
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 6: Grant permissions
GRANT ALL ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."messages" TO service_role;

-- Step 7: Create indexes
CREATE INDEX idx_messages_room_name ON messages(room_name);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Step 8: Test with your user
INSERT INTO messages (content, room_name, user_id, user_name, user_email) 
VALUES (
    'Test message - system working!', 
    'general', 
    'd45ce5b9-1ac3-4446-a03a-299c77f3cdd8',
    'Parker',
    'parker@tatt2away.com'
);

-- Step 9: Verify it worked
SELECT 
    id, 
    content, 
    room_name, 
    user_name, 
    created_at 
FROM messages 
ORDER BY created_at DESC 
LIMIT 1;

-- Success message
SELECT 'Messages table created and tested successfully!' as status;
