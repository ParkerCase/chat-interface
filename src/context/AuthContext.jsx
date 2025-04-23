// src/context/AuthContext.jsx - Key enhancements for Supabase integration
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
  verifyMfa: async () => false,
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

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

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

      // Store email for MFA verification
      localStorage.setItem("pendingVerificationEmail", email);

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
      console.log("Logging out user");
      await supabase.auth.signOut();

      // Clear storage
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authStage");
      localStorage.removeItem("mfa_verified");
      localStorage.removeItem("pendingVerificationEmail");
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

      // Get the email to verify
      const emailToVerify =
        currentUser?.email || localStorage.getItem("pendingVerificationEmail");

      if (!emailToVerify) {
        console.error("No email found for verification");
        return false;
      }

      console.log(`Verifying code for email: ${emailToVerify}`);

      // Email verification
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailToVerify,
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

        console.error("MFA verification error:", error);
        return false;
      }

      // Success
      console.log("MFA verification successful");
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
      console.log("AuthContext: Checking hasRole", {
        role,
        currentUser: currentUser?.email,
        userRoles: currentUser?.roles,
        hasRole: currentUser?.roles?.includes(role),
      });

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

  // useEffect for initializing auth in AuthContext.jsx
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Initializing auth state");

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (sessionData?.session) {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) throw new Error("No user returned");

          let { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.user.id)
            .single();

          if (profileError && profileError.message.includes("No rows found")) {
            await supabase.from("profiles").insert({
              id: userData.user.id,
              email: userData.user.email,
              full_name: userData.user.email,
              roles: ["admin"],
              created_at: new Date().toISOString(),
            });

            // ✅ Re-fetch the profile so profileData is no longer undefined
            const { data: freshProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            profileData = freshProfile;
          }

          if (!profileData) {
            throw new Error("🚨 profileData is still undefined after fetch.");
          }

          const mfaVerified =
            localStorage.getItem("mfa_verified") === "true" ||
            sessionStorage.getItem("mfa_verified") === "true";

          const roles = profileData?.roles || ["admin"];
          const user = {
            id: userData.user.id,
            email: userData.user.email,
            name: profileData?.full_name || userData.user.email,
            firstName: profileData?.first_name || "",
            lastName: profileData?.last_name || "",
            roles,
            tier: profileData?.tier || "enterprise",
            mfaVerified,
          };

          console.log("✅ Fully constructed user object:", user);
          localStorage.setItem("currentUser", JSON.stringify(user));

          if (
            user.email === "itsus@tatt2away.com" ||
            user.email === "parker@tatt2away.com"
          ) {
            user.roles = ["super_admin", "admin", "user"];
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");
          }

          setCurrentUser(user);
          setMfaState({ required: !mfaVerified, verified: mfaVerified });
          localStorage.setItem("currentUser", JSON.stringify(user));
          localStorage.setItem("isAuthenticated", "true");

          if (profileError && profileError.message.includes("No rows found")) {
            await supabase.from("profiles").insert({
              id: user.id,
              email: user.email,
              full_name: user.name,
              roles: ["user"],
              created_at: new Date().toISOString(),
            });
          }
        } else {
          const storedUser = localStorage.getItem("currentUser");
          if (
            storedUser &&
            localStorage.getItem("isAuthenticated") === "true"
          ) {
            const parsedUser = JSON.parse(storedUser);
            const mfaVerified =
              localStorage.getItem("mfa_verified") === "true" ||
              sessionStorage.getItem("mfa_verified") === "true";
            setCurrentUser(parsedUser);
            setMfaState({ required: !mfaVerified, verified: mfaVerified });
          } else {
            setCurrentUser(null);
          }
        }
        setIsInitialized(true);
        setLoading(false);
      } catch (err) {
        console.error("Auth initialization error:", err);
        setLoading(false);
        setIsInitialized(true);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          // Step 1: Get the user from Supabase
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) throw new Error("No user returned");

          // Step 2: Get or create the user's profile
          let { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.user.id)
            .single();

          if (profileError && profileError.message.includes("No rows found")) {
            // Profile doesn't exist — create it
            await supabase.from("profiles").insert({
              id: userData.user.id,
              email: userData.user.email,
              full_name: userData.user.email,
              roles: ["admin"], // Default to admin
              created_at: new Date().toISOString(),
            });

            // ✅ Fetch the newly created profile
            const { data: freshProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            profileData = freshProfile;
          }

          // Step 3: Build the user object
          const roles = profileData?.roles || ["admin"];
          const user = {
            id: userData.user.id,
            email: userData.user.email,
            name: profileData?.full_name || userData.user.email,
            firstName: profileData?.first_name || "",
            lastName: profileData?.last_name || "",
            roles,
            tier: profileData?.tier || "enterprise",
          };

          // Step 4: Set MFA flags
          if (
            userData.user.app_metadata?.provider &&
            userData.user.app_metadata.provider !== "email"
          ) {
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");
            setMfaState({ required: false, verified: true });
          } else {
            localStorage.setItem("authStage", "pre-mfa");
            setMfaState({ required: true, verified: false });
          }

          // Step 5: Save user in context and localStorage
          console.log("🧠 Saving user to localStorage:", user);
          setCurrentUser(user);
          setSession(session);
          localStorage.setItem("currentUser", JSON.stringify(user));
          localStorage.setItem("isAuthenticated", "true");

          // Step 6: Reload to trigger AdminRoute rerender
          if (roles.includes("admin") || roles.includes("super_admin")) {
            window.location.reload();
          }
        } catch (err) {
          console.error("❌ Error during SIGNED_IN handling:", err);
        }
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setSession(null);
        setMfaState({ required: false, verified: false });
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authStage");
        localStorage.removeItem("mfa_verified");
        localStorage.removeItem("pendingVerificationEmail");
        sessionStorage.removeItem("mfa_verified");
      }
    });

    authListenerRef.current = subscription;
    initAuth();

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

  const value = {
    currentUser,
    loading,
    error,
    session,
    login,
    logout,
    register,
    verifyMfa,
    updateProfile,
    isAdmin:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: currentUser?.roles?.includes("super_admin") || false,
    hasRole: (role) => currentUser?.roles?.includes(role),
    hasPermission,
    isInitialized,
    mfaState,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
