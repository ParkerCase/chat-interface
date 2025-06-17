-- SIMPLE TEST: Let's see what your messages table actually contains
-- Run this to understand the real structure

-- 1. Check table structure
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if table has any data
SELECT COUNT(*) as row_count FROM messages;

-- 3. Try to insert a simple test message
INSERT INTO messages (content, user_id) 
VALUES ('Test message from SQL', 'd45ce5b9-1ac3-4446-a03a-299c77f3cdd8');

-- 4. See what we just inserted
SELECT * FROM messages ORDER BY created_at DESC LIMIT 1;
