// src/utils/ssoDebugger.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

// Add to src/utils/ssoDebugger.js
export async function signInWithApple() {
  try {
    debugAuth.log("AppleSSO", "Starting Apple sign-in flow");

    // First check current session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugAuth.log("AppleSSO", "User already has an active session");
      return { success: true, action: "existing_session" };
    }

    // Begin OAuth flow with Apple
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Important settings for Apple auth
        queryParams: {
          response_mode: "fragment",
          scope: "email name",
        },
        shouldCreateUser: true, // Enable user creation
      },
    });

    if (error) {
      debugAuth.log("AppleSSO", `OAuth error: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    if (data?.url) {
      debugAuth.log("AppleSSO", "Redirecting to Apple OAuth URL");
      // Set a flag to identify this as an SSO attempt
      sessionStorage.setItem("ssoAttempt", "true");
      sessionStorage.setItem("ssoProvider", "apple");

      // Redirect to provider's OAuth page
      window.location.href = data.url;
      return { success: true, action: "redirecting" };
    }

    return { success: false, error: "No redirect URL received" };
  } catch (error) {
    debugAuth.log(
      "AppleSSO",
      `Exception during Apple sign-in: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

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
        shouldCreateUser: true, // Explicitly enable user creation
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
    debugAuth.log("SSO", "Processing OAuth callback with code");

    // Get SSO provider (fallback to "google" for backward compatibility)
    const provider = sessionStorage.getItem("ssoProvider") || "google";
    debugAuth.log("SSO", `Provider from session: ${provider}`);

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      debugAuth.log("SSO", `Code exchange error: ${error.message}`, error);

      // Enhanced error handling based on error codes
      if (error.message.includes("User not found")) {
        // Extract email from error if possible
        const emailMatch = error.message.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
        );
        const email = emailMatch ? emailMatch[0] : "unknown";

        debugAuth.log("SSO", `User not found for email: ${email}`);

        // Special case for super admin
        if (email === "itsus@tatt2away.com") {
          debugAuth.log(
            "SSO",
            "Super admin detected, attempting special handling"
          );

          // Trigger OTP authentication as fallback
          try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
              },
            });

            if (!otpError) {
              return {
                success: false,
                linkingFlow: true,
                message:
                  "Please check your email for a verification code to complete the admin login.",
                email,
                isAdmin: true,
              };
            }
          } catch (adminErr) {
            debugAuth.log(
              "SSO",
              `Admin authentication error: ${adminErr.message}`
            );
          }
        }

        // For all other user-not-found cases, check if the email exists in profiles
        const { data: userData, error: userError } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!userError && userData) {
          debugAuth.log(
            "SSO",
            "Found matching user in profiles table, initiating linking flow",
            userData
          );

          // Initiate email verification to link accounts
          try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
              },
            });

            if (!otpError) {
              // Email sent successfully
              return {
                success: false,
                linkingFlow: true,
                message:
                  "We found your email in our system but need to link your accounts. Please check your email for a verification code.",
                email,
              };
            }
          } catch (linkErr) {
            debugAuth.log("SSO", `Linking flow error: ${linkErr.message}`);
          }
        }

        // User doesn't exist at all - account needs to be created
        return {
          success: false,
          error:
            "Account not found. Please register first or contact your administrator.",
          type: "user_not_found",
          email: email,
        };
      }

      return { success: false, error: error.message };
    }

    if (!data || !data.session) {
      debugAuth.log("SSO", "No session data returned");
      return {
        success: false,
        error: "Authentication failed - no session created",
      };
    }

    // Success! Get user details
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      debugAuth.log("SSO", `Error getting user data: ${userError.message}`);
      return {
        success: false,
        error: "Failed to get user details after authentication",
      };
    }

    debugAuth.log("SSO", "Authentication successful", {
      email: userData.user.email,
      id: userData.user.id,
      provider: userData.user.app_metadata?.provider || provider,
    });

    // Ensure user profile exists with correct roles
    await ensureUserProfile(userData.user);

    return {
      success: true,
      user: userData.user,
      session: data.session,
    };
  } catch (error) {
    debugAuth.log("SSO", `Exception handling callback: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function ensureSuperAdminRole(user) {
  try {
    if (user.email !== "itsus@tatt2away.com") return;

    debugAuth.log(
      "GoogleSSO",
      "Ensuring super admin role for user",
      user.email
    );

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, roles")
      .eq("id", user.id)
      .single();

    if (profileError && !profileError.message.includes("No rows found")) {
      debugAuth.log(
        "GoogleSSO",
        `Error checking profile: ${profileError.message}`
      );
      throw profileError;
    }

    // If profile exists, update roles
    if (profile) {
      // Check if already has super_admin role
      if (profile.roles && profile.roles.includes("super_admin")) {
        debugAuth.log("GoogleSSO", "User already has super_admin role");
        return;
      }

      // Update to add admin roles
      await supabase
        .from("profiles")
        .update({
          roles: ["super_admin", "admin", "user"],
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      debugAuth.log("GoogleSSO", "Updated user roles to super_admin");
    } else {
      // Create new profile with admin roles
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: "Tatt2Away Admin",
        roles: ["super_admin", "admin", "user"],
        tier: "enterprise",
        created_at: new Date().toISOString(),
        auth_provider: "google",
      });

      debugAuth.log("GoogleSSO", "Created super_admin profile");
    }

    // Set localStorage and sessionStorage flags
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: "Tatt2Away Admin",
        roles: ["super_admin", "admin", "user"],
        tier: "enterprise",
      })
    );

    // Set MFA flags to bypass MFA for admin
    localStorage.setItem("authStage", "post-mfa");
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfaSuccess", "true");
  } catch (error) {
    debugAuth.log(
      "GoogleSSO",
      `Error ensuring super admin role: ${error.message}`
    );
    throw error;
  }
}

/**
 * Ensure the user has a profile record in the profiles table
 */
// Complete ensureUserProfile function for both regular users and admin
async function ensureUserProfile(user) {
  if (!user || !user.id || !user.email) return;

  try {
    // Special case for super admin
    if (user.email === "itsus@tatt2away.com") {
      debugAuth.log("SSO", "Super admin detected, ensuring admin roles");

      // Check if profile exists by email (not ID)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (profileError && !profileError.message.includes("No rows found")) {
        debugAuth.log(
          "SSO",
          `Error checking admin profile: ${profileError.message}`
        );
        throw profileError;
      }

      // Create new profile or update existing one
      if (!profileData) {
        // Create new profile with super_admin role
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: "Tatt2Away Admin",
          roles: ["super_admin", "admin", "user"],
          tier: "enterprise",
          created_at: new Date().toISOString(),
          auth_provider: user.app_metadata?.provider || "unknown",
        });

        if (insertError) {
          debugAuth.log(
            "SSO",
            `Error creating admin profile: ${insertError.message}`
          );
          throw insertError;
        }

        debugAuth.log("SSO", "Created new admin profile");
      } else {
        // Update existing profile if needed
        if (!profileData.roles || !profileData.roles.includes("super_admin")) {
          // Update roles to ensure admin privileges
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              roles: ["super_admin", "admin", "user"],
              updated_at: new Date().toISOString(),
              auth_provider:
                user.app_metadata?.provider ||
                profileData.auth_provider ||
                "unknown",
            })
            .eq("email", user.email);

          if (updateError) {
            debugAuth.log(
              "SSO",
              `Error updating admin roles: ${updateError.message}`
            );
            throw updateError;
          }

          debugAuth.log("SSO", "Updated admin roles");
        }

        // If profile has different ID, update it to match current auth user
        if (profileData.id !== user.id) {
          debugAuth.log(
            "SSO",
            "Admin profile ID mismatch, updating to match auth ID"
          );

          // Create a duplicate profile with the new ID
          const { error: idUpdateError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              full_name: profileData.full_name || "Tatt2Away Admin",
              roles: ["super_admin", "admin", "user"],
              tier: profileData.tier || "enterprise",
              created_at: new Date().toISOString(),
              auth_provider: user.app_metadata?.provider || "unknown",
            });

          if (idUpdateError && !idUpdateError.message.includes("duplicate")) {
            debugAuth.log(
              "SSO",
              `Error creating profile with new ID: ${idUpdateError.message}`
            );
            // Non-fatal, continue
          }
        }
      }

      // Set flags to bypass MFA for admin
      localStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfa_verified", "true");
      localStorage.setItem("authStage", "post-mfa");

      // Store admin user data
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: "Tatt2Away Admin",
          roles: ["super_admin", "admin", "user"],
          tier: "enterprise",
        })
      );

      localStorage.setItem("isAuthenticated", "true");

      debugAuth.log("SSO", "Admin user setup complete");
      return;
    }

    // --- Regular Users (non-admin) ---

    // First check if profile exists by ID
    const { data: profileById, error: idError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Then check if profile exists by email
    const { data: profileByEmail, error: emailError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    // Case 1: Profile exists with matching ID
    if (profileById) {
      debugAuth.log("SSO", "Existing profile found by ID, updating");

      // Update last login time
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          auth_provider:
            user.app_metadata?.provider ||
            profileById.auth_provider ||
            "unknown",
        })
        .eq("id", user.id);

      if (updateError) {
        debugAuth.log("SSO", `Error updating profile: ${updateError.message}`);
      }

      return;
    }

    // Case 2: Profile exists with matching email but different ID
    if (profileByEmail) {
      debugAuth.log(
        "SSO",
        "Found profile with matching email but different ID"
      );

      // Create a duplicate profile with the new ID, preserving roles and data
      const { error: duplicateError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name:
          profileByEmail.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email.split("@")[0],
        roles: profileByEmail.roles || ["user"],
        tier: profileByEmail.tier || "enterprise",
        created_at: new Date().toISOString(),
        auth_provider: user.app_metadata?.provider || "unknown",
        last_login: new Date().toISOString(),
      });

      if (duplicateError && !duplicateError.message.includes("duplicate")) {
        debugAuth.log(
          "SSO",
          `Error creating profile with new ID: ${duplicateError.message}`
        );
      } else {
        debugAuth.log("SSO", "Created new profile with existing user's data");
      }

      return;
    }

    // Case 3: No profile exists - create new one
    debugAuth.log("SSO", "No existing profile found, creating new profile");

    // Extract name from provider metadata
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split("@")[0];

    // Create new profile
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      roles: ["user"], // Default role
      tier: "enterprise",
      created_at: new Date().toISOString(),
      auth_provider: user.app_metadata?.provider || "unknown",
      last_login: new Date().toISOString(),
    });

    if (insertError) {
      debugAuth.log("SSO", `Error creating profile: ${insertError.message}`);
    } else {
      debugAuth.log("SSO", "Created new user profile");
    }
  } catch (error) {
    debugAuth.log("SSO", `Exception in ensureUserProfile: ${error.message}`);
    console.error("Error in ensureUserProfile:", error);
  }
}
