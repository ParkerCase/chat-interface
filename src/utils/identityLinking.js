// src/utils/identityLinking.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

/**
 * Stores information about a linking attempt in session storage
 *
 * @param {string} email - User's email address
 * @param {string} provider - OAuth provider (google, apple)
 */
export function storeLinkingState(email, provider) {
  sessionStorage.setItem("linkingFlow", "true");
  sessionStorage.setItem("linkingEmail", email);
  sessionStorage.setItem("linkingProvider", provider);
  sessionStorage.setItem("linkingStartedAt", Date.now().toString());
}

/**
 * Checks if we're in the middle of a linking flow
 *
 * @returns {Object} Linking status
 */
export function checkLinkingStatus() {
  const isLinking = sessionStorage.getItem("linkingFlow") === "true";
  const email = sessionStorage.getItem("linkingEmail");
  const provider = sessionStorage.getItem("linkingProvider");
  const startedAt = sessionStorage.getItem("linkingStartedAt");

  return {
    isLinking,
    email,
    provider,
    startedAt: startedAt ? parseInt(startedAt) : null,
  };
}

/**
 * Clears linking state
 */
export function clearLinkingState() {
  sessionStorage.removeItem("linkingFlow");
  sessionStorage.removeItem("linkingEmail");
  sessionStorage.removeItem("linkingProvider");
  sessionStorage.removeItem("linkingStartedAt");
}

/**
 * Initiates the identity linking process
 *
 * @param {string} email - User email
 * @param {string} provider - OAuth provider (google, apple)
 * @returns {Promise<Object>} Result of the operation
 */
export async function linkIdentity(email, provider) {
  try {
    debugAuth.log(
      "IdentityLinking",
      `Initiating linking for ${email} with ${provider}`
    );

    // First check if we already have a session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugAuth.log(
        "IdentityLinking",
        "User already has a session, checking if linking is needed"
      );

      // Check if the user already has this provider linked
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        throw new Error("Could not retrieve user data");
      }

      // Get provider identities
      const { data: identities } = await supabase.rpc("get_identities");
      const hasProvider = identities?.some((i) => i.provider === provider);

      if (hasProvider) {
        return {
          success: true,
          step: "complete",
          message: `Your account is already linked with ${provider}`,
        };
      }

      // If user is authenticated but doesn't have this provider, we'll send them to oauth
      storeLinkingState(email, provider);
      return {
        success: true,
        step: "start_oauth",
        message: `Please authorize with ${provider} to link your account`,
      };
    }

    // No existing session, we need to verify email ownership first

    // 1. Check if user with this email exists
    const { data: existingUser, error: userCheckError } = await supabase.rpc(
      "check_email_exists",
      { email_to_check: email }
    );

    if (userCheckError) {
      throw userCheckError;
    }

    if (!existingUser) {
      // No user with this email, they should just sign up normally
      return {
        success: false,
        error: "No account found with this email address",
      };
    }

    // 2. Send verification email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      throw otpError;
    }

    // Store the linking state
    storeLinkingState(email, provider);

    return {
      success: true,
      step: "verify_email",
      message: `We've sent a verification code to ${email}`,
    };
  } catch (error) {
    debugAuth.log("IdentityLinking", `Linking error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify email code during account linking
 *
 * @param {string} email - User email
 * @param {string} provider - OAuth provider (google, apple)
 * @param {string} code - Verification code
 * @returns {Promise<Object>} Result of verification
 */
export async function completeEmailVerification(email, provider, code) {
  try {
    debugAuth.log("IdentityLinking", `Verifying code for ${email}`);

    // Verify OTP
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      // Check for "already verified" errors which are actually ok
      if (
        error.message.includes("already been verified") ||
        error.message.includes("already confirmed")
      ) {
        debugAuth.log("IdentityLinking", "Email already verified, continuing");
      } else {
        throw error;
      }
    }

    debugAuth.log(
      "IdentityLinking",
      "Email verified successfully, proceeding to OAuth"
    );

    // Send to OAuth provider authorization
    return {
      success: true,
      step: "start_oauth",
      message: `Email verified. Please connect with ${provider} to complete linking`,
    };
  } catch (error) {
    debugAuth.log("IdentityLinking", `Verification error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start OAuth linking flow after email verification
 *
 * @param {string} provider - OAuth provider (google, apple)
 * @returns {Promise<Object>} Result of the OAuth initiation
 */
export async function startOAuthLinking(provider) {
  try {
    debugAuth.log("IdentityLinking", `Starting OAuth flow for ${provider}`);

    // Check if we have valid linking state
    const { isLinking, email } = checkLinkingStatus();
    if (!isLinking || !email) {
      throw new Error("Missing linking information");
    }

    // Store additional flag to identify this as a linking flow
    sessionStorage.setItem("linkingOAuthStarted", "true");

    // Start OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?linking=true`,
        queryParams: {
          // These options help with the OAuth flow
          access_type: "offline",
          prompt: "consent",
        },
        scopes: "email profile",
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      // Redirect to provider's OAuth page
      window.location.href = data.url;
      return { success: true, action: "redirecting" };
    }

    return { success: false, error: "No redirect URL received" };
  } catch (error) {
    debugAuth.log("IdentityLinking", `OAuth error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check and complete auto-linking process if in progress
 *
 * @returns {Promise<Object>} Result of auto-linking check
 */
export async function checkAndCompleteAutoLinking() {
  try {
    // Check if we're in linking flow
    const { isLinking, email, provider } = checkLinkingStatus();
    if (!isLinking) {
      return { isLinking: false };
    }

    debugAuth.log(
      "IdentityLinking",
      "Auto-linking in progress, checking status"
    );

    // Check if we have a session which would indicate successful linking
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugAuth.log(
        "IdentityLinking",
        "Session exists, linking may be complete"
      );

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Check if user has the provider identity
        const { data: identities } = await supabase.rpc("get_identities");
        const hasProvider = identities?.some((i) => i.provider === provider);

        if (hasProvider) {
          debugAuth.log(
            "IdentityLinking",
            "Provider identity confirmed, linking successful"
          );
          clearLinkingState();
          return {
            isLinking: true,
            isComplete: true,
            email,
            provider,
          };
        }
      }
    }

    return {
      isLinking: true,
      isComplete: false,
      email,
      provider,
    };
  } catch (error) {
    debugAuth.log(
      "IdentityLinking",
      `Auto-linking check error: ${error.message}`
    );
    return {
      isLinking: true,
      isComplete: false,
      error: error.message,
    };
  }
}

/**
 * Call Supabase Edge Function to link identities on the server-side
 *
 * @param {string} email - User email
 * @param {string} provider - OAuth provider (google, apple)
 * @returns {Promise<Object>} Result of server-side linking
 */
export async function callIdentityLinkingFunction(email, provider) {
  try {
    debugAuth.log(
      "IdentityLinking",
      `Calling identity-linking function for ${email}`
    );

    const { data, error } = await supabase.functions.invoke(
      "identity-linking",
      {
        body: {
          email,
          provider,
          userData: {
            device: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        },
      }
    );

    if (error) throw error;

    debugAuth.log(
      "IdentityLinking",
      `Function result: ${data.action || "unknown"}`
    );

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    debugAuth.log("IdentityLinking", `Function error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
