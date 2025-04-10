// src/utils/authRedirect.js
import { supabase } from "../lib/supabase";
import { debugAuth } from "./authDebug";

// Setup auth event handling for critical operations
export const setupAuthRedirects = () => {
  // Listen for Supabase auth state changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    debugAuth.log("AuthRedirect", `Auth state change: ${event}`);

    // Handle specific auth events
    if (event === "MFA_CHALLENGE_VERIFIED") {
      debugAuth.log("AuthRedirect", "MFA verification successful, handling redirect");
      
      // Set multiple flags for better cross-component detection
      sessionStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfaSuccess", "true");
      sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
      sessionStorage.setItem("mfaRedirectPending", "true");
      sessionStorage.setItem("mfaRedirectTarget", "/admin");
      localStorage.setItem("isAuthenticated", "true");
      
      // Force immediate redirect for better user experience
      if (window.location.pathname.includes("/mfa") || window.location.pathname.includes("/verify")) {
        window.location.href = "/admin";
      } else {
        handleSuccessfulAuth();
      }
    } else if (event === "SIGNED_IN") {
      debugAuth.log("AuthRedirect", "User signed in, checking if we need to redirect");
      
      // Check if we're currently on an MFA verification page
      const isOnMfaPage = window.location.pathname.includes("/mfa") || 
                         window.location.pathname.includes("/verify");
      
      if (isOnMfaPage) {
        // CRITICAL FIX: If SIGNED_IN happens during MFA verification, consider it a success
        debugAuth.log("AuthRedirect", "SIGNED_IN detected during MFA verification - treating as successful verification");
        
        // Set all MFA success flags with multiple approaches for redundancy
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
        sessionStorage.setItem("mfaRedirectPending", "true");
        sessionStorage.setItem("mfaRedirectTarget", "/admin");
        localStorage.setItem("isAuthenticated", "true");
        
        // Force redirect to admin with multiple fallback approaches
        debugAuth.log("AuthRedirect", "Redirecting to admin after MFA SIGNED_IN event");
        
        // Attempt multiple approaches for better reliability
        window.location.href = "/admin";
        
        // Fallback with timeout and different redirect method
        setTimeout(() => {
          window.location.replace("/admin");
        }, 500);
        
        return;
      }
      
      // Check if this is a password change completion
      const passwordChanged = localStorage.getItem("passwordChanged");
      if (passwordChanged === "true") {
        debugAuth.log("AuthRedirect", "Detected password change completion");
        
        // Clear the flag
        localStorage.removeItem("passwordChanged");
        
        // Check if we're on the account page
        if (window.location.pathname.includes("/security") || 
            window.location.pathname.includes("/account") ||
            window.location.pathname.includes("/profile")) {
          debugAuth.log("AuthRedirect", "User on account page after password change, no redirect needed");
          
          // Don't redirect, just ensure authentication
          localStorage.setItem("isAuthenticated", "true");
        }
      }
      
      // Check if we're in an SSO flow
      const ssoAttempt = sessionStorage.getItem("ssoAttempt");
      if (ssoAttempt) {
        debugAuth.log("AuthRedirect", "SSO sign-in completion detected");
        sessionStorage.removeItem("ssoAttempt");
        sessionStorage.removeItem("ssoProvider");
        
        // Check if we need to run MFA verification
        checkMfaRequirement(session).then(needsMfa => {
          if (needsMfa) {
            debugAuth.log("AuthRedirect", "MFA required after SSO, redirecting to verification");
            window.location.href = "/mfa/verify?returnUrl=/admin";
          } else {
            debugAuth.log("AuthRedirect", "No MFA needed after SSO, redirecting to admin panel");
            window.location.href = "/admin";
          }
        });
      }
    } else if (event === "PASSWORD_RECOVERY") {
      debugAuth.log("AuthRedirect", "Password recovery successful");
      handleSuccessfulAuth();
    } else if (event === "USER_UPDATED") {
      debugAuth.log("AuthRedirect", "User updated (password changed)");
      // Don't redirect here - just show success message
    } else if (event === "SIGNED_OUT") {
      debugAuth.log("AuthRedirect", "User signed out");
      // If signed out while on a protected page, redirect to login
      const isProtectedPage = 
        !window.location.pathname.includes("/login") && 
        !window.location.pathname.includes("/auth/") &&
        !window.location.pathname.includes("/forgot-password") &&
        !window.location.pathname.includes("/reset-password");
      
      if (isProtectedPage) {
        debugAuth.log("AuthRedirect", "Signed out from protected page, redirecting to login");
        window.location.href = "/login";
      }
    }
  });

  return subscription; // Return for cleanup
};

// Async function to check if MFA is required
const checkMfaRequirement = async (session) => {
  if (!session) return false;
  
  try {
    // First check if we can retrieve the user from this session
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      debugAuth.log("AuthRedirect", "Error getting user data:", userError);
      return true; // Default to requiring MFA if we can't get user data
    }
    
    // Default to requiring MFA for all users in this application
    debugAuth.log("AuthRedirect", "MFA check result: Always requiring MFA for better security");
    return true;
    
  } catch (error) {
    debugAuth.log("AuthRedirect", "Exception checking MFA status:", error);
    return true; // Default to requiring MFA on error
  }
};

// Function to handle successful auth
const handleSuccessfulAuth = () => {
  // Check if we're on an auth-related page
  const isAuthPage =
    window.location.pathname.includes("/mfa") ||
    window.location.pathname.includes("/verify") ||
    window.location.pathname.includes("/reset") ||
    window.location.pathname.includes("/auth/");

  if (isAuthPage) {
    debugAuth.log("AuthRedirect", "On auth page, redirecting to admin panel");
    
    // Use both methods for better reliability
    window.location.href = "/admin";
    
    // Also set a flag for App.jsx to detect
    sessionStorage.setItem("mfaRedirectPending", "true");
    sessionStorage.setItem("mfaRedirectTarget", "/admin");
  }
};
