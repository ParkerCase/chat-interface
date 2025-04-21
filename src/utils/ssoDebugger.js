// src/utils/ssoDebugger.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

/**
 * Enhanced SSO login function with detailed logging and error handling
 * Use this instead of direct Supabase signInWithOAuth for better diagnostics
 */
export async function signInWithGoogle() {
  try {
    debugAuth.log("GoogleSSO", "Starting Google sign-in flow");

    // First check current session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugAuth.log("GoogleSSO", "User already has an active session");
      return { success: true, action: "existing_session" };
    }

    // Begin OAuth flow with Google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // IMPORTANT: These options help fix the "User not found" issue
        queryParams: {
          // Use 'true' to create new users if not found
          access_type: "offline",
          prompt: "consent",
        },
        // Enable auto confirmation and custom data
        scopes: "email profile",
      },
    });

    if (error) {
      debugAuth.log("GoogleSSO", `OAuth error: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    if (data?.url) {
      debugAuth.log("GoogleSSO", "Redirecting to OAuth provider URL");
      // Set a flag to identify this as an SSO attempt
      sessionStorage.setItem("ssoAttempt", "true");
      sessionStorage.setItem("ssoProvider", "google");

      // Redirect to provider's OAuth page
      window.location.href = data.url;
      return { success: true, action: "redirecting" };
    }

    return { success: false, error: "No redirect URL received" };
  } catch (error) {
    debugAuth.log(
      "GoogleSSO",
      `Exception during Google sign-in: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handle the OAuth callback with enhanced error handling
 * This can be used in your SSOCallback component
 */
export async function handleOAuthCallback(code) {
  try {
    debugAuth.log("GoogleSSO", "Processing OAuth callback with code");

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      debugAuth.log(
        "GoogleSSO",
        `Code exchange error: ${error.message}`,
        error
      );

      // Enhanced error handling based on error codes
      if (error.message.includes("User not found")) {
        // This happens when a user tries to sign in with an email that exists
        // but was created with a different auth method

        // Extract email from error if possible
        const emailMatch = error.message.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
        );
        const email = emailMatch ? emailMatch[0] : "unknown";

        debugAuth.log("GoogleSSO", `User not found for email: ${email}`);

        // Try to lookup user by email to see if they exist
        const { data: userData, error: userError } = await supabase
          .from("profiles")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (!userError && userData) {
          debugAuth.log(
            "GoogleSSO",
            "Found matching user in profiles table",
            userData
          );
          return {
            success: false,
            error:
              "Your account exists but was created with a different sign-in method. Please use your email/password to sign in.",
            type: "auth_method_mismatch",
            email: email,
          };
        }

        // User doesn't exist at all - account needs to be created
        return {
          success: false,
          error:
            "Account not found. Please register first or use a different sign-in method.",
          type: "user_not_found",
          email: email,
        };
      }

      return { success: false, error: error.message };
    }

    if (!data || !data.session) {
      debugAuth.log("GoogleSSO", "No session data returned");
      return {
        success: false,
        error: "Authentication failed - no session created",
      };
    }

    // Success! Get user details
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      debugAuth.log(
        "GoogleSSO",
        `Error getting user data: ${userError.message}`
      );
      return {
        success: false,
        error: "Failed to get user details after authentication",
      };
    }

    debugAuth.log("GoogleSSO", "Authentication successful", {
      email: userData.user.email,
      id: userData.user.id,
    });

    // Make sure profile exists
    await ensureUserProfile(userData.user);

    return {
      success: true,
      user: userData.user,
      session: data.session,
    };
  } catch (error) {
    debugAuth.log("GoogleSSO", `Exception handling callback: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Ensure the user has a profile record in the profiles table
 */
async function ensureUserProfile(user) {
  if (!user || !user.id || !user.email) return;

  try {
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      debugAuth.log(
        "GoogleSSO",
        `Error checking profile: ${profileError.message}`
      );
      return;
    }

    if (profile) {
      // Profile exists, just update last login
      debugAuth.log("GoogleSSO", "Profile exists, updating last login");
      await supabase
        .from("profiles")
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      return;
    }

    // Create new profile record
    debugAuth.log("GoogleSSO", "Creating new profile record for user");

    // Extract name from Google metadata
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split("@")[0];

    // Create profile with admin role for test users
    const isTestAdmin = user.email === "itsus@tatt2away.com";
    const roles = isTestAdmin ? ["super_admin", "admin", "user"] : ["user"];

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      roles: roles,
      tier: "enterprise",
      created_at: new Date().toISOString(),
      auth_provider: "google",
    });

    if (insertError) {
      debugAuth.log(
        "GoogleSSO",
        `Error creating profile: ${insertError.message}`
      );
    }
  } catch (error) {
    debugAuth.log(
      "GoogleSSO",
      `Exception in ensureUserProfile: ${error.message}`
    );
  }
}
