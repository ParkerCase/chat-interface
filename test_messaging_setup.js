// Test script to verify messaging system setup
// Run this in your browser console after the changes

const testMessagingSetup = async () => {
  console.log('🧪 Testing messaging system setup...');
  
  try {
    // Import the connection test functions
    const { diagnoseSupabaseIssues } = await import('./src/utils/supabaseConnectionTest.js');
    
    // Run comprehensive diagnosis
    const diagnosis = await diagnoseSupabaseIssues();
    
    console.log('📋 Diagnosis Results:');
    console.log('- Environment Variables:', diagnosis.environmentVariables);
    console.log('- Connection Status:', diagnosis.connection);
    console.log('- Recommendations:', diagnosis.recommendations);
    
    if (diagnosis.connection?.success) {
      console.log('✅ Your messaging system should now work!');
      console.log('🚀 Try sending a message between users in different browser tabs.');
    } else {
      console.log('❌ Issues found. Follow the recommendations above.');
    }
    
    return diagnosis;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error: error.message };
  }
};

// Auto-run if in browser
if (typeof window !== 'undefined') {
  testMessagingSetup();
}

export { testMessagingSetup };
