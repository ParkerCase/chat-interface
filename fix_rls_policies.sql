-- Fix RLS policies for messages table
-- Run this in your Supabase SQL Editor

-- First, ensure RLS is enabled
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view messages in channels they have access to" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.messages;
DROP POLICY IF EXISTS "Enable update for message owners" ON public.messages;
DROP POLICY IF EXISTS "Enable delete for message owners" ON public.messages;

-- Create new policies that allow authenticated users to read and write
CREATE POLICY "Enable read access for all users" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for message owners" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for message owners" ON public.messages
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure the table is in the realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
END $$;

-- Grant necessary permissions
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- Verify the setup
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies updated successfully';
    RAISE NOTICE '✅ Messages table is in realtime publication';
    RAISE NOTICE '✅ Permissions granted to authenticated users';
END $$; 