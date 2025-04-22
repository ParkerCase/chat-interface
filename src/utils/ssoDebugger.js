// src/utils/ssoDebugger.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";
import {
  linkIdentity,
  checkAndCompleteAutoLinking,
  callIdentityLinkingFunction,
  checkLinkingStatus,
  clearLinkingState,
} from "./identityLinking";

/**
 * Enhanced SSO login with automatic identity linking
 * @param {string} provider - Provider name (google, apple)
 * @returns {Promise<Object>} Result of the sign-in attempt
 */
async function signInWithSSOProvider(provider) {
  try {
    debugAuth.log("SSO", `Starting ${provider} sign-in flow`);

    // First check current session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugAuth.log("SSO", "User already has an active session");
      return { success: true, action: "existing_session" };
    }

    // Check if we were in the middle of auto-linking
    const autoLinkingStatus = await checkAndCompleteAutoLinking();
    if (autoLinkingStatus.isLinking) {
      debugAuth.log("SSO", "Auto-linking in progress");

      if (autoLinkingStatus.isComplete) {
        debugAuth.log("SSO", "Auto-linking appears to be complete");
        return { success: true, action: "linking_complete" };
      } else {
        debugAuth.log("SSO", "Auto-linking incomplete, continuing flow");
      }
    }

    // Begin OAuth flow with the provider
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          // These options help fix the "User not found" issue
          access_type: "offline",
          prompt: "consent",
        },
        scopes: "email profile",
        shouldCreateUser: true, // Enable user creation
      },
    });

    if (error) {
      // Check if this is a "user already exists" error
      if (
        error.message?.includes("User already exists") ||
        error.message?.includes("already registered") ||
        error.message?.includes("email already in use")
      ) {
        // Extract email from error if possible
        const emailMatch = error.message.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
        );
        const email = emailMatch ? emailMatch[0] : "";

        if (email) {
          debugAuth.log(
            "SSO",
            `Existing user detected with email ${email}, starting auto-linking`
          );

          // Call identity linking function to handle server-side verification
          const linkingResult = await callIdentityLinkingFunction(
            email,
            provider
          );

          if (linkingResult.success) {
            debugAuth.log(
              "SSO",
              `Identity linking function result: ${linkingResult.action}`
            );

            // Store linking state
            if (linkingResult.email) {
              sessionStorage.setItem("linkingEmail", linkingResult.email);
              sessionStorage.setItem("linkingProvider", provider);
              sessionStorage.setItem("linkingFlow", "true");
              sessionStorage.setItem("linkingStartedAt", Date.now().toString());
            }

            // Handle different linking actions
            if (linkingResult.action === "link_initiated") {
              // We need to use a magic link
              if (linkingResult.magicLink) {
                debugAuth.log("SSO", "Following magic link for linking");
                window.location.href = linkingResult.magicLink;
                return { success: true, action: "redirecting_to_magic_link" };
              }

              return {
                success: true,
                needsEmailCheck: true,
                message: "Please check your email to complete sign-in",
                email: email,
              };
            }

            if (linkingResult.action === "created") {
              // User was created (should not happen, but handle it)
              debugAuth.log("SSO", "New user created instead of linking");
              return {
                success: true,
                action: "user_created",
                message: "New account created successfully",
              };
            }

            if (linkingResult.action === "already_linked") {
              debugAuth.log("SSO", "Account was already linked");
              // Start regular OAuth flow again
              window.location.reload();
              return { success: true, action: "already_linked" };
            }

            return {
              success: true,
              autoLinking: true,
              action: linkingResult.action,
              message: "Account linking in progress",
            };
          }
        }
      }

      debugAuth.log("SSO", `OAuth error: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    if (data?.url) {
      debugAuth.log("SSO", "Redirecting to OAuth provider URL");
      // Set a flag to identify this as an SSO attempt
      sessionStorage.setItem("ssoAttempt", "true");
      sessionStorage.setItem("ssoProvider", provider);

      // Redirect to provider's OAuth page
      window.location.href = data.url;
      return { success: true, action: "redirecting" };
    }

    return { success: false, error: "No redirect URL received" };
  } catch (error) {
    debugAuth.log(
      "SSO",
      `Exception during ${provider} sign-in: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Google login with automatic identity linking
 */
export async function signInWithGoogle() {
  return await signInWithSSOProvider("google");
}

/**
 * Apple login with automatic identity linking
 */
export async function signInWithApple() {
  return await signInWithSSOProvider("apple");
}

/**
 * Handle the OAuth callback with enhanced auto-linking support
 * @param {string} code - OAuth code from callback
 * @returns {Promise<Object>} Result object
 */
export async function handleOAuthCallback(code) {
  try {
    debugAuth.log("SSO", "Processing OAuth callback with code");

    // Check if this is part of auto-linking process
    const linkingStatus = checkLinkingStatus();
    const isLinking = linkingStatus.isLinking;

    // Get SSO provider (fallback to "google" for backward compatibility)
    const provider = sessionStorage.getItem("ssoProvider") || "google";
    debugAuth.log("SSO", `Provider from session: ${provider}`);

    // If this is a linking flow, handle it differently
    if (isLinking) {
      debugAuth.log("SSO", "This is a linking flow");

      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        debugAuth.log(
          "SSO",
          `Code exchange error in linking flow: ${error.message}`
        );
        return {
          success: false,
          error: error.message,
          linkingFlow: true,
        };
      }

      if (data?.session) {
        debugAuth.log("SSO", "Session established in linking flow");

        // Success - linking is likely complete
        clearLinkingState();
        return {
          success: true,
          linkingComplete: true,
          message: "Account successfully linked",
        };
      }
    }

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      debugAuth.log("SSO", `Code exchange error: ${error.message}`, error);

      // If we hit "User not found" in auto-linking flow
      if (isLinking && error.message.includes("User not found")) {
        // This should be rare - we should have handled the linking before getting here
        debugAuth.log(
          "SSO",
          "User not found error during auto-linking, attempting recovery"
        );

        // Retry auto-linking with stored email
        if (linkingStatus.email) {
          const linkingResult = await callIdentityLinkingFunction(
            linkingStatus.email,
            linkingStatus.provider
          );

          if (linkingResult.success) {
            return {
              success: true,
              autoLinking: true,
              action: linkingResult.action,
              message: "Account linking in progress, please wait",
              email: linkingStatus.email,
            };
          }
        }
      }

      // Generic error for other scenarios
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

/**
 * Ensure the user has a profile record in the profiles table
 */
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
