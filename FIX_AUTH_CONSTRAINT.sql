-- Check if the constraint references auth.users instead of public.users
-- and create a proper fix

-- 1. Check current constraint
SELECT
    tc.constraint_name,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_schema,
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

-- 2. If constraint points to auth.users, we need to check auth.users
SELECT id, email FROM auth.users WHERE email = 'parker@tatt2away.com';

-- 3. Try insert using UUID from auth.users if that's the constraint
INSERT INTO messages (content, user_id) 
SELECT 'Test with auth user', id 
FROM auth.users 
WHERE email = 'parker@tatt2away.com';

-- 4. Check if it worked
SELECT * FROM messages ORDER BY created_at DESC LIMIT 1;
