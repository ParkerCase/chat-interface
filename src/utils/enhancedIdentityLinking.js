// src/utils/enhancedIdentityLinking.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

/**
 * Enhanced identity linking utilities for connecting social accounts with existing email accounts
 */

/**
 * Get stored linking state from session storage
 * @returns {Object} Current linking state
 */
export const getLinkingState = () => {
  return {
    isLinking: sessionStorage.getItem("linkingFlow") === "true",
    email: sessionStorage.getItem("linkingEmail"),
    provider: sessionStorage.getItem("linkingProvider"),
    startedAt: parseInt(sessionStorage.getItem("linkingStartedAt") || "0"),
    status: sessionStorage.getItem("linkingStatus"),
  };
};

/**
 * Store linking state in session storage
 * @param {Object} state - Linking state to store
 */
export const setLinkingState = (state) => {
  if (state.isLinking) {
    sessionStorage.setItem("linkingFlow", "true");

    if (state.email) {
      sessionStorage.setItem("linkingEmail", state.email);
    }

    if (state.provider) {
      sessionStorage.setItem("linkingProvider", state.provider);
    }

    if (!sessionStorage.getItem("linkingStartedAt")) {
      sessionStorage.setItem("linkingStartedAt", Date.now().toString());
    }

    if (state.status) {
      sessionStorage.setItem("linkingStatus", state.status);
    }
  } else {
    // Clear linking state
    clearLinkingState();
  }
};

/**
 * Clear stored linking state
 */
export const clearLinkingState = () => {
  sessionStorage.removeItem("linkingFlow");
  sessionStorage.removeItem("linkingEmail");
  sessionStorage.removeItem("linkingProvider");
  sessionStorage.removeItem("linkingStartedAt");
  sessionStorage.removeItem("linkingStatus");
};

/**
 * Check if an account with the given email exists
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} Whether the account exists
 */
