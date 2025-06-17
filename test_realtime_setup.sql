-- Test and fix realtime configuration for messages table

-- 1. Check if realtime is enabled for the messages table
SELECT 
    schemaname,
    tablename,
    attname,
    atttypid::regtype
FROM pg_publication_tables pt
JOIN pg_class c ON c.oid = pt.tablename
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE c.relname = 'messages'
AND a.attnum > 0
AND NOT a.attisdropped;

-- 2. Check if the supabase_realtime publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- 3. Add messages table to realtime if not already added
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 4. Verify the table is now in realtime
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables pt
JOIN pg_class c ON c.oid = pt.tablename
WHERE c.relname = 'messages';

-- 5. Check if realtime is enabled at the database level
SHOW rls;

-- 6. Verify the messages table structure
\d public.messages; 