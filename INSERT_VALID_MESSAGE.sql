-- QUICK FIX: Insert a test message with a valid user_id
-- First, let's see what user_ids actually exist

-- Option 1: Use your current admin user ID if it exists in users table
INSERT INTO messages (content, user_id) 
SELECT 'Test message from admin', id 
FROM users 
WHERE email = 'parker@tatt2away.com' 
LIMIT 1;

-- Option 2: If that fails, try from profiles table
INSERT INTO messages (content, user_id) 
SELECT 'Test message from profiles', id 
FROM profiles 
WHERE email = 'parker@tatt2away.com' 
LIMIT 1;

-- Option 3: Just use any existing user
INSERT INTO messages (content, user_id) 
SELECT 'Test message from any user', id 
FROM users 
LIMIT 1;

-- Check if any of these worked
SELECT * FROM messages ORDER BY created_at DESC LIMIT 3;