export const checkAccountExists = async (email) => {
  try {
    // Use a Supabase SQL function to check if email exists without revealing info
    const { data, error } = await supabase.rpc("check_email_exists", {
      email_to_check: email,
    });

    if (error) {
      debugAuth.log(
        "IdentityLinking",
        `Error checking account: ${error.message}`
      );
      // Fall back to checking profiles table (less secure but works as backup)
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      return !!profiles;
    }

    return !!data;
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Error checking account: ${error.message}`
    );
    return false;
  }
};

/**
 * Start a social login flow with enhanced error handling and auto-linking
 * @param {string} provider - The provider (google, apple)
 * @returns {Promise<Object>} Login result
 */
export const enhancedSocialLogin = async (provider) => {
  try {
    debugAuth.log("IdentityLinking", `Starting ${provider} login`);

    // Check first if we're already in a linking flow
    const linkingState = getLinkingState();
    if (linkingState.isLinking) {
      debugAuth.log("IdentityLinking", "Already in linking flow, continuing");

      // If linking flow is stale (older than 10 minutes), reset it
      const now = Date.now();
      const linkingAge = now - (linkingState.startedAt || 0);
      if (linkingAge > 10 * 60 * 1000) {
        debugAuth.log("IdentityLinking", "Linking flow is stale, resetting");
        clearLinkingState();
      } else {
        // Continue with linking flow
        return { isLinking: true, provider: linkingState.provider };
      }
    }

    // Start social login with Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Add additional options to help with linking
        queryParams: {
          prompt: "select_account", // Forces account selection UI
          access_type: "offline", // For refresh tokens
        },
      },
    });

    if (error) {
      // Check if error is related to account linking
      if (
        error.message?.includes("already registered") ||
        error.message?.includes("User already exists")
      ) {
        // Extract email if possible
        const emailMatch = error.message.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
        );
        const email = emailMatch ? emailMatch[0] : "";

        debugAuth.log(
          "IdentityLinking",
          `Account exists with email: ${email}, initiating linking`
        );

        // Store linking state
        setLinkingState({
          isLinking: true,
          email,
          provider,
          status: "initiated",
        });

        // We'll redirect back to SSO, but now with linking state
        return {
          success: true,
          needsLinking: true,
          email,
          provider,
        };
      }

      throw error;
    }

    // If we got a redirect URL, use it
    if (data?.url) {
      // Set flags for the callback handler
      sessionStorage.setItem("ssoAttempt", "true");
      sessionStorage.setItem("ssoProvider", provider);

      // Redirect to provider's auth page
      window.location.href = data.url;

      return { success: true, action: "redirecting" };
    }

    return { success: false, error: "No redirect URL received" };
  } catch (error) {
    debugAuth.log("IdentityLinking", `Error in social login: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Handle a login with an existing provider
 * @param {string} email - User's email address
 * @param {string} provider - Provider (google, apple)
 * @returns {Promise<Object>} Result of the linking attempt
 */
export const handleExistingAccount = async (email, provider) => {
  try {
    debugAuth.log(
      "IdentityLinking",
      `Handling existing account for ${email} with ${provider}`
    );

    // First check if account exists
    const exists = await checkAccountExists(email);

    if (!exists) {
      return {
        success: false,
        error: "No account exists with this email",
      };
    }

    // Store linking state
    setLinkingState({
      isLinking: true,
      email,
      provider,
      status: "verification_needed",
    });

    // Send verification email
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/link-account?provider=${provider}`,
      },
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: `Verification email sent to ${email}`,
      status: "verification_sent",
    };
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Error handling existing account: ${error.message}`
    );
    return { success: false, error: error.message };
  }
};

/**
 * Complete the account linking process after email verification
 * @param {string} email - Email address
 * @param {string} provider - Provider to link
 * @param {string} verificationCode - Verification code from email
 * @returns {Promise<Object>} Result of the linking
 */
export const completeAccountLinking = async (
  email,
  provider,
  verificationCode
) => {
  try {
    debugAuth.log(
      "IdentityLinking",
      `Completing account linking for ${email} with ${provider}`
    );

    // Verify the email code
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode,
      type: "email",
    });

    if (error) {
      // Check for special case where user is already verified
      if (
        error.message?.includes("already confirmed") ||
        error.message?.includes("already logged in")
      ) {
        debugAuth.log(
          "IdentityLinking",
          "User already verified, proceeding with linking"
        );
      } else {
        throw error;
      }
    }

    // Update linking state
    setLinkingState({
      isLinking: true,
      email,
      provider,
      status: "verified",
    });

    // Now we need to redirect to the social provider for final step
    return {
      success: true,
      action: "proceed_to_provider",
      provider,
    };
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Error completing account linking: ${error.message}`
    );
    return { success: false, error: error.message };
  }
};

/**
 * Process the OAuth callback for account linking
 * @param {string} code - OAuth code from callback
 * @returns {Promise<Object>} Result of the processing
 */
export const processLinkingCallback = async (code) => {
  try {
    debugAuth.log("IdentityLinking", "Processing linking callback");

    // Get linking state
    const linkingState = getLinkingState();

    if (!linkingState.isLinking) {
      debugAuth.log("IdentityLinking", "Not in linking flow, skipping");
      return { success: false, error: "Not in linking flow" };
    }

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    if (!data?.session) {
      throw new Error("No session created from code");
    }

    debugAuth.log("IdentityLinking", "Successfully created session from code");

    // Call our custom function to link identities in backend
    const result = await callIdentityLinkingFunction(
      linkingState.email,
      linkingState.provider,
      {
        userId: data.session.user.id,
        sessionId: data.session.id,
      }
    );

    // Clear linking state
    clearLinkingState();

    return {
      success: true,
      message: "Account linking complete",
      ...result,
    };
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Error processing linking callback: ${error.message}`
    );
    return { success: false, error: error.message };
  }
};

/**
 * Call the Supabase Edge Function for identity linking
 * @param {string} email - Email address
 * @param {string} provider - Provider name
 * @param {Object} extraData - Additional data to pass
 * @returns {Promise<Object>} Result from the function
 */
export const callIdentityLinkingFunction = async (
  email,
  provider,
  extraData = {}
) => {
  try {
    if (!email || !provider) {
      throw new Error("Email and provider are required");
    }

    debugAuth.log(
      "IdentityLinking",
      `Calling identity-linking function for ${email} with ${provider}`
    );

    // Use the authenticated Supabase client to call the function
    const { data, error } = await supabase.functions.invoke(
      "identity-linking",
      {
        body: {
          email,
          provider,
          userData: {
            ...extraData,
            origin: window.location.origin,
          },
        },
      }
    );

    if (error) {
      throw error;
    }

    debugAuth.log("IdentityLinking", "Function call successful", data);

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Error calling function: ${error.message}`
    );
    return { success: false, error: error.message };
  }
};

// Specialized functions for specific providers
export const loginWithGoogle = async () => {
  return await enhancedSocialLogin("google");
};

export const loginWithApple = async () => {
  return await enhancedSocialLogin("apple");
};
