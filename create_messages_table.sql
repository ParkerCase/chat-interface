-- Drop existing messages table if it exists (WARNING: This will delete all existing messages)
DROP TABLE IF EXISTS public.messages CASCADE;

-- Create messages table for realtime chat
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    channel_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages in channels they have access to" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

-- Create RLS policies
CREATE POLICY "Users can view messages in channels they have access to" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert messages" ON public.messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.messages
    FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON public.messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- Add comments
COMMENT ON TABLE public.messages IS 'Real-time chat messages for the messaging system';
COMMENT ON COLUMN public.messages.channel_id IS 'The chat room/channel identifier';
COMMENT ON COLUMN public.messages.user_name IS 'Display name of the user who sent the message';
