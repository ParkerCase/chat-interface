-- Let's see what your messages table actually looks like right now
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check what data is in the table
SELECT COUNT(*) as total_rows FROM messages;

-- Check first few rows to see the actual structure
SELECT * FROM messages LIMIT 3;
