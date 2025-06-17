import { supabase } from "../lib/supabase";

export const testSupabaseConnection = async () => {
  console.log("🔍 Testing Supabase connection...");

  try {
    // Test 1: Basic connection
    console.log("1. Testing basic connection...");
    const { data: testData, error: testError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("❌ Basic connection failed:", testError);
      return { success: false, error: testError.message };
    }

    console.log("✅ Basic connection successful");

    // Test 2: Realtime connection
    console.log("2. Testing realtime connection...");
    const channel = supabase.channel("test-connection");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log("⏰ Realtime connection timeout");
        resolve({
          success: false,
          error: "Realtime connection timeout",
          basicConnection: true,
        });
      }, 10000);

      channel
        .on("broadcast", { event: "test" }, () => {
          console.log("✅ Realtime broadcast received");
        })
        .subscribe((status) => {
          console.log("📡 Channel status:", status);

          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            console.log("✅ Realtime connection successful");
            resolve({
              success: true,
              status: "connected",
              basicConnection: true,
            });
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            clearTimeout(timeout);
            console.error("❌ Realtime connection failed:", status);
            resolve({
              success: false,
              error: `Realtime connection failed: ${status}`,
              basicConnection: true,
            });
          }
        });
    });
  } catch (error) {
    console.error("❌ Connection test error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const diagnoseSupabaseIssues = async () => {
  console.log("🔧 Diagnosing Supabase issues...");

  const results = {
    environmentVariables: {
      url: !!process.env.REACT_APP_SUPABASE_URL,
      anonKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
    },
    connection: null,
    recommendations: [],
  };

  // Check environment variables
  if (!results.environmentVariables.url) {
    results.recommendations.push(
      "Missing REACT_APP_SUPABASE_URL environment variable"
    );
  }
  if (!results.environmentVariables.anonKey) {
    results.recommendations.push(
      "Missing REACT_APP_SUPABASE_ANON_KEY environment variable"
    );
  }

  // Test connection
  results.connection = await testSupabaseConnection();

  if (!results.connection.success) {
    if (results.connection.error?.includes("timeout")) {
      results.recommendations.push(
        "Realtime connection timeout - check Supabase project settings"
      );
      results.recommendations.push(
        "Ensure realtime is enabled in your Supabase project"
      );
    } else if (results.connection.error?.includes("unauthorized")) {
      results.recommendations.push(
        "Authentication error - check your API keys"
      );
    } else {
      results.recommendations.push(
        "Connection failed - check network and Supabase status"
      );
    }
  }

  console.log("📊 Diagnosis results:", results);
  return results;
};
