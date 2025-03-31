// src/utils/authRedirect.js
import { supabase } from "../lib/supabase";

// Setup auth event handling for critical operations
export const setupAuthRedirects = () => {
  // Listen for Supabase auth state changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state change:", event);

    // Handle specific auth events
    if (event === "MFA_CHALLENGE_VERIFIED") {
      console.log("MFA verification successful, handling redirect");
      handleSuccessfulAuth();
    } else if (event === "PASSWORD_RECOVERY") {
      console.log("Password recovery successful");
      handleSuccessfulAuth();
    } else if (event === "USER_UPDATED") {
      console.log("User updated (password changed)");
      // Don't redirect here - just show success message
    }
  });

  return subscription; // Return for cleanup
};

// Function to handle successful auth
const handleSuccessfulAuth = () => {
  // Check if we're on an auth-related page
  const isAuthPage =
    window.location.pathname.includes("/mfa") ||
    window.location.pathname.includes("/verify") ||
    window.location.pathname.includes("/reset");

  if (isAuthPage) {
    console.log("On auth page, redirecting to admin panel");
    window.location.href = "/admin";
  }
};
