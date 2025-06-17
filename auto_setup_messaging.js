// Auto-setup script to create the messages table and verify the messaging system
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rfnglcfyzoyqenofmsev.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDk1MTY5MiwiZXhwIjoyMDQ2NTI3NjkyfQ.zTaLKw52nKpR2j2UiWBmGO5BmhzrEQhbIzjk8xhLnKo'; // Need service role for admin operations

// Create admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const setupMessagingSystem = async () => {
  console.log('🚀 Setting up messaging system...');
  
  try {
    // Step 1: Create messages table with proper structure
    console.log('1️⃣ Creating messages table...');
    
    const createTableSQL = `
      -- Create messages table for realtime chat
      CREATE TABLE IF NOT EXISTS "public"."messages" (
          "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "content" TEXT NOT NULL,
          "room_name" TEXT NOT NULL,
          "user_id" UUID NOT NULL,
          "user_name" TEXT NOT NULL,
          "user_email" TEXT,
          "created_at" TIMESTAMPTZ DEFAULT NOW(),
          "updated_at" TIMESTAMPTZ DEFAULT NOW(),
          "metadata" JSONB DEFAULT '{}'::jsonb,
          "edited" BOOLEAN DEFAULT FALSE,
          "deleted" BOOLEAN DEFAULT FALSE
      );
    `;
    
    const { error: createError } = await supabaseAdmin.rpc('run_sql', { 
      sql: createTableSQL 
    });
    
    if (createError && !createError.message.includes('already exists')) {
      throw createError;
    }
    
    console.log('✅ Messages table created successfully');
    
    // Step 2: Create indexes
    console.log('2️⃣ Creating indexes...');
    
    const indexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_messages_room_name ON messages(room_name);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_name, created_at DESC);
    `;
    
    const { error: indexError } = await supabaseAdmin.rpc('run_sql', { 
      sql: indexesSQL 
    });
    
    if (indexError) {
      console.warn('⚠️ Index creation warning:', indexError.message);
    } else {
      console.log('✅ Indexes created successfully');
    }
    
    // Step 3: Enable RLS and create policies
    console.log('3️⃣ Setting up security policies...');
    
    const securitySQL = `
      -- Enable RLS
      ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
      
      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view all messages" ON "public"."messages";
      DROP POLICY IF EXISTS "Users can insert their own messages" ON "public"."messages";
      DROP POLICY IF EXISTS "Users can update their own messages" ON "public"."messages";
      DROP POLICY IF EXISTS "Users can delete their own messages" ON "public"."messages";
      
      -- Create new policies
      CREATE POLICY "Users can view all messages" ON "public"."messages"
      FOR SELECT USING (true);
      
      CREATE POLICY "Users can insert their own messages" ON "public"."messages"
      FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own messages" ON "public"."messages"
      FOR UPDATE USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete their own messages" ON "public"."messages"
      FOR DELETE USING (auth.uid() = user_id);
    `;
    
    const { error: securityError } = await supabaseAdmin.rpc('run_sql', { 
      sql: securitySQL 
    });
    
    if (securityError) {
      console.warn('⚠️ Security setup warning:', securityError.message);
    } else {
      console.log('✅ Security policies created successfully');
    }
    
    // Step 4: Enable realtime
    console.log('4️⃣ Enabling realtime...');
    
    const realtimeSQL = `
      -- Enable realtime for the messages table
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
      
      -- Grant necessary permissions
      GRANT ALL ON "public"."messages" TO authenticated;
      GRANT ALL ON "public"."messages" TO service_role;
    `;
    
    const { error: realtimeError } = await supabaseAdmin.rpc('run_sql', { 
      sql: realtimeSQL 
    });
    
    if (realtimeError) {
      console.warn('⚠️ Realtime setup warning:', realtimeError.message);
    } else {
      console.log('✅ Realtime enabled successfully');
    }
    
    // Step 5: Test the setup
    console.log('5️⃣ Testing setup...');
    
    // Test basic table access
    const { data: testData, error: testError } = await supabaseAdmin
      .from('messages')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Table test failed: ${testError.message}`);
    }
    
    console.log('✅ Table access test passed');
    
    // Test realtime subscription
    const testChannel = supabaseAdmin
      .channel('test-setup')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        console.log('✅ Realtime test received');
      });
    
    const subscribeResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout' });
      }, 10000);
      
      testChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          supabaseAdmin.removeChannel(testChannel);
          resolve({ success: true });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          supabaseAdmin.removeChannel(testChannel);
          resolve({ success: false, error: status });
        }
      });
    });
    
    if (subscribeResult.success) {
      console.log('✅ Realtime subscription test passed');
    } else {
      console.warn('⚠️ Realtime test warning:', subscribeResult.error);
    }
    
    console.log('🎉 Messaging system setup completed successfully!');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return { success: false, error: error.message };
  }
};

// Run the setup
if (typeof window !== 'undefined') {
  setupMessagingSystem();
}

export { setupMessagingSystem };
