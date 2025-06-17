-- Test message insert with your actual user ID
-- This should work since the user exists

-- Test insert with parker@tatt2away.com (your current user)
INSERT INTO messages (content, user_id) 
VALUES ('Test message from Parker', 'd45ce5b9-1ac3-4446-a03a-299c77f3cdd8');

-- Check if it worked
SELECT * FROM messages WHERE user_id = 'd45ce5b9-1ac3-4446-a03a-299c77f3cdd8';

-- Also check the foreign key constraint details
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='messages';
