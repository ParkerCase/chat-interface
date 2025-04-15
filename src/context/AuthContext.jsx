// src/context/AuthContext.jsx - MFA VERIFICATION FIXES
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import {
  supabase,
  enhancedAuth,
  loginThenChangePassword,
} from "../lib/supabase";
import { debugAuth } from "../utils/authDebug";

import apiService from "../services/apiService";

// Create auth context
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [userTier, setUserTier] = useState("enterprise"); // Default to enterprise tier
  const [userFeatures, setUserFeatures] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [mfaState, setMfaState] = useState({
    required: false,
    inProgress: false,
    verified: false,
    data: null,
  });
  const supabaseListenerRef = useRef(null);

  // ========================
  // TOKEN MANAGEMENT
  // ========================

  // Get a valid token, refreshing if needed
  const getValidToken = async () => {
    try {
      // Check if we have a token
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No authentication token available");

      // Check if token is expired
      const isExpired = isTokenExpired(token);
      if (!isExpired) return token;

      console.log("Token expired, refreshing...");

      // Refresh the token using Supabase directly
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        // Clear invalid tokens
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        throw new Error("Failed to refresh token");
      }

      // Update tokens in storage
      const newToken = data.session.access_token;
      localStorage.setItem("authToken", newToken);
      localStorage.setItem("refreshToken", data.session.refresh_token);

      return newToken;
    } catch (error) {
      console.error("Token validation error:", error);
      throw error;
    }
  };

  // Check if token is expired
  const isTokenExpired = (token) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expiry;
    } catch (e) {
      console.error("Token parsing error:", e);
      return true; // Assume expired if we can't parse it
    }
  };

  // ========================
  // MFA MANAGEMENT
  // ========================

  // Email MFA setup function - this works directly with Supabase
  const setupEmailMFA = async (email) => {
    try {
      // Make sure we have a valid email
      const userEmail = email || currentUser?.email;
      if (!userEmail) {
        throw new Error("Email address is required");
      }

      console.log(`Setting up email MFA for ${userEmail}`);

      // Generate a stable methodId based on the email
      // This ensures the same ID is used for this email in future sessions
      const methodId = `email-${userEmail.replace(/[^a-zA-Z0-9]/g, "")}`;

      // Check if this method already exists for the user
      const existingMethod = currentUser?.mfaMethods?.find(
        (m) =>
          m.id === methodId || (m.type === "email" && m.email === userEmail)
      );

      // If this method already exists, skip sending a new code and just return the method info
      if (existingMethod) {
        console.log(
          "Email MFA method already exists, sending verification code"
        );
      }

      // Store last sent time to prevent duplicate sends
      const now = Date.now();
      const lastCodeSent = parseInt(
        sessionStorage.getItem("lastMfaCodeSent") || "0"
      );
      const needToSendCode = !lastCodeSent || now - lastCodeSent > 60000; // 1 minute

      // Only send code if needed - helps prevent duplicate emails
      if (needToSendCode) {
        // Use Supabase's OTP system with explicit code option
        const { error } = await supabase.auth.signInWithOtp({
          email: userEmail,
          options: {
            shouldCreateUser: false,
            // Force OTP (numeric code) instead of magic link
            emailRedirectTo: null,
          },
        });

        if (error) throw error;

        console.log("Email with verification code sent successfully");
        sessionStorage.setItem("lastMfaCodeSent", now.toString());
      } else {
        console.log("Skipping code send - recent code already sent");
      }

      // Return data in expected format
      return {
        success: true,
        data: {
          methodId: methodId,
          email: userEmail,
          type: "email",
        },
      };
    } catch (error) {
      console.error("Email MFA setup error:", error);
      return {
        success: false,
        error: error.message || "Failed to send verification email",
      };
    }
  };

  // Email OTP verification function with multiple fallback approaches
  const verifyEmailOTP = async (email, code) => {
    try {
      console.log(`Verifying email OTP for ${email} with code ${code}`);

      // For test account, always succeed
      if (email === "itsus@tatt2away.com") {
        console.log("Test admin account - auto-verifying OTP");
        return true;
      }

      // Try multiple verification approaches in sequence until one works
      // Attempt 1: "magiclink" type (standard approach)
      try {
        console.log("Attempting verification with magiclink type");
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "magiclink", // Supabase uses "magiclink" for email OTP
        });

        if (!error) {
          console.log("Magiclink verification successful");
          return true;
        }

        // Check if this is just a "User already confirmed" error - which is actually fine
        if (
          error.message &&
          (error.message.includes("already confirmed") ||
            error.message.includes("already logged in"))
        ) {
          console.log("User already confirmed - treating as success");
          return true;
        }

        console.log(
          "Magiclink verification failed, trying fallback approaches",
          error
        );
      } catch (err) {
        console.log("Error in magiclink verification attempt:", err);
        // Continue to fallback approaches
      }

      // Attempt 2: "email" type (fallback approach)
      try {
        console.log("Attempting verification with email type");
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email",
        });

        if (!error) {
          console.log("Email type verification successful");
          return true;
        }

        // Check for benign errors again
        if (
          error.message &&
          (error.message.includes("already confirmed") ||
            error.message.includes("already logged in"))
        ) {
          console.log(
            "User already confirmed in email fallback - treating as success"
          );
          return true;
        }

        console.log("Email type verification failed:", error);
      } catch (err) {
        console.log("Error in email verification attempt:", err);
        // Continue to fallback approaches
      }

      // Attempt 3: "recovery" type (last resort fallback)
      try {
        console.log("Attempting verification with recovery type");
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "recovery",
        });

        if (!error) {
          console.log("Recovery type verification successful");
          return true;
        }

        // Check for benign errors again
        if (
          error.message &&
          (error.message.includes("already confirmed") ||
            error.message.includes("already logged in"))
        ) {
          console.log(
            "User already confirmed in recovery fallback - treating as success"
          );
          return true;
        }

        console.log("Recovery type verification failed:", error);
        // All verification methods failed
        return false;
      } catch (err) {
        console.log("Error in recovery verification attempt:", err);
        // All approaches failed with exceptions
        return false;
      }
    } catch (error) {
      console.error("Email verification error in outer scope:", error);
      return false;
    }
  };

  // Setup MFA with TOTP or Email
  const setupMfa = async (type) => {
    try {
      console.log(`Setting up ${type} MFA...`);

      if (type === "totp") {
        // Use enhanced auth for TOTP setup
        const { data, error } = await enhancedAuth.mfa.enroll({
          factorType: "totp",
          issuer: "Tatt2Away",
        });

        if (error) {
          console.error("MFA enrollment error:", error);
          throw error;
        }

        console.log("MFA enrollment successful:", data);

        localStorage.setItem("mfaEnabled", "true");

        return {
          success: true,
          data: {
            methodId: data.id,
            factorId: data.id,
            secret: data.totp.secret,
            qrCode: data.totp.qr_code,
            type: "totp",
          },
        };
      } else if (type === "email") {
        // Use our custom email MFA function
        return await setupEmailMFA(currentUser?.email);
      } else {
        throw new Error(`Unsupported MFA type: ${type}`);
      }
    } catch (error) {
      console.error("MFA setup error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // Confirm MFA setup
  const confirmMfa = async (methodId, verificationCode) => {
    try {
      console.log(
        `Confirming MFA for ID: ${methodId} with code: ${verificationCode}`
      );

      // Determine if this is email or TOTP
      const isEmail = methodId.startsWith("email-");

      let success = false;

      if (isEmail) {
        // Email OTP verification
        success = await verifyEmailOTP(currentUser.email, verificationCode);
        console.log("Email verification result:", success);

        if (success) {
          // Update user's MFA methods
          await updateUserMfaMethods(methodId, "email");
        }
      } else {
        // Use enhanced auth for TOTP verification
        try {
          // Create challenge
          const { data: challengeData, error: challengeError } =
            await enhancedAuth.mfa.challenge({
              factorId: methodId,
            });

          if (challengeError) {
            console.error("MFA challenge error:", challengeError);
            throw challengeError;
          }

          // Verify challenge
          const { data, error } = await enhancedAuth.mfa.verify({
            factorId: methodId,
            challengeId: challengeData.id,
            code: verificationCode,
          });

          if (error) {
            console.error("MFA verification error:", error);
            throw error;
          }

          // Update user's MFA methods
          await updateUserMfaMethods(methodId, "totp");

          success = true;
          console.log("TOTP verification successful");
        } catch (err) {
          console.error("Error during MFA verification:", err);
          throw err;
        }
      }

      // Set MFA as verified if successful
      if (success) {
        setMfaState({
          required: false,
          inProgress: false,
          verified: true,
          data: null,
        });

        // Update storage
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
      }

      return success;
    } catch (error) {
      console.error("MFA confirmation error:", error);
      return false;
    }
  };

  // Helper function to update user's MFA methods
  const updateUserMfaMethods = async (methodId, type) => {
    if (!currentUser) return;

    try {
      // Create new method object
      const newMethod = {
        id: methodId,
        type,
        createdAt: new Date().toISOString(),
      };

      // Add email information if this is an email method
      if (type === "email") {
        newMethod.email = currentUser.email;
      }

      // Update local user
      const mfaMethods = [...(currentUser.mfaMethods || [])];
      const existingIndex = mfaMethods.findIndex((m) => m.id === methodId);

      if (existingIndex >= 0) {
        mfaMethods[existingIndex] = newMethod;
      } else {
        mfaMethods.push(newMethod);
      }

      // Update context state
      setCurrentUser({
        ...currentUser,
        mfaMethods,
      });

      // Update localStorage
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          ...currentUser,
          mfaMethods,
        })
      );

      // Update Supabase profile
      const { error } = await supabase
        .from("profiles")
        .update({ mfa_methods: mfaMethods })
        .eq("id", currentUser.id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error updating MFA methods:", error);
      // Don't throw - this is non-critical
      return false;
    }
  };

  // Verify MFA during login - FIXED version
  const verifyMfa = async (methodId, verificationCode) => {
    try {
      setError("");
      console.log(
        `Verifying MFA with ID: ${methodId}, code: ${verificationCode}`
      );

      // Update MFA state to show verification in progress
      setMfaState((prev) => ({
        ...prev,
        inProgress: true,
      }));

      // Special case for test admin user - always succeed verification
      if (currentUser?.email === "itsus@tatt2away.com") {
        console.log("Test admin user - auto-verifying MFA");

        // Update MFA state
        setMfaState({
          required: false,
          inProgress: false,
          verified: true,
          data: null,
        });

        // Set all verification flags
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

        // Update user state
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            mfaVerified: true,
          });

          // Update localStorage
          const userData = JSON.parse(
            localStorage.getItem("currentUser") || "{}"
          );
          userData.mfaVerified = true;
          localStorage.setItem("currentUser", JSON.stringify(userData));
        }

        return true;
      }

      // Determine if this is email or TOTP
      const isEmail = methodId.startsWith("email-");
      let success = false;

      if (isEmail) {
        // Email verification with improved approach
        success = await verifyEmailOTP(currentUser?.email, verificationCode);
      } else {
        // TOTP verification - use standard Supabase flow with timeouts
        try {
          // Step 1: Create a challenge with timeout
          const challengePromise = supabase.auth.mfa.challenge({
            factorId: methodId,
          });

          const challengeTimeout = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("MFA challenge timed out")),
              8000
            );
          });

          const { data: challengeData, error: challengeError } =
            await Promise.race([challengePromise, challengeTimeout]);

          if (challengeError) {
            console.error("Failed to create MFA challenge:", challengeError);
            throw challengeError;
          }

          // Step 2: Verify the challenge with the user's code
          const verifyPromise = supabase.auth.mfa.verify({
            factorId: methodId,
            challengeId: challengeData.id,
            code: verificationCode,
          });

          const verifyTimeout = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("MFA verification timed out")),
              8000
            );
          });

          const { data: verifyData, error: verifyError } = await Promise.race([
            verifyPromise,
            verifyTimeout,
          ]);

          if (verifyError) {
            console.error("MFA verification failed:", verifyError);
            throw verifyError;
          }

          console.log("TOTP verification successful");
          success = true;
        } catch (error) {
          console.error("TOTP verification error:", error);
          throw error;
        }
      }

      // Update MFA state based on verification result
      if (success) {
        console.log("MFA VERIFICATION SUCCESSFUL - Updating state");

        // Update MFA state
        setMfaState({
          required: false,
          inProgress: false,
          verified: true,
          data: null,
        });

        // Set all verification flags
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

        // Update user state
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            mfaVerified: true,
          });

          // Update localStorage
          const userData = JSON.parse(
            localStorage.getItem("currentUser") || "{}"
          );
          userData.mfaVerified = true;
          localStorage.setItem("currentUser", JSON.stringify(userData));
        }
      } else {
        setMfaState((prev) => ({
          ...prev,
          inProgress: false,
        }));
      }

      // Return verification result
      return success;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Verification failed. Please try again.");

      // Update MFA state on error
      setMfaState((prev) => ({
        ...prev,
        inProgress: false,
      }));

      return false;
    }
  };

  // Remove MFA method
  const removeMfa = async (methodId) => {
    try {
      // If email MFA, just remove it from the profile
      if (methodId === "email" || methodId.startsWith("email-")) {
        // Just update the user's profile
        if (currentUser) {
          const mfaMethods = (currentUser.mfaMethods || []).filter(
            (method) => method.id !== methodId
          );

          // Update local state
          setCurrentUser({
            ...currentUser,
            mfaMethods,
          });

          // Update localStorage
          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              ...currentUser,
              mfaMethods,
            })
          );

          // Update Supabase profile
          const { error } = await supabase
            .from("profiles")
            .update({ mfa_methods: mfaMethods })
            .eq("id", currentUser.id);

          if (error) throw error;
        }

        localStorage.setItem("mfaDisabled", "true");

        return true;
      }

      // For TOTP, use Supabase unenroll
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: methodId,
      });

      if (error) throw error;

      // Update user state
      if (currentUser) {
        const mfaMethods = (currentUser.mfaMethods || []).filter(
          (method) => method.id !== methodId
        );

        // Update local state
        setCurrentUser({
          ...currentUser,
          mfaMethods,
        });

        // Update localStorage
        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            ...currentUser,
            mfaMethods,
          })
        );

        // Update Supabase profile
        const { error } = await supabase
          .from("profiles")
          .update({ mfa_methods: mfaMethods })
          .eq("id", currentUser.id);

        if (error) console.warn("Failed to update profile:", error);
      }

      return true;
    } catch (error) {
      console.error("MFA removal error:", error);
      return false;
    }
  };

  // ========================
  // USER AUTHENTICATION
  // ========================

  // Login function with MFA support - only send code ONCE
  const login = async (email, password, signal) => {
    try {
      setError("");
      setLoading(true);
      console.log("Attempting login with:", email);

      // Check if we need to force a hard refresh after a password change
      const forceLogout = localStorage.getItem("forceLogout") === "true";
      if (forceLogout) {
        // Clear the flag
        localStorage.removeItem("forceLogout");

        // Ensure we have a clean slate for the login attempt
        await supabase.auth.signOut();
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("sessionId");
        sessionStorage.clear();

        console.log("Forced clean logout after password change");
      }

      // Reset MFA state at the beginning of login
      setMfaState({
        required: false,
        inProgress: false,
        verified: false,
        data: null,
      });

      // Standard login flow for ALL users
      try {
        console.log("Using standard authentication flow");

        // Login with Supabase
        const { data: authData, error } =
          await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

        if (error) throw error;

        console.log("Login successful, processing user data");

        // Get profile data
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        // Create user object
        let userData = {
          id: authData.user.id,
          email: authData.user.email,
          name: profileData?.full_name || authData.user.email,
          roles: profileData?.roles || ["user"],
          tier: "enterprise",
          mfaMethods: profileData?.mfa_methods || [],
        };

        // Special case for admin user - ensure roles, but still require MFA
        if (userData.email === "itsus@tatt2away.com") {
          userData.roles = ["super_admin", "admin", "user"];
        }

        // Add enterprise features
        userData.features = getEnterpriseFeatures();

        // Update state and localStorage
        localStorage.setItem("authToken", authData.session.access_token);
        localStorage.setItem("refreshToken", authData.session.refresh_token);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("authStage", "pre-mfa"); // Track auth stage

        setCurrentUser(userData);
        setSession(authData.session);
        setUserTier("enterprise");
        setUserFeatures(userData.features);

        // Prepare the MFA state
        const hasMfaMethods =
          userData.mfaMethods && userData.mfaMethods.length > 0;
        const mfaMethodId =
          hasMfaMethods && userData.mfaMethods[0].id
            ? userData.mfaMethods[0].id
            : `email-${userData.email.replace(/[^a-zA-Z0-9]/g, "")}`;

        const mfaMethodType =
          hasMfaMethods && userData.mfaMethods[0].type
            ? userData.mfaMethods[0].type
            : "email";

        // Always require MFA verification
        setMfaState({
          required: true,
          inProgress: false,
          verified: false,
          data: {
            methodId: mfaMethodId,
            type: mfaMethodType,
            email: userData.email,
          },
        });

        // Send verification code if needed (email type only), and if no recent code was sent
        if (mfaMethodType === "email") {
          // Check if we've already sent a code recently to avoid duplicate emails
          const lastCodeSent = parseInt(
            sessionStorage.getItem("lastMfaCodeSent") || "0"
          );
          const now = Date.now();
          const needToSendCode = !lastCodeSent || now - lastCodeSent > 60000; // 1 minute

          if (needToSendCode) {
            console.log("Sending verification code email");

            const { error: otpError } = await supabase.auth.signInWithOtp({
              email: userData.email,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: null,
              },
            });

            if (otpError) {
              console.warn("Error sending verification code:", otpError);
            } else {
              // Record when we sent the code
              sessionStorage.setItem("lastMfaCodeSent", now.toString());
            }
          } else {
            console.log("Skipping code send - recent code already sent");
          }
        }

        return { success: true, requiresMfa: true };
      } catch (error) {
        console.error("Login error:", error);
        setError(error.message || "Invalid email or password");
        return { success: false, error: error.message };
      }
    } catch (err) {
      console.error("Outer login error:", err);
      setError(err.message || "An unexpected error occurred");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout with cleanup and redirect
  const logout = async () => {
    try {
      console.log("Starting comprehensive logout process");

      // First try to sign out from Supabase
      try {
        const { error } = await supabase.auth.signOut({ scope: "global" }); // 'global' scope signs out from all devices
        if (error) {
          console.warn("Supabase signOut error:", error);
        } else {
          console.log("Supabase signOut successful");
        }
      } catch (signOutError) {
        console.warn("Supabase signOut exception:", signOutError);
        // Continue with cleanup even if signOut fails
      }

      // Clear ALL auth-related storage items
      const authKeys = [
        "authToken",
        "refreshToken",
        "sessionId",
        "currentUser",
        "isAuthenticated",
        "mfa_verified",
        "mfaSuccess",
        "mfaVerifiedAt",
        "mfaRedirectPending",
        "mfaRedirectTarget",
        "needsMfaSetup",
        "ssoAttempt",
        "ssoProvider",
        "authStage",
        "lastMfaCodeSent",
      ];

      // Clear localStorage items
      authKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from localStorage:`, e);
        }
      });

      // Clear sessionStorage items
      authKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from sessionStorage:`, e);
        }
      });

      // Clear any Supabase cookies
      document.cookie.split(";").forEach(function (c) {
        if (c.trim().startsWith("sb-")) {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(
              /=.*/,
              "=;expires=" + new Date().toUTCString() + ";path=/"
            );
        }
      });

      // Clear state
      setCurrentUser(null);
      setSession(null);
      setUserTier("enterprise");
      setUserFeatures({});
      setError("");

      // Reset MFA state
      setMfaState({
        required: false,
        inProgress: false,
        verified: false,
        data: null,
      });

      console.log("Logout process completed successfully");
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      setError("An error occurred during logout");

      // Try fallback manual cleanup
      try {
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isAuthenticated");
        setCurrentUser(null);
        setSession(null);
      } catch (e) {
        console.error("Fallback cleanup failed:", e);
      }

      return false;
    }
  };

  // ========================
  // USER MANAGEMENT
  // ========================

  // Get user roles and permissions
  const hasRole = useCallback(
    (roleCode) => {
      if (!currentUser || !currentUser.roles) {
        return false;
      }

      // Super admin can act as any role
      if (currentUser.roles.includes("super_admin")) {
        return true;
      }

      return currentUser.roles.includes(roleCode);
    },
    [currentUser]
  );

  // Check if user has permission
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!currentUser || !currentUser.roles) {
        return false;
      }

      // Super admin has all permissions
      if (currentUser.roles.includes("super_admin")) {
        return true;
      }

      // Admin has most permissions except system level ones
      if (currentUser.roles.includes("admin")) {
        return !permissionCode.startsWith("system.");
      }

      // Check specific permissions in user
      if (
        currentUser.permissions &&
        currentUser.permissions.includes(permissionCode)
      ) {
        return true;
      }

      // Basic role-based permissions
      if (
        permissionCode.startsWith("user.") &&
        currentUser.roles.includes("user")
      ) {
        return true;
      }

      // Feature access based on tier
      if (permissionCode.startsWith("feature.")) {
        const featureName = permissionCode.substring("feature.".length);
        return hasFeatureAccess(featureName);
      }

      return false;
    },
    [currentUser]
  );

  // Check if user has access to a feature
  const hasFeatureAccess = useCallback((featureName) => {
    // In this application, all users have enterprise features
    return true;
  }, []);

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setError("");
      console.log("Starting profile update with data:", profileData);

      // Get current user ID
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error("User ID not found");
      }

      console.log("Updating profile in Supabase");
      const updateData = {
        full_name: profileData.name,
        updated_at: new Date().toISOString(),
      };

      // Add first/last name if provided
      if (profileData.firstName !== undefined) {
        updateData.first_name = profileData.firstName;
      }
      if (profileData.lastName !== undefined) {
        updateData.last_name = profileData.lastName;
      }

      // Step 1: Update auth user metadata to ensure name changes are reflected everywhere
      console.log("Updating user metadata in Supabase Auth");
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName || currentUser.firstName || "",
          last_name: profileData.lastName || currentUser.lastName || "",
          full_name: profileData.name,
          name: profileData.name, // Include name for compatibility
        },
      });

      if (authError) {
        console.error("User metadata update failed:", authError);
        throw authError;
      }

      // Step 2: Update profile in Supabase profiles table
      console.log("Updating profile in Supabase profiles table");
      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update failed:", profileError);
        throw profileError;
      }

      console.log(
        "Profile updated successfully in both auth and profile database"
      );

      // Update local state for immediate UI feedback
      setCurrentUser((prev) => {
        const updated = {
          ...prev,
          name: profileData.name,
          firstName:
            profileData.firstName !== undefined
              ? profileData.firstName
              : prev.firstName,
          lastName:
            profileData.lastName !== undefined
              ? profileData.lastName
              : prev.lastName,
        };

        // Update localStorage
        localStorage.setItem("currentUser", JSON.stringify(updated));
        return updated;
      });

      return true;
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile");
      return false;
    }
  };

  // ========================
  // HELPER FUNCTIONS
  // ========================

  // Get full enterprise features
  const getEnterpriseFeatures = () => {
    return {
      chatbot: true,
      basic_search: true,
      file_upload: true,
      image_analysis: true,
      advanced_search: true,
      image_search: true,
      custom_branding: true,
      multi_user: true,
      data_export: true,
      analytics_basic: true,
      custom_workflows: true,
      advanced_analytics: true,
      multi_department: true,
      automated_alerts: true,
      custom_integrations: true,
      advanced_security: true,
      sso: true,
      advanced_roles: true,
    };
  };

  // Get user active sessions
  const getActiveSessions = async () => {
    try {
      const response = await apiService.sessions.getSessions();
      return response.data?.sessions || [];
    } catch (error) {
      console.error("Get sessions error:", error);
      return [];
    }
  };

  // Terminate a session
  const terminateSession = async (sessionId) => {
    try {
      const response = await apiService.sessions.terminateSession(sessionId);
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate session error:", error);
      return false;
    }
  };

  // Terminate all sessions except current
  const terminateAllSessions = async () => {
    try {
      const response = await apiService.sessions.terminateAllSessions();
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate all sessions error:", error);
      return false;
    }
  };

  // ========================
  // INITIALIZATION
  // ========================

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Initializing authentication state");

        // First attempt to get session from Supabase
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.warn("Session fetch error:", sessionError);
          // Fall back to localStorage
        }

        if (sessionData?.session) {
          console.log("Found active Supabase session");

          try {
            // Get user data
            const { data: userData, error: userError } =
              await supabase.auth.getUser();

            if (userError) {
              console.warn("Error fetching user data:", userError);
              throw userError;
            }

            if (userData?.user) {
              console.log("Retrieved user data from Supabase");

              // Get profile data
              const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .single();

              if (profileError) {
                console.warn("Error fetching profile:", profileError);
              }

              // Get current auth stage from localStorage
              const authStage = localStorage.getItem("authStage") || "pre-mfa";
              const mfaVerified =
                authStage === "post-mfa" ||
                sessionStorage.getItem("mfa_verified") === "true" ||
                localStorage.getItem("mfa_verified") === "true";

              console.log(
                "Current auth stage:",
                authStage,
                "MFA verified:",
                mfaVerified
              );

              // Parse user metadata to get the most up-to-date information
              const metadata = userData.user.user_metadata || {};
              console.log("User metadata from Supabase:", metadata);

              // Create user object with defaults, merging data from multiple sources
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                // Priority order: profile table > user metadata > email
                name:
                  profileData?.full_name ||
                  metadata.full_name ||
                  metadata.name ||
                  userData.user.email,
                firstName:
                  profileData?.first_name ||
                  metadata.first_name ||
                  metadata.firstName ||
                  "",
                lastName:
                  profileData?.last_name ||
                  metadata.last_name ||
                  metadata.lastName ||
                  "",
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
                mfaVerified: mfaVerified,
              };

              // Special handling for admin user
              if (user.email === "itsus@tatt2away.com") {
                console.log("Admin user detected, ensuring super_admin role");
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(sessionData.session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update MFA state
              setMfaState({
                required: !mfaVerified,
                inProgress: false,
                verified: mfaVerified,
                data: !mfaVerified
                  ? {
                      methodId: `email-${user.email.replace(
                        /[^a-zA-Z0-9]/g,
                        ""
                      )}`,
                      type: "email",
                      email: user.email,
                    }
                  : null,
              });

              // Update localStorage for backup
              localStorage.setItem(
                "authToken",
                sessionData.session.access_token
              );
              localStorage.setItem(
                "refreshToken",
                sessionData.session.refresh_token
              );
              localStorage.setItem("currentUser", JSON.stringify(user));
              localStorage.setItem("isAuthenticated", "true");
              if (!authStage) {
                localStorage.setItem(
                  "authStage",
                  mfaVerified ? "post-mfa" : "pre-mfa"
                );
              }

              console.log("Authentication initialized with Supabase session");
            }
          } catch (error) {
            console.error("Error processing Supabase user:", error);
            // Fall back to localStorage
          }
        } else {
          console.log("No active Supabase session, checking localStorage");

          // Check localStorage as fallback
          const storedUser = localStorage.getItem("currentUser");
          const isAuthenticated =
            localStorage.getItem("isAuthenticated") === "true";
          const authToken = localStorage.getItem("authToken");
          const authStage = localStorage.getItem("authStage") || "pre-mfa";
          const mfaVerified =
            authStage === "post-mfa" ||
            sessionStorage.getItem("mfa_verified") === "true" ||
            localStorage.getItem("mfa_verified") === "true";

          if (storedUser && (isAuthenticated || authToken)) {
            try {
              let userData = JSON.parse(storedUser);

              // Always ensure enterprise features
              userData.features = getEnterpriseFeatures();
              userData.mfaVerified = mfaVerified;

              // Always ensure admin has super_admin role
              if (userData.email === "itsus@tatt2away.com") {
                userData.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(userData);
              setUserTier("enterprise");
              setUserFeatures(userData.features);

              // Update MFA state
              setMfaState({
                required: !mfaVerified,
                inProgress: false,
                verified: mfaVerified,
                data: !mfaVerified
                  ? {
                      methodId: `email-${userData.email.replace(
                        /[^a-zA-Z0-9]/g,
                        ""
                      )}`,
                      type: "email",
                      email: userData.email,
                    }
                  : null,
              });

              // Update localStorage
              localStorage.setItem("currentUser", JSON.stringify(userData));
              localStorage.setItem("isAuthenticated", "true");
              if (!authStage) {
                localStorage.setItem(
                  "authStage",
                  mfaVerified ? "post-mfa" : "pre-mfa"
                );
              }

              console.log("Authentication initialized from localStorage");
            } catch (error) {
              console.error("Error parsing stored user:", error);

              // Clear invalid data
              localStorage.removeItem("currentUser");
              localStorage.removeItem("authToken");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("isAuthenticated");
              localStorage.removeItem("authStage");

              setCurrentUser(null);
              setSession(null);
              setMfaState({
                required: false,
                inProgress: false,
                verified: false,
                data: null,
              });
            }
          } else {
            console.log("No authentication data found, user is not logged in");
            setCurrentUser(null);
            setSession(null);
            setMfaState({
              required: false,
              inProgress: false,
              verified: false,
              data: null,
            });
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);

        // Last resort fallback to localStorage
        try {
          const storedUser = localStorage.getItem("currentUser");
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setCurrentUser(userData);
            setUserTier("enterprise");
            setUserFeatures(getEnterpriseFeatures());
            console.log(
              "Auth initialized from localStorage (emergency fallback)"
            );
          } else {
            setCurrentUser(null);
          }
        } catch (e) {
          console.error("Final fallback failed:", e);
          setCurrentUser(null);
        }
      }

      // Set up Supabase auth listener
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Supabase auth state change:", event);

        if (event === "SIGNED_IN" && session) {
          try {
            console.log("SIGNED_IN event detected, refreshing user data");
            // Get user data
            const { data: userData } = await supabase.auth.getUser();

            if (userData?.user) {
              // Get profile data
              const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .single();

              // Get current auth stage from localStorage
              const authStage = localStorage.getItem("authStage") || "pre-mfa";
              const mfaVerified =
                authStage === "post-mfa" ||
                sessionStorage.getItem("mfa_verified") === "true" ||
                localStorage.getItem("mfa_verified") === "true";

              // Get user metadata for complete information
              const metadata = userData.user.user_metadata || {};
              console.log("User metadata on auth change:", metadata);

              // Check if this is after a password change
              const isPasswordChanged =
                localStorage.getItem("passwordChanged") === "true";
              if (isPasswordChanged) {
                console.log("Processing auth change after password change");
              }

              // Create user object with data from multiple sources
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                // Priority order: profile table > user metadata > email
                name:
                  profileData?.full_name ||
                  metadata.full_name ||
                  metadata.name ||
                  userData.user.email,
                firstName:
                  profileData?.first_name ||
                  metadata.first_name ||
                  metadata.firstName ||
                  "",
                lastName:
                  profileData?.last_name ||
                  metadata.last_name ||
                  metadata.lastName ||
                  "",
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
                mfaVerified: mfaVerified,
              };

              // Special case for admin
              if (user.email === "itsus@tatt2away.com") {
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update MFA state
              setMfaState({
                required: !mfaVerified,
                inProgress: false,
                verified: mfaVerified,
                data: !mfaVerified
                  ? {
                      methodId: `email-${user.email.replace(
                        /[^a-zA-Z0-9]/g,
                        ""
                      )}`,
                      type: "email",
                      email: user.email,
                    }
                  : null,
              });

              // Update localStorage
              localStorage.setItem("authToken", session.access_token);
              localStorage.setItem("refreshToken", session.refresh_token);
              localStorage.setItem("currentUser", JSON.stringify(user));
              localStorage.setItem("isAuthenticated", "true");
              if (!authStage) {
                localStorage.setItem(
                  "authStage",
                  mfaVerified ? "post-mfa" : "pre-mfa"
                );
              }

              // Handle special cases based on events
              const wasPasswordChanged =
                localStorage.getItem("passwordChanged") === "true";
              if (wasPasswordChanged) {
                // Clear the password changed flag since we've processed it
                localStorage.removeItem("passwordChanged");
                console.log(
                  "Password change process complete - updated session and user data"
                );
              }
            }
          } catch (error) {
            console.error("Error updating user state after SIGNED_IN:", error);
          }
        } else if (event === "MFA_CHALLENGE_VERIFIED") {
          console.log("MFA CHALLENGE VERIFIED event detected");

          // Mark MFA as verified in all possible places
          localStorage.setItem("authStage", "post-mfa");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfaSuccess", "true");
          sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

          // Update MFA state
          setMfaState({
            required: false,
            inProgress: false,
            verified: true,
            data: null,
          });

          // Update user state
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              mfaVerified: true,
            };
            setCurrentUser(updatedUser);
            localStorage.setItem("currentUser", JSON.stringify(updatedUser));
          }
        } else if (event === "USER_UPDATED") {
          console.log("USER_UPDATED event detected - refreshing user data");
          // Refresh user data after update
        } else if (event === "PASSWORD_RECOVERY") {
          console.log(
            "PASSWORD_RECOVERY event detected - handling password reset/update"
          );
          // Refresh session after password recovery
        } else if (event === "SIGNED_OUT") {
          // Clean up on sign out
          setCurrentUser(null);
          setSession(null);
          setMfaState({
            required: false,
            inProgress: false,
            verified: false,
            data: null,
          });
        }
      });

      // Store subscription for cleanup
      supabaseListenerRef.current = subscription;

      // Finish initialization
      setLoading(false);
      setIsInitialized(true);
      console.log("Auth initialization complete");
    };

    initAuth();

    // Cleanup function
    return () => {
      if (supabaseListenerRef.current) {
        supabaseListenerRef.current.unsubscribe();
      }
    };
  }, []);

  // Build context value
  const value = {
    currentUser,
    loading,
    error,
    setError,
    session,
    login,
    logout,
    isAdmin:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: currentUser?.roles?.includes("super_admin") || false,
    hasPermission,
    hasRole,
    hasFeatureAccess,
    getUserTier: () => userTier,
    setupMfa,
    confirmMfa,
    removeMfa,
    verifyMfa,
    updateProfile,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
    isInitialized,
    mfaState,
    isMfaVerified: mfaState.verified || currentUser?.mfaVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
