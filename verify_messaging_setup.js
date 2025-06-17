// Messaging System Verification Script
// Run this in your browser console after executing the SQL setup

const verifyMessagingSetup = async () => {
  console.log('🔍 Verifying messaging system setup...');
  
  try {
    // Import your connection test functions
    const { diagnoseSupabaseIssues } = await import('./src/utils/supabaseConnectionTest.js');
    
    console.log('1️⃣ Running comprehensive diagnostics...');
    const diagnosis = await diagnoseSupabaseIssues();
    
    if (diagnosis.connection?.success) {
      console.log('✅ MESSAGING SYSTEM IS READY!');
      console.log('🎉 You can now send messages between users');
      console.log('');
      console.log('📋 Test Results:');
      console.log('- Basic connection:', diagnosis.connection.basicConnection ? '✅' : '❌');
      console.log('- Messages table:', diagnosis.connection.messagesTable ? '✅' : '❌');
      console.log('- Realtime enabled:', diagnosis.connection.realtime ? '✅' : '❌');
      
      // Test message insertion
      console.log('');
      console.log('2️⃣ Testing message insertion...');
      
      // We'll need to test this with actual Supabase client in your app
      console.log('⚠️ To complete testing, go to your messaging app and:');
      console.log('1. Open two browser tabs');
      console.log('2. Login as different users (or same user for testing)');
      console.log('3. Join the same chat room');
      console.log('4. Send a message from one tab');
      console.log('5. Verify it appears instantly in the other tab');
      
    } else {
      console.log('❌ SETUP INCOMPLETE');
      console.log('');
      console.log('🔧 Issues found:');
      diagnosis.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      
      if (diagnosis.connection?.error?.includes('Messages table missing')) {
        console.log('');
        console.log('🚨 CRITICAL: You need to run the SQL script first!');
        console.log('📝 Go to: https://rfnglcfyzoyqenofmsev.supabase.co/project/rfnglcfyzoyqenofmsev/sql');
        console.log('📄 Copy and paste the contents of complete_messaging_setup.sql');
        console.log('▶️ Click "Run"');
      }
    }
    
    return diagnosis;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.log('');
    console.log('🔧 Try these steps:');
    console.log('1. Make sure you ran the SQL setup script');
    console.log('2. Refresh your browser');
    console.log('3. Check browser console for errors');
    
    return { success: false, error: error.message };
  }
};

// Auto-run verification
verifyMessagingSetup();

// Export for manual use
window.verifyMessagingSetup = verifyMessagingSetup;

console.log('');
console.log('💡 You can run verifyMessagingSetup() anytime to check your setup');
