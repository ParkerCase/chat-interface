-- Quick fix: Update messages table to work properly
-- This handles the foreign key constraint issue

-- Option 1: Drop the foreign key constraint temporarily
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

-- Option 2: Create the constraint pointing to auth.users (Supabase's auth table)
-- This is likely what you need since your AuthContext uses Supabase auth
ALTER TABLE messages 
ADD CONSTRAINT messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Test insert with your current user
INSERT INTO messages (content, user_id) 
VALUES ('Test message - constraint fixed', 'd45ce5b9-1ac3-4446-a03a-299c77f3cdd8');

-- Check if it worked
SELECT 
    m.id,
    m.content, 
    m.user_id,
    m.created_at,
    u.email
FROM messages m
LEFT JOIN auth.users u ON m.user_id = u.id
ORDER BY m.created_at DESC 
LIMIT 3;
