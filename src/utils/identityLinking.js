// src/utils/identityLinking.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

/**
 * Manually link a user's account with a social provider
 * @param {string} email - User's email address
 * @param {string} provider - Provider to link (google, apple)
 * @returns {Promise<Object>} Result object
 */
export async function linkIdentity(email, provider) {
  try {
    debugAuth.log(
      "IdentityLinking",
      `Attempting to link ${email} with ${provider}`
    );

    // Start by checking if we have a session (are logged in)
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData?.session) {
      // Need to authenticate first - try OTP
      debugAuth.log(
        "IdentityLinking",
        "No session, initiating email verification"
      );

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        throw new Error(
          `Could not send verification email: ${otpError.message}`
        );
      }

      // Record when we sent the code
      sessionStorage.setItem("lastMfaCodeSent", Date.now().toString());
      sessionStorage.setItem("linkingEmail", email);
      sessionStorage.setItem("linkingProvider", provider);

      return {
        success: true,
        step: "verify_email",
        message:
          "Please check your email for a verification code to continue linking your account",
      };
    }

    // We have a session, call our edge function to prepare the linking
    debugAuth.log("IdentityLinking", "Calling identity-linking edge function");

    // Call edge function
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "identity-linking",
      {
        body: {
          email,
          provider,
          providerToken: sessionData.session.provider_token,
          providerRefreshToken: sessionData.session.provider_refresh_token,
        },
      }
    );

    if (fnError) {
      throw new Error(`Edge function error: ${fnError.message}`);
    }

    if (!fnData.success) {
      throw new Error(fnData.error || "Failed to prepare account linking");
    }

    // If we need to start OAuth flow
    if (fnData.action === "start_oauth_flow") {
      debugAuth.log(
        "IdentityLinking",
        "Need to start OAuth flow to complete linking"
      );

      // Start the OAuth flow
      return {
        success: true,
        step: "start_oauth",
        message:
          "Please authorize with your social account to complete linking",
        provider,
      };
    }

    // Success case
    return {
      success: true,
      step: "complete",
      message: fnData.message || `Successfully linked account with ${provider}`,
    };
  } catch (error) {
    debugAuth.log("IdentityLinking", `Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Complete identity linking with a verification code (for email OTP flow)
 * @param {string} email - User's email address
 * @param {string} provider - Provider to link
 * @param {string} code - Verification code
 * @returns {Promise<Object>} Result object
 */
export async function completeEmailVerification(email, provider, code) {
  try {
    debugAuth.log("IdentityLinking", `Verifying code for ${email}`);

    // Verify OTP code
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      // Special case for "already been verified" which is actually okay
      if (
        error.message?.includes("already been verified") ||
        error.message?.includes("already logged in")
      ) {
        debugAuth.log("IdentityLinking", "User already verified, continuing");
      } else {
        throw error;
      }
    }

    // Now we should have a session, call the edge function
    return await linkIdentity(email, provider);
  } catch (error) {
    debugAuth.log("IdentityLinking", `Verification error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start OAuth flow for identity linking
 * @param {string} provider - Provider to use (google, apple)
 * @returns {Promise<Object>} Result object
 */
export async function startOAuthLinking(provider) {
  try {
    debugAuth.log("IdentityLinking", `Starting OAuth flow for ${provider}`);

    // Set flags to identify this as an account linking flow
    sessionStorage.setItem("accountLinking", "true");
    sessionStorage.setItem("linkingProvider", provider);

    // Get the return URL for after OAuth
    const returnUrl = `${window.location.origin}/auth/callback?linking=true`;

    // Start OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: returnUrl,
        // Make sure we're requesting all needed scopes
        scopes: "email profile",
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      debugAuth.log(
        "IdentityLinking",
        `Redirecting to ${provider} for authorization`
      );
      // Redirect to OAuth URL
      window.location.href = data.url;
      return { success: true, action: "redirecting" };
    }

    throw new Error("No OAuth URL returned");
  } catch (error) {
    debugAuth.log("IdentityLinking", `OAuth error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if identity linking is in progress from OAuth callback
 * @returns {Object} Status object
 */
export function checkLinkingStatus() {
  const isLinking = sessionStorage.getItem("accountLinking") === "true";
  const provider = sessionStorage.getItem("linkingProvider");
  const email = sessionStorage.getItem("linkingEmail");

  return {
    isLinking,
    provider,
    email,
  };
}

/**
 * Clear linking session state
 */
export function clearLinkingState() {
  sessionStorage.removeItem("accountLinking");
  sessionStorage.removeItem("linkingProvider");
  sessionStorage.removeItem("linkingEmail");
}
