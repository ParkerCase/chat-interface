// src/utils/autoLinking.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

/**
 * Handles automatic identity linking when a sign-in with OAuth detects
 * that the email already exists in the system.
 *
 * @param {string} email - User's email address
 * @param {string} provider - OAuth provider (google, apple)
 * @param {Object} providerData - Additional data from the provider
 * @returns {Promise<Object>} - Result of linking attempt
 */
export async function handleAutoLinking(email, provider, providerData = {}) {
  try {
    debugAuth.log(
      "AutoLinking",
      `Handling automatic linking for ${email} with ${provider}`
    );

    // Store linking state
    sessionStorage.setItem("autoLinking", "true");
    sessionStorage.setItem("linkingEmail", email);
    sessionStorage.setItem("linkingProvider", provider);

    // Call our edge function to handle linking
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "identity-linking",
      {
        body: {
          email,
          provider,
          userData: providerData,
        },
      }
    );

    if (fnError) {
      throw new Error(`Edge function error: ${fnError.message}`);
    }

    if (!fnData || !fnData.success) {
      throw new Error(fnData?.error || "Unknown error in identity linking");
    }

    // Handle different actions from the edge function
    switch (fnData.action) {
      case "created":
        // A new user was created
        debugAuth.log("AutoLinking", "New user created (no linking needed)");
        return {
          success: true,
          action: "created",
          user: fnData.user,
        };

      case "already_linked":
        // Provider is already linked
        debugAuth.log("AutoLinking", "Provider already linked");
        return {
          success: true,
          action: "already_linked",
          user: fnData.user,
        };

      case "link_initiated":
        // Edge function has prepared for linking
        debugAuth.log("AutoLinking", "Link initiated, auto-signing in user");

        // If we have a magic link, use it
        if (fnData.magicLink) {
          // Open the magic link in a hidden iframe to trigger the login
          // This is a trick to avoid a visible redirect
          const iframe = document.createElement("iframe");
          iframe.style.width = "0";
          iframe.style.height = "0";
          iframe.style.border = "none";
          iframe.style.position = "absolute";
          iframe.style.top = "-999px";

          // When loaded, remove the iframe
          iframe.onload = () => {
            setTimeout(() => {
              document.body.removeChild(iframe);

              // Check session after a moment
              setTimeout(async () => {
                const { data } = await supabase.auth.getSession();
                if (data?.session) {
                  debugAuth.log(
                    "AutoLinking",
                    "Auto-login successful via magic link"
                  );
                  // Refresh the page to update auth state
                  window.location.reload();
                }
              }, 1000);
            }, 500);
          };

          // Add to document and load the magic link
          document.body.appendChild(iframe);
          iframe.src = fnData.magicLink;

          return {
            success: true,
            action: "auto_login_started",
            email: email,
          };
        }

        // Alternative: Try to sign in with OTP
        debugAuth.log("AutoLinking", "No magic link, using OTP fallback");
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
          },
        });

        if (otpError) {
          throw new Error(`Failed to send login email: ${otpError.message}`);
        }

        return {
          success: true,
          action: "otp_sent",
          message: "Login email sent. Please check your inbox.",
        };

      default:
        debugAuth.log(
          "AutoLinking",
          `Unknown action from edge function: ${fnData.action}`
        );
        return {
          success: true,
          action: "unknown",
          message: "Account prepared for linking. Please sign in again.",
        };
    }
  } catch (error) {
    debugAuth.log("AutoLinking", `Error: ${error.message}`);
    // Clear linking state on error
    sessionStorage.removeItem("autoLinking");
    sessionStorage.removeItem("linkingEmail");
    sessionStorage.removeItem("linkingProvider");

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Checks for auto linking in progress and completes it if needed
 * @returns {Promise<Object>} Status of auto linking
 */
export async function checkAndCompleteAutoLinking() {
  const isLinking = sessionStorage.getItem("autoLinking") === "true";

  if (!isLinking) {
    return { isLinking: false };
  }

  const email = sessionStorage.getItem("linkingEmail");
  const provider = sessionStorage.getItem("linkingProvider");

  debugAuth.log(
    "AutoLinking",
    `Detected auto linking in progress for ${email} with ${provider}`
  );

  // Check if we have a session now
  const { data } = await supabase.auth.getSession();

  if (data?.session) {
    debugAuth.log(
      "AutoLinking",
      "Session exists, auto linking may be complete"
    );

    // Clear linking state
    sessionStorage.removeItem("autoLinking");
    sessionStorage.removeItem("linkingEmail");
    sessionStorage.removeItem("linkingProvider");

    return {
      isLinking: true,
      isComplete: true,
      email,
      provider,
    };
  }

  return {
    isLinking: true,
    isComplete: false,
    email,
    provider,
  };
}

/**
 * Clear any auto linking state
 */
export function clearAutoLinkingState() {
  sessionStorage.removeItem("autoLinking");
  sessionStorage.removeItem("linkingEmail");
  sessionStorage.removeItem("linkingProvider");
}
