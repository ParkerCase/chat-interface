// src/components/auth/AuthHookFix.jsx

/**
 * This file provides a safer version of the useAuth hook
 * to prevent destructuring errors
 */

import { useAuth as originalUseAuth } from "../../context/AuthContext";

/**
 * A safer version of the useAuth hook that provides defaults
 * to prevent destructuring errors
 */
export const useAuth = () => {
  const auth = originalUseAuth() || {};

  // Provide default values for commonly used properties
  return {
    currentUser: auth.currentUser || null,
    loading: auth.loading || false,
    error: auth.error || null,
    isAdmin: auth.isAdmin || false,
    isInitialized: auth.isInitialized || false,
    mfaState: auth.mfaState || { required: false, verified: false },

    // Default function implementations
    login:
      auth.login ||
      (async () => ({ success: false, error: "Auth not initialized" })),
    logout: auth.logout || (async () => false),
    setError: auth.setError || (() => {}),

    // Add any other auth context properties that might be used
    ...auth,
  };
};

export default useAuth;
