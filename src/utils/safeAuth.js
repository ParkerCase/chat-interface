// src/utils/safeAuth.js

/**
 * A safer version of the useAuth hook that never returns null
 * and provides default values for all commonly used properties
 */
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

export const useAuthSafe = () => {
  try {
    // Try to get the auth context
    const auth = useContext(AuthContext);

    // If auth context is null or undefined, return default object
    if (!auth) {
      console.warn("Auth context is not available, using fallback values");
      return getDefaultAuthValues();
    }

    // Return the actual auth context with fallbacks for any missing properties
    return {
      ...getDefaultAuthValues(),
      ...auth,
    };
  } catch (error) {
    console.error("Error accessing auth context:", error);
    return getDefaultAuthValues();
  }
};

/**
 * Default values for auth context to prevent null/undefined errors
 */
const getDefaultAuthValues = () => ({
  currentUser: null,
  loading: true, // Default to loading to prevent flash of redirects
  error: null,
  session: null,
  isAdmin: false,
  isSuperAdmin: false,
  isInitialized: false,
  mfaState: {
    required: false,
    inProgress: false,
    verified: false,
    data: null,
  },

  // Default function implementations
  login: async () => ({ success: false, error: "Auth not initialized" }),
  logout: async () => false,
  setError: () => {},
  hasRole: () => false,
  hasPermission: () => false,
  hasFeatureAccess: () => false,
  setupMfa: async () => ({ success: false, error: "Auth not initialized" }),
  confirmMfa: async () => false,
  verifyMfa: async () => false,
  removeMfa: async () => false,
  updateProfile: async () => false,
  getActiveSessions: async () => [],
  terminateSession: async () => false,
  terminateAllSessions: async () => false,
});

export default useAuthSafe;
