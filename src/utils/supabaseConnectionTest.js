import { supabase } from "../lib/supabase";

export const testSupabaseConnection = async () => {
  console.log("🔍 Testing Supabase connection...");

  try {
    // Test 1: Basic connection
    console.log("1. Testing basic connection...");
    const { error: testError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("❌ Basic connection failed:", testError);
      return { success: false, error: testError.message };
    }

    console.log("✅ Basic connection successful");

    // Test 2: Check if messages table exists
    console.log("2. Testing messages table...");
    const { error: messagesError } = await supabase
      .from("messages")
      .select("id")
      .limit(1);

    if (messagesError && messagesError.code === "42P01") {
      console.error("❌ Messages table does not exist!");
      return {
        success: false,
        error: "Messages table missing - run create_messages_table.sql",
        basicConnection: true,
        messagesTable: false,
      };
    }

    console.log("✅ Messages table exists");

    // Test 3: Test RLS policies for authenticated users
    console.log("3. Testing RLS policies...");
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session) {
      console.log("✅ User is authenticated:", sessionData.session.user.email);

      // Test INSERT permission
      const testMessage = {
        content: "Test message for RLS verification",
        user_id: sessionData.session.user.id,
        user_name: sessionData.session.user.email,
        channel_id: "test-channel",
        created_at: new Date().toISOString(),
      };

      const { data: insertData, error: insertError } = await supabase
        .from("messages")
        .insert([testMessage])
        .select()
        .single();

      if (insertError) {
        console.error("❌ RLS INSERT policy failed:", insertError);
        return {
          success: false,
          error: `RLS INSERT policy failed: ${insertError.message}`,
          basicConnection: true,
          messagesTable: true,
          rlsPolicies: false,
        };
      }

      console.log("✅ RLS INSERT policy working");

      // Clean up test message
      if (insertData?.id) {
        await supabase.from("messages").delete().eq("id", insertData.id);
      }
    } else {
      console.log("⚠️ No authenticated session - skipping RLS test");
    }

    // Test 4: Test realtime connection for messages
    console.log("4. Testing realtime connection for messages...");
    const channel = supabase.channel("test-messages-connection").on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        console.log("✅ Realtime postgres_changes working:", payload);
      }
    );

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log("⏰ Realtime connection timeout");
        supabase.removeChannel(channel);
        resolve({
          success: false,
          error:
            "Realtime connection timeout - check Supabase project settings",
          basicConnection: true,
          messagesTable: true,
          rlsPolicies: sessionData?.session ? true : "skipped",
        });
      }, 15000);

      channel.subscribe((status) => {
        console.log("📡 Messages channel status:", status);

        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          console.log("✅ Messages realtime connection successful");
          supabase.removeChannel(channel);
          resolve({
            success: true,
            status: "connected",
            basicConnection: true,
            messagesTable: true,
            rlsPolicies: sessionData?.session ? true : "skipped",
            realtime: true,
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          clearTimeout(timeout);
          console.error("❌ Messages realtime connection failed:", status);
          supabase.removeChannel(channel);
          resolve({
            success: false,
            error: `Messages realtime connection failed: ${status}`,
            basicConnection: true,
            messagesTable: true,
            rlsPolicies: sessionData?.session ? true : "skipped",
            realtime: false,
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
    if (results.connection.error?.includes("Messages table missing")) {
      results.recommendations.push(
        "❗ CRITICAL: Run the SQL script to create the messages table"
      );
      results.recommendations.push(
        "Execute: create_messages_table.sql in your Supabase SQL editor"
      );
    } else if (results.connection.error?.includes("RLS INSERT policy failed")) {
      results.recommendations.push(
        "❗ CRITICAL: RLS policies are blocking access to the messages table"
      );
      results.recommendations.push(
        "Add these policies in your Supabase SQL editor:"
      );
      results.recommendations.push(
        'CREATE POLICY "Enable read access for all users" ON messages FOR SELECT USING (true);'
      );
      results.recommendations.push(
        'CREATE POLICY "Enable insert for authenticated users only" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);'
      );
    } else if (results.connection.error?.includes("timeout")) {
      results.recommendations.push(
        "Realtime connection timeout - check Supabase project settings"
      );
      results.recommendations.push(
        "Ensure realtime is enabled in your Supabase project"
      );
      results.recommendations.push(
        "Check if messages table has realtime enabled: ALTER PUBLICATION supabase_realtime ADD TABLE messages;"
      );
    } else if (results.connection.error?.includes("unauthorized")) {
      results.recommendations.push(
        "Authentication error - check your API keys and session"
      );
      results.recommendations.push(
        "Ensure you're signed in and have a valid session"
      );
    } else {
      results.recommendations.push(
        "Connection failed - check network and Supabase status"
      );
    }
  } else {
    results.recommendations.push(
      "✅ Connection successful! Your messaging setup should work."
    );

    // Additional recommendations based on test results
    if (results.connection.rlsPolicies === "skipped") {
      results.recommendations.push(
        "⚠️ RLS test skipped - ensure you're signed in for full functionality"
      );
    }

    if (!results.connection.realtime) {
      results.recommendations.push(
        "⚠️ Realtime connection failed - messages will work but not in real-time"
      );
    }
  }

  console.log("📊 Diagnosis results:", results);
  return results;
};
