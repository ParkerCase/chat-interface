// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";

// Create auth context with default values
const defaultContextValue = {
  currentUser: null,
  loading: true,
  error: "",
  session: null,
  login: async () => ({ success: false, error: "Auth not initialized" }),
  logout: async () => false,
  setError: () => {},
  isAdmin: false,
  isSuperAdmin: false,
  hasRole: () => false,
  hasPermission: () => false,
  isInitialized: false,
  mfaState: {
    required: false,
    verified: false,
  },
};

const AuthContext = createContext(defaultContextValue);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mfaState, setMfaState] = useState({
    required: false,
    verified: false,
  });

  const authListenerRef = useRef(null);

  // Login with email and password
  const login = async (email, password) => {
    try {
      setError("");
      setLoading(true);
      console.log("Attempting login with:", email);

      // Special case for admin test account
      if (email === "itsus@tatt2away.com" && password === "password") {
        console.log("Using test admin account");

        // Create admin user
        const adminUser = {
          id: "test-admin-id",
          email: "itsus@tatt2away.com",
          name: "Tatt2Away Admin",
          roles: ["super_admin", "admin", "user"],
          tier: "enterprise",
        };

        // Set in localStorage
        localStorage.setItem("currentUser", JSON.stringify(adminUser));
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");

        // Update state
        setCurrentUser(adminUser);
        setMfaState({ required: false, verified: true });

        return { success: true };
      }

      // Standard Supabase login
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) throw loginError;

      console.log("Login successful");

      // MFA is required by default for all users
      setMfaState({ required: true, verified: false });

      // Send verification code for email-based MFA
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      // Track when we sent the code
      sessionStorage.setItem("lastMfaCodeSent", Date.now().toString());

      return { success: true, requiresMfa: true };
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid credentials");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await supabase.auth.signOut();

      // Clear storage
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authStage");
      localStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfa_verified");

      // Reset state
      setCurrentUser(null);
      setSession(null);
      setMfaState({ required: false, verified: false });

      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  };

  // Verify MFA code
  const verifyMfa = async (methodId, verificationCode) => {
    try {
      console.log(`Verifying MFA code: ${verificationCode}`);

      // Special case for admin user
      if (currentUser?.email === "itsus@tatt2away.com") {
        console.log("Admin user - auto-verifying MFA");

        setMfaState({ required: false, verified: true });
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");

        return true;
      }

      // Email verification
      const { data, error } = await supabase.auth.verifyOtp({
        email: currentUser?.email,
        token: verificationCode,
        type: "email",
      });

      if (error) {
        // Check for "already verified" error which can be treated as success
        if (
          error.message?.includes("already confirmed") ||
          error.message?.includes("already logged in")
        ) {
          console.log("User already verified, treating as success");

          setMfaState({ required: false, verified: true });
          localStorage.setItem("authStage", "post-mfa");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");

          return true;
        }

        throw error;
      }

      // Success
      setMfaState({ required: false, verified: true });
      localStorage.setItem("authStage", "post-mfa");
      localStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfa_verified", "true");

      return true;
    } catch (error) {
      console.error("MFA verification error:", error);
      return false;
    }
  };

  // Check if user has a specific role
  const hasRole = useCallback(
    (role) => {
      if (!currentUser || !currentUser.roles) return false;

      // Super admin can act as any role
      if (currentUser.roles.includes("super_admin")) return true;

      return currentUser.roles.includes(role);
    },
    [currentUser]
  );

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permission) => {
      if (!currentUser) return false;

      // Super admin has all permissions
      if (currentUser.roles?.includes("super_admin")) return true;

      // Admin has most permissions
      if (currentUser.roles?.includes("admin")) {
        return !permission.startsWith("system.");
      }

      // Basic permission check for regular users
      if (
        permission.startsWith("user.") &&
        currentUser.roles?.includes("user")
      ) {
        return true;
      }

      return false;
    },
    [currentUser]
  );

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      if (!currentUser?.id) return false;

      // Update in Supabase profiles table
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.name,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id);

      if (error) throw error;

      // Update local state
      setCurrentUser((prev) => ({
        ...prev,
        name: profileData.name,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      }));

      // Update localStorage
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          ...currentUser,
          name: profileData.name,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
        })
      );

      return true;
    } catch (error) {
      console.error("Profile update error:", error);
      return false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Initializing auth state");

        // Get current session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          console.log("Active session found");
          setSession(sessionData.session);

          // Get user data
          const { data: userData } = await supabase.auth.getUser();

          if (userData?.user) {
            // Get profile data from profiles table
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Check MFA state from localStorage
            const mfaVerified =
              localStorage.getItem("mfa_verified") === "true" ||
              sessionStorage.getItem("mfa_verified") === "true";

            // Create user object
            const user = {
              id: userData.user.id,
              email: userData.user.email,
              name: profileData?.full_name || userData.user.email,
              firstName: profileData?.first_name || "",
              lastName: profileData?.last_name || "",
              roles: profileData?.roles || ["user"],
              tier: "enterprise",
              mfaVerified,
            };

            // Special case for admin user
            if (user.email === "itsus@tatt2away.com") {
              user.roles = ["super_admin", "admin", "user"];
            }

            // Update state
            setCurrentUser(user);
            setMfaState({
              required: !mfaVerified,
              verified: mfaVerified,
            });

            // Update localStorage
            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("isAuthenticated", "true");
          }
        } else {
          // Check localStorage as fallback
          const storedUser = localStorage.getItem("currentUser");
          const isAuthenticated =
            localStorage.getItem("isAuthenticated") === "true";

          if (storedUser && isAuthenticated) {
            try {
              const userData = JSON.parse(storedUser);

              // Check MFA state
              const mfaVerified =
                localStorage.getItem("mfa_verified") === "true" ||
                sessionStorage.getItem("mfa_verified") === "true";

              setCurrentUser(userData);
              setMfaState({
                required: !mfaVerified,
                verified: mfaVerified,
              });

              // Special case for test admin
              if (userData.email === "itsus@tatt2away.com") {
                userData.roles = ["super_admin", "admin", "user"];
                setMfaState({ required: false, verified: true });
              }
            } catch (e) {
              console.error("Error parsing stored user:", e);
              setCurrentUser(null);

              // Clear invalid data
              localStorage.removeItem("currentUser");
              localStorage.removeItem("isAuthenticated");
            }
          } else {
            setCurrentUser(null);
          }
        }

        setIsInitialized(true);
        setLoading(false);
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
        setIsInitialized(true);
      }
    };

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event);

      if (event === "SIGNED_IN" && session) {
        // Get user data
        const { data: userData } = await supabase.auth.getUser();

        if (userData?.user) {
          // Get profile data
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.user.id)
            .single();

          // Create user object
          const user = {
            id: userData.user.id,
            email: userData.user.email,
            name: profileData?.full_name || userData.user.email,
            firstName: profileData?.first_name || "",
            lastName: profileData?.last_name || "",
            roles: profileData?.roles || ["user"],
            tier: "enterprise",
          };

          // Special case for admin user
          if (user.email === "itsus@tatt2away.com") {
            user.roles = ["super_admin", "admin", "user"];
          }

          // Update state
          setCurrentUser(user);
          setSession(session);
          setMfaState({ required: true, verified: false });

          // Update localStorage
          localStorage.setItem("currentUser", JSON.stringify(user));
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("authStage", "pre-mfa");
        }
      } else if (event === "SIGNED_OUT") {
        // Reset state on sign out
        setCurrentUser(null);
        setSession(null);
        setMfaState({ required: false, verified: false });

        // Clear storage
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authStage");
        localStorage.removeItem("mfa_verified");
        sessionStorage.removeItem("mfa_verified");
      }
    });

    // Store subscription for cleanup
    authListenerRef.current = subscription;

    // Initialize auth
    initAuth();

    // Cleanup function
    return () => {
      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe();
      }
    };
  }, []);

  // Get active sessions
  const getActiveSessions = async () => {
    try {
      // Query the sessions table for the current user
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", currentUser?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Format session data
      return data.map((session) => ({
        id: session.id,
        browser: session.browser || "Unknown",
        device: session.device || "Unknown",
        ipAddress: session.ip_address || "0.0.0.0",
        lastActive: session.last_active || session.created_at,
        isCurrent: session.is_current || false,
        mfaVerified: session.mfa_verified || false,
      }));
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return [];
    }
  };

  // Terminate session
  const terminateSession = async (sessionId) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId);

      return !error;
    } catch (error) {
      console.error("Error terminating session:", error);
      return false;
    }
  };

  // Terminate all sessions except current
  const terminateAllSessions = async () => {
    try {
      // Get current session ID
      const currentSessionId = localStorage.getItem("sessionId");

      // Delete all sessions except current
      const { error } = await supabase
        .from("sessions")
        .delete()
        .neq("id", currentSessionId || "")
        .eq("user_id", currentUser?.id);

      return !error;
    } catch (error) {
      console.error("Error terminating all sessions:", error);
      return false;
    }
  };

  // Context value
  const value = {
    currentUser,
    loading,
    error,
    setError,
    session,
    login,
    logout,
    verifyMfa,
    updateProfile,
    isAdmin:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: currentUser?.roles?.includes("super_admin") || false,
    hasRole,
    hasPermission,
    isInitialized,
    mfaState,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
