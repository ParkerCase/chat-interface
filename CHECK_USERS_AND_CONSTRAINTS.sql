-- Check what users actually exist in your system
-- This will help us understand the foreign key constraint

-- 1. Check if users table exists and what's in it
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'profiles', 'auth_users');

-- 2. Check users table structure if it exists
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. See what users exist
SELECT id, email, created_at FROM users LIMIT 10;

-- 4. Check profiles table too (common in Supabase)
SELECT id, email, full_name FROM profiles LIMIT 10;

-- 5. Check the foreign key constraint details
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='messages';
