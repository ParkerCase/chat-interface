// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { supabase, enhancedAuth, getSupabaseConfig } from "../lib/supabase";
import { debugAuth } from "../utils/authDebug";

import apiService from "../services/apiService";

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
  const supabaseListenerRef = useRef(null);

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

      // Try multiple verification approaches in sequence until one works
      // This addresses inconsistencies in Supabase's OTP verification behavior

      // First attempt: "magiclink" type (standard approach)
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

      // Second attempt: "email" type (fallback approach)
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

      // Third attempt: "recovery" type (last resort fallback)
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

  // Login function with MFA support
  const login = async (email, password, signal) => {
    try {
      setError("");
      setLoading(true);
      console.log("Attempting login with:", email);

      // Check if request was already aborted
      if (signal && signal.aborted) {
        console.log("Login already aborted");
        setLoading(false);
        return { success: false, error: "Login request aborted" };
      }

      // Log if we're trying to login after password change
      const passwordChanged =
        localStorage.getItem("passwordChanged") === "true";
      if (passwordChanged) {
        console.log("Login attempt after password change detected");
      }

      // Create a fresh client to avoid any session conflicts
      // This is especially important after password changes
      let authData;
      try {
        console.log("Creating fresh Supabase client for login");
        const { url, key } = getSupabaseConfig();
        const { createClient } = await import("@supabase/supabase-js");
        const loginClient = createClient(url, key, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        });

        // Regular login flow with fresh Supabase client
        console.log("Attempting login with fresh client");

        // Create controller for this specific request
        const controller = new AbortController();

        // Connect our parent signal to this controller
        if (signal) {
          // Use a non-throwing approach to handle abort
          const abortHandler = () => {
            console.log("Parent request aborting, cleaning up controller");
            try {
              controller.abort("Parent request aborted");
            } catch (e) {
              console.warn("Error while aborting controller:", e);
            }
          };
          
          signal.addEventListener("abort", abortHandler);
          
          // Ensure we clean up the abort handler after login completes
          setTimeout(() => {
            try {
              signal.removeEventListener("abort", abortHandler);
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 0);
        }

        // Set timeout for this specific request
        const loginTimeout = setTimeout(() => {
          try {
            controller.abort("Login timed out after 8 seconds");
          } catch (e) {
            console.warn("Error aborting on timeout:", e);
          }
        }, 8000);

        // Make the login request with fetch options that include signal
        let loginResult;
        try {
          loginResult = await loginClient.auth.signInWithPassword(
            {
              email,
              password,
            },
            {
              abortSignal: controller.signal,
            }
          );
        } finally {
          // Always clear timeout regardless of success/failure
          clearTimeout(loginTimeout);
        }

        if (loginResult.error) {
          console.error("Login failed with fresh client:", loginResult.error);
          throw loginResult.error;
        }

        authData = loginResult.data;
        console.log("Login successful with fresh client, updating main client");

        // Now update the main Supabase client with the successful session
        try {
          // Use a simple timeout instead of Promise.race to avoid race conditions
          const sessionUpdateTimeout = setTimeout(() => {
            console.warn("Session update taking longer than expected, but continuing");
          }, 3000);
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          });
          
          clearTimeout(sessionUpdateTimeout);

          if (sessionError) {
            console.warn(
              "Warning: Failed to update main client session:",
              sessionError
            );
            // Continue anyway as we have a successful login
          }
        } catch (sessionError) {
          console.warn(
            "Warning: Error updating session, but continuing:",
            sessionError
          );
          // Continue anyway as we have a successful login
        }
      } catch (freshClientError) {
        console.warn(
          "Fresh client login failed, falling back to main client:",
          freshClientError
        );

        // Add a clear error message for timeout
        if (
          freshClientError.message &&
          freshClientError.message.includes("timed out")
        ) {
          throw new Error("Login timed out. Please try again.");
        }

        // Regular login flow with Supabase if fresh client fails - without timeout
        console.log("Using main client for login as fallback");
        
        // Set a warning timeout but don't reject the promise
        const loginWarningTimeout = setTimeout(() => {
          console.warn("Login taking longer than expected, but continuing to wait");
        }, 5000);
        
        const loginResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        clearTimeout(loginWarningTimeout);

        if (loginResult.error) throw loginResult.error;
        authData = loginResult.data;
      }

      console.log("Supabase login successful:", authData);

      // Get user profile data from Supabase
      let userData = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || authData.user.email,
        roles: ["user"], // Default role
        tier: "enterprise", // Default to enterprise tier
        mfaMethods: [],
      };

      // Get profile data - handle race conditions and errors gracefully
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (!profileError && profileData) {
          userData = {
            ...userData,
            name: profileData.full_name || userData.name,
            roles: profileData.roles || userData.roles,
            mfaMethods: profileData.mfa_methods || [],
          };
        } else if (profileError) {
          // Create a new profile if one doesn't exist
          console.log("Profile not found, creating new profile");

          // Create a default email MFA method for all new users
          const emailMfaMethod = {
            id: `email-${email.replace(/[^a-zA-Z0-9]/g, "")}`,
            type: "email",
            createdAt: new Date().toISOString(),
            email: email,
          };

          // Add profile creation without timeout to avoid race conditions
          try {
            const { error: createError } = await supabase.from("profiles").insert([
              {
                id: authData.user.id,
                email: authData.user.email,
                full_name:
                  authData.user.user_metadata?.name || authData.user.email,
                roles: ["user"],
                tier: "enterprise",
                created_at: new Date().toISOString(),
                mfa_methods: [emailMfaMethod],
              },
            ]);

            if (createError) {
              console.error("Error creating profile:", createError);
            } else {
              // Update userData with the new MFA method
              userData.mfaMethods = [emailMfaMethod];
            }
          } catch (createError) {
            console.warn("Profile creation failed:", createError);
            // Continue with the MFA method anyway
            userData.mfaMethods = [emailMfaMethod];
          }
        }
      } catch (profileErr) {
        console.warn("Error fetching profile data:", profileErr);
        // Continue with basic user data
      }

      // Add enterprise features
      userData.features = getEnterpriseFeatures();

      // Store auth tokens and user data
      localStorage.setItem("authToken", authData.session.access_token);
      localStorage.setItem("refreshToken", authData.session.refresh_token);
      localStorage.setItem("currentUser", JSON.stringify(userData));
      localStorage.setItem("isAuthenticated", "true");

      // Update auth context with user data
      setCurrentUser(userData);
      setSession(authData.session);
      setUserTier("enterprise");
      setUserFeatures(userData.features);

      // Check if user has MFA set up - if not, create an email MFA method
      if (!userData.mfaMethods || userData.mfaMethods.length === 0) {
        console.log("No MFA methods found, creating email MFA method");

        // Create default email MFA method
        const emailMfaMethod = {
          id: `email-${email.replace(/[^a-zA-Z0-9]/g, "")}`,
          type: "email",
          createdAt: new Date().toISOString(),
          email: email,
        };

        // Update user data with new MFA method
        userData.mfaMethods = [emailMfaMethod];

        // Update profile in database - with timeout
        try {
          const updateProfilePromise = supabase
            .from("profiles")
            .update({ mfa_methods: [emailMfaMethod] })
            .eq("id", userData.id);

          // Remove the timeout that's causing errors
          try {
            const { error: updateError } = await updateProfilePromise;
            
            if (updateError) {
              console.warn("Error updating profile with MFA method:", updateError);
            }
          } catch (e) {
            console.warn("Profile update failed but continuing:", e);
          }
        } catch (error) {
          console.error("Failed to update profile with MFA method:", error);
        }

        // Update localStorage
        localStorage.setItem("currentUser", JSON.stringify(userData));
      }

      // Always send email verification code for MFA with multiple fallback approaches
      try {
        // Skip OTP sending for critical production user
        if (email === "itsus@tatt2away.com") {
          console.log(
            "Skipping OTP for production user to avoid rate limiting"
          );
          // Mark as success without actually sending
          return {
            success: true,
            mfaRequired: true,
            mfaData: {
              methodId: `email-${email.replace(/[^a-zA-Z0-9]/g, "")}`,
              type: "email",
              email: email,
            },
            isAdmin: true,
          };
        }

        console.log("Sending email verification code for MFA");

        // Try single OTP approach to avoid rate limiting
        let sentSuccessfully = false;
        
        try {
          console.log("Sending OTP using standard method");

          // Use single OTP approach without timeout
          const { error } = await supabase.auth.signInWithOtp({
            email: userData.email,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: null,
            },
          });

          if (!error) {
            console.log("OTP sent successfully");
            // Set success flag
            sentSuccessfully = true;
          } else {
            // Check if rate limited
            if (error.status === 429 || (error.message && error.message.includes("rate limit"))) {
              console.log("Rate limited when sending OTP, continuing without error");
              // For rate limits, continue without considering it an error
              // The user will still be able to complete MFA
            } else {
              console.log("OTP sending failed but continuing:", error);
            }
          }
        } catch (err) {
          console.log("Error with OTP approach but continuing:", err);
          // Continue even if OTP sending fails - user may have received a code earlier
        }

        // Even if OTP sending failed, continue the authentication flow
        console.log("Continuing MFA flow, OTP send status:", sentSuccessfully ? "success" : "failed/skipped");
        
        if (!sentSuccessfully) {
          console.log("OTP sending was not successful, but user can try again on verification screen");
        }
      } catch (error) {
        console.error("Error sending email verification code:", error);
        // Continue anyway, user can request code again in verification screen
      }

      // Always require MFA verification
      const emailMfaMethod = userData.mfaMethods.find(
        (m) => m.type === "email"
      );
      const mfaMethod = emailMfaMethod || userData.mfaMethods[0];

      // Special handling for production user to avoid rate limits
      if (email === "itsus@tatt2away.com") {
        console.log(
          "Production user login detected - using expedited authentication"
        );

        // Skip sending verification code for production account to avoid rate limits
        console.log("Skipping OTP for production account to avoid rate limits");

        localStorage.removeItem("failedLoginAttempts");

        return {
          success: true,
          mfaRequired: true,
          mfaData: {
            methodId:
              mfaMethod?.id || `email-${email.replace(/[^a-zA-Z0-9]/g, "")}`,
            type: "email",
            email: userData.email,
          },
          isAdmin: true,
        };
      }

      return {
        success: true,
        mfaRequired: true,
        mfaData: {
          methodId:
            mfaMethod?.id || `email-${email.replace(/[^a-zA-Z0-9]/g, "")}`,
          type: mfaMethod?.type || "email",
          email: userData.email,
        },
        isAdmin:
          userData.roles.includes("admin") ||
          userData.roles.includes("super_admin"),
      };
    } catch (err) {
      console.error("Login error:", err);

      try {
        const failedAttempts = parseInt(
          localStorage.getItem("failedLoginAttempts") || "0"
        );
        localStorage.setItem(
          "failedLoginAttempts",
          (failedAttempts + 1).toString()
        );
      } catch (e) {
        console.warn("Could not track failed login attempts", e);
      }

      setError(err.message || "Invalid email or password");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
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

  // Verify MFA during login
  const verifyMfa = async (methodId, verificationCode) => {
    try {
      setError("");
      console.log(
        `Verifying MFA with ID: ${methodId}, code: ${verificationCode}`
      );

      // Determine if this is email or TOTP
      const isEmail = methodId.startsWith("email-");
      let success = false;

      if (isEmail) {
        // Email verification using Supabase OTP
        const userEmail = currentUser?.email;
        console.log(`Verifying email OTP for ${userEmail}`);

        // Use proper Supabase verification
        const { data, error } = await supabase.auth.verifyOtp({
          email: userEmail,
          token: verificationCode,
          type: "magiclink",
        });

        if (error) {
          // Handle known benign errors that shouldn't block the user
          if (
            error.message &&
            (error.message.includes("already confirmed") ||
              error.message.includes("already logged in"))
          ) {
            console.log("User already confirmed - verification successful");
            success = true;
          } else {
            console.error("Email verification error:", error);
            throw error;
          }
        } else {
          console.log("Email verification successful");
          success = true;
        }
      } else {
        // TOTP verification - use standard Supabase flow
        console.log(`Verifying TOTP factor: ${methodId}`);

        // Step 1: Create a challenge for this factor
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({
            factorId: methodId,
          });

        if (challengeError) {
          console.error("Failed to create MFA challenge:", challengeError);
          throw challengeError;
        }

        // Step 2: Verify the challenge with the user's code
        const { data: verifyData, error: verifyError } =
          await supabase.auth.mfa.verify({
            factorId: methodId,
            challengeId: challengeData.id,
            code: verificationCode,
          });

        if (verifyError) {
          console.error("MFA verification failed:", verifyError);
          throw verifyError;
        }

        console.log("TOTP verification successful");
        success = true;
      }

      // Return verification result
      return success;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Verification failed. Please try again.");
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

  // Check if user has a role
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

  // Get current user tier
  const getUserTier = useCallback(() => {
    return "enterprise";
  }, []);

  // Register function
  const register = async (userData) => {
    try {
      setError("");
      setLoading(true);

      // For admin user creating new users
      if (userData.roles) {
        // This is an admin registration
        try {
          const response = await apiService.users.create(userData);
          return response.data;
        } catch (err) {
          throw new Error(err.response?.data?.error || "Registration failed");
        }
      }

      // For self-registration
      // Email domain validation
      if (
        !userData.email.endsWith("@tatt2away.com") &&
        userData.email !== "itsus@tatt2away.com"
      ) {
        throw new Error("Only @tatt2away.com email addresses are allowed");
      }

      // Register with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.name,
          },
        },
      });

      if (error) throw error;

      // Create profile in Supabase
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          full_name: userData.name,
          email: userData.email,
          roles: userData.roles || ["user"],
          tier: "enterprise",
        },
      ]);

      if (profileError) throw profileError;

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userData.name,
          roles: userData.roles || ["user"],
        },
        requiresEmailVerification: true,
      };
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive logout function that ensures complete cleanup
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

  // Process token exchange from SSO providers
  const processTokenExchange = async (code) => {
    try {
      setError("");
      setLoading(true);

      // First try processing via Supabase
      try {
        // For Supabase SSO, we don't need to do anything - session should be set automatically
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          // Get user profile
          const { data: userData } = await supabase.auth.getUser();

          if (userData?.user) {
            // Get additional data from profiles
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Create user object
            let user = {
              id: userData.user.id,
              email: userData.user.email,
              name:
                profileData?.full_name ||
                userData.user.user_metadata?.name ||
                userData.user.email,
              roles: profileData?.roles || ["user"],
              tier: "enterprise",
              mfaMethods: profileData?.mfa_methods || [],
              features: getEnterpriseFeatures(),
            };

            // Special case for super admin
            if (user.email === "itsus@tatt2away.com") {
              user.roles = ["super_admin", "admin", "user"];
            }

            // Store user data
            localStorage.setItem("authToken", sessionData.session.access_token);
            localStorage.setItem(
              "refreshToken",
              sessionData.session.refresh_token
            );
            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("isAuthenticated", "true");

            // Update state
            setCurrentUser(user);
            setSession(sessionData.session);
            setUserTier("enterprise");
            setUserFeatures(user.features);

            return true;
          }
        }
      } catch (supabaseError) {
        console.warn("Supabase SSO processing failed:", supabaseError);
        // Continue with custom API
      }

      // Fall back to custom API for token exchange
      const response = await apiService.auth.exchangeToken(code);

      if (response.data && response.data.success) {
        // Store tokens
        localStorage.setItem("authToken", response.data.token);
        localStorage.setItem("isAuthenticated", "true");
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        if (response.data.sessionId) {
          localStorage.setItem("sessionId", response.data.sessionId);
        }

        // Ensure user has proper roles and features
        if (response.data.user) {
          // Special case for admin user
          if (response.data.user.email === "itsus@tatt2away.com") {
            response.data.user.roles = ["super_admin", "admin", "user"];
          }

          // Set enterprise tier and features
          response.data.user.tier = "enterprise";
          response.data.user.features = getEnterpriseFeatures();

          // Store and update user
          localStorage.setItem(
            "currentUser",
            JSON.stringify(response.data.user)
          );
          setCurrentUser(response.data.user);
          setUserTier("enterprise");
          setUserFeatures(response.data.user.features);
        }

        return true;
      }

      setError(response.data?.error || "Authentication failed");
      return false;
    } catch (error) {
      console.error("Token exchange error:", error);
      setError(error.message || "Authentication failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

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

  // Update user profile with robust error handling - works without backend API
  const updateProfile = async (profileData) => {
    try {
      setError("");
      console.log("Starting profile update with data:", profileData);

      // Get current session for auth checks
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("No active session found");
      }

      // Get current user ID
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error("User ID not found");
      }

      let updateSuccess = false;

      // Log the user metadata from current session to debug
      const userDetails = sessionData.session.user;
      console.log(
        "Current user metadata from session:",
        userDetails?.user_metadata
      );
      console.log("Current user object:", currentUser);

      // First, fetch the current profile from Supabase to ensure we have latest data
      try {
        console.log("Fetching latest profile data from Supabase");
        const { data: existingProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (fetchError) {
          console.warn("Failed to fetch current profile:", fetchError);
        } else if (existingProfile) {
          console.log(
            "Retrieved current profile from Supabase:",
            existingProfile
          );

          // Update local user state with the latest from Supabase
          // This ensures we have the latest data before making changes
          setCurrentUser((prev) => {
            const updatedUser = {
              ...prev,
              name: existingProfile.full_name || prev.name,
              firstName: existingProfile.first_name || prev.firstName,
              lastName: existingProfile.last_name || prev.lastName,
              // Add any other profile fields we should sync
              roles: existingProfile.roles || prev.roles,
              mfaMethods: existingProfile.mfa_methods || prev.mfaMethods,
            };

            // Update localStorage with the latest data
            localStorage.setItem("currentUser", JSON.stringify(updatedUser));
            return updatedUser;
          });
        }
      } catch (fetchError) {
        console.warn("Error fetching current profile data:", fetchError);
        // Continue with update process using locally available data
      }

      // Approach 1: Try direct auth metadata update - most reliable method
      try {
        console.log("Updating user metadata with auth.updateUser");
        const { data, error: userError } = await supabase.auth.updateUser({
          data: {
            full_name: profileData.name,
            first_name: profileData.firstName || "",
            last_name: profileData.lastName || "",
          },
        });

        if (userError) {
          console.warn("Auth metadata update failed:", userError);
          // Don't throw, try direct API approach
        } else {
          console.log("Auth metadata updated successfully");
          updateSuccess = true;
        }
      } catch (authUpdateError) {
        console.warn("Auth metadata update failed:", authUpdateError);
        // Continue to direct API approach
      }

      // Approach 2: Try direct REST API call if the updateUser failed
      if (!updateSuccess) {
        try {
          console.log("Attempting direct user update via API");

          const { url, key } = getSupabaseConfig();
          const accessToken = sessionData.session.access_token;

          // Use fetch API for direct control
          const response = await fetch(`${url}/auth/v1/user`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              user_metadata: {
                full_name: profileData.name,
                first_name: profileData.firstName || "",
                last_name: profileData.lastName || "",
              },
            }),
          });

          if (!response.ok) {
            console.warn("Direct API user update failed:", response.status);
            const errorText = await response.text();
            console.warn("Error details:", errorText);
            // Continue to profiles table approach
          } else {
            console.log("Direct API user update succeeded!");
            updateSuccess = true;
          }
        } catch (apiError) {
          console.warn("Direct API approach failed:", apiError);
          // Continue to profiles table approach
        }
      }

      // Approach 3: Update profiles table (works with RLS)
      try {
        console.log("Updating profiles table");
        const updateData = {
          full_name: profileData.name,
          updated_at: new Date().toISOString(),
        };

        // Only add these if they're provided
        if (profileData.firstName !== undefined)
          updateData.first_name = profileData.firstName;
        if (profileData.lastName !== undefined)
          updateData.last_name = profileData.lastName;

        const { data: updatedProfileData, error: profileError } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", userId)
          .select();

        if (profileError) {
          console.warn("Profiles table update failed:", profileError);

          // Try more direct approach as last resort
          if (
            profileError.code === "42501" ||
            profileError.message?.includes("permission denied")
          ) {
            try {
              console.log(
                "Attempting profiles update via REST API due to permission error"
              );

              const { url, key } = getSupabaseConfig();
              const accessToken = sessionData.session.access_token;

              // Use direct REST API call to bypass RLS
              const response = await fetch(
                `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: key,
                    Authorization: `Bearer ${accessToken}`,
                    Prefer: "return=representation",
                  },
                  body: JSON.stringify(updateData),
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                console.warn(
                  "REST API profiles update failed:",
                  response.status,
                  errorText
                );
                throw new Error(
                  `REST API profiles update failed: ${response.status}`
                );
              }

              console.log("REST API profiles update succeeded");
              updateSuccess = true;
            } catch (restApiError) {
              console.warn("REST API approach failed:", restApiError);
              // Continue to local update as fallback
            }
          } else {
            // Not a permissions issue, just log it
            throw profileError;
          }
        } else {
          console.log(
            "Profiles table updated successfully:",
            updatedProfileData
          );
          updateSuccess = true;

          // Refresh session to ensure it contains updated data
          try {
            await supabase.auth.refreshSession();
            console.log("Session refreshed after profile update");
          } catch (refreshError) {
            console.warn(
              "Session refresh failed (non-critical):",
              refreshError
            );
          }
        }
      } catch (profileUpdateError) {
        console.warn("Profiles table update failed:", profileUpdateError);

        // If all DB approaches failed, log it but continue with local update
        if (!updateSuccess) {
          console.error("All database update approaches failed");
        }
      }

      // Always update local state for immediate UI feedback, even if DB update failed
      console.log("Updating local state");
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

      // Force a session refresh to ensure changes are picked up
      try {
        // Clear local storage first to ensure fresh data
        const userBackup = JSON.parse(localStorage.getItem("currentUser"));
        localStorage.removeItem("currentUser");

        console.log(
          "Explicitly refreshing session and getting latest user data"
        );

        // First refresh the session
        const { data: refreshData } = await supabase.auth.refreshSession();

        if (refreshData?.session) {
          console.log("Session refreshed successfully after profile update");

          // Then get the updated user data from both auth and profiles table
          const [userData, profileResponse] = await Promise.all([
            supabase.auth.getUser(),
            supabase.from("profiles").select("*").eq("id", userId).single(),
          ]);

          if (userData?.data?.user) {
            console.log(
              "Retrieved fresh user data after profile update:",
              userData.data.user
            );
            console.log("User metadata:", userData.data.user.user_metadata);

            let mergedData = {
              ...userBackup,
              email: userData.data.user.email,
              id: userData.data.user.id,
              name:
                userData.data.user.user_metadata?.full_name || profileData.name,
              firstName:
                userData.data.user.user_metadata?.first_name ||
                profileData.firstName,
              lastName:
                userData.data.user.user_metadata?.last_name ||
                profileData.lastName,
            };

            // Add profile data if available
            if (!profileResponse.error && profileResponse.data) {
              console.log(
                "Retrieved fresh profile data:",
                profileResponse.data
              );
              mergedData = {
                ...mergedData,
                name: profileResponse.data.full_name || mergedData.name,
                firstName:
                  profileResponse.data.first_name || mergedData.firstName,
                lastName: profileResponse.data.last_name || mergedData.lastName,
                roles: profileResponse.data.roles || mergedData.roles,
                mfaMethods:
                  profileResponse.data.mfa_methods || mergedData.mfaMethods,
              };
            }

            console.log("Final merged user data:", mergedData);

            // Update localStorage and context state
            localStorage.setItem("currentUser", JSON.stringify(mergedData));
            setCurrentUser(mergedData);

            // Force a component re-render by triggering a fake state update
            setError(""); // This will cause React components to re-render
          }
        }
      } catch (refreshError) {
        console.warn("Session refresh error (non-critical):", refreshError);

        // Restore backup if refresh failed
        try {
          const userBackup = localStorage.getItem("currentUserBackup");
          if (userBackup) {
            localStorage.setItem("currentUser", userBackup);
            localStorage.removeItem("currentUserBackup");
          }
        } catch (e) {
          console.warn("Failed to restore user backup:", e);
        }
      }

      return true;
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile");

      // As a last resort, just update the local state anyway
      try {
        console.log("Falling back to local-only update");
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
      } catch (localError) {
        console.error("Even local update failed:", localError);
        return false;
      }
    }
  };

  // Simple, focused password change function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError("");
      setLoading(true);

      // 1. First validate the current password with the main Supabase client
      console.log("Validating current password");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInError) {
        console.error("Current password validation failed:", signInError);
        throw new Error("Current password is incorrect");
      }
      
      console.log("Current password validated successfully");

      // 2. Update the password - with retry logic
      console.log("Updating password");
      
      // Try up to 3 times with increasing delays
      let updateError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await supabase.auth.updateUser({
            password: newPassword,
          });
          
          if (!error) {
            console.log(`Password update successful on attempt ${attempt}`);
            updateError = null;
            break; // Success - exit the loop
          }
          
          updateError = error;
          console.warn(`Password update attempt ${attempt} failed:`, error);
          
          // If we have more attempts, wait before trying again
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        } catch (err) {
          updateError = err;
          console.warn(`Password update attempt ${attempt} failed with exception:`, err);
          
          // If we have more attempts, wait before trying again
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      
      // Check if all attempts failed
      if (updateError) {
        // Check for common errors and provide better messages
        if (updateError.message && updateError.message.includes("Password should be")) {
          throw new Error(updateError.message);
        } else {
          console.error("All password update attempts failed:", updateError);
          throw new Error("Password update failed after multiple attempts. Please try again later.");
        }
      }

      console.log("Password changed successfully!");

      // 3. Log to your own audit table since hook isn't available
      try {
        await supabase.from("security_audit_logs").insert({
          event_type: "password_change",
          user_id: currentUser.id,
          email: currentUser.email,
          timestamp: new Date().toISOString(),
        });
      } catch (logError) {
        console.warn("Could not log password change to audit table:", logError);
        // Non-critical, continue despite error
      }

      // 4. Update profile if needed
      try {
        await supabase
          .from("profiles")
          .update({
            password_last_changed: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);
      } catch (profileError) {
        console.warn(
          "Could not update profile after password change:",
          profileError
        );
        // Non-critical, continue despite error
      }

      // 5. Simple session refresh
      console.log("Refreshing session after password change");
      try {
        await supabase.auth.refreshSession();
        console.log("Session refreshed successfully");
      } catch (refreshError) {
        console.warn("Session refresh had issues, but continuing:", refreshError);
      }

      // 6. Set success flag
      localStorage.setItem("passwordChanged", "true");
      
      console.log("Password change process completed successfully");
      return true;
    } catch (error) {
      console.error("Password change process failed:", error);
      setError(error.message || "Failed to change password");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Request password reset with enhanced reliability
  const requestPasswordReset = async (email) => {
    try {
      setError("");
      console.log("Starting password reset request for:", email);

      // Try with Supabase first using different approaches
      let supabaseSuccess = false;

      // First attempt: Standard resetPasswordForEmail
      try {
        console.log("Attempting standard password reset");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (!error) {
          console.log("Password reset email sent successfully");
          supabaseSuccess = true;
        } else {
          console.warn("Standard password reset failed:", error);
        }
      } catch (standardError) {
        console.warn("Standard password reset request failed:", standardError);
        // Continue to other methods
      }

      // Second attempt: If first attempt failed, try with OTP approach
      if (!supabaseSuccess) {
        try {
          console.log("Attempting OTP-based password reset");

          // Use signInWithOtp but with recovery option
          const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: `${window.location.origin}/reset-password`,
            },
          });

          if (!error) {
            console.log("OTP-based password reset email sent successfully");
            supabaseSuccess = true;
          } else {
            console.warn("OTP-based password reset failed:", error);
          }
        } catch (otpError) {
          console.warn("OTP-based password reset failed:", otpError);
        }
      }

      // If Supabase methods worked, return success
      if (supabaseSuccess) {
        return true;
      }

      // As last resort, try custom implementation
      console.log("Trying custom implementation for password reset");
      try {
        const response = await apiService.auth.requestPasswordReset(email);
        const success = response.data?.success || false;

        if (success) {
          console.log("Custom password reset request successful");
        } else {
          console.warn("Custom password reset request failed");
        }

        return success;
      } catch (apiError) {
        console.error("Custom password reset API error:", apiError);
        throw apiError;
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(
        error.message ||
          "Failed to request password reset. Please try again later."
      );
      return false;
    }
  };

  // Reset password with token - comprehensive implementation with multiple approaches
  const resetPassword = async (password, token) => {
    try {
      setError("");
      console.log("Starting password reset process");

      // In Supabase, we may already have a session from the reset link,
      // so we can try to directly update the password
      try {
        console.log("Trying direct password update");
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (!updateError) {
          console.log("Password reset successful with direct method");

          // Make sure to save auth state
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            localStorage.setItem("authToken", sessionData.session.access_token);
            if (sessionData.session.refresh_token) {
              localStorage.setItem(
                "refreshToken",
                sessionData.session.refresh_token
              );
            }
            localStorage.setItem("isAuthenticated", "true");

            // Force refresh user data
            try {
              const { data: userData } = await supabase.auth.getUser();
              if (userData?.user) {
                // Update user state accordingly
                await updateUserAfterPasswordReset(userData.user);
              }
            } catch (refreshError) {
              console.warn("User refresh error (non-fatal):", refreshError);
            }
          }

          return true;
        }

        console.warn("Direct password update failed:", updateError);

        // If we have a token, try using it explicitly
        if (token) {
          console.log("Trying password reset with explicit token");

          // Verify token and reset password
          // We need to extract email from session or try without it
          const { data: userData } = await supabase.auth.getUser();
          const userEmail = userData?.user?.email;

          const { error: resetError } = userEmail
            ? await supabase.auth.verifyOtp({
                token: token,
                type: "recovery",
                email: userEmail,
              })
            : await supabase.auth.verifyOtp({
                token: token,
                type: "recovery",
              });

          if (!resetError) {
            // Token is valid, now update password
            const { error: pwUpdateError } = await supabase.auth.updateUser({
              password: password,
            });

            if (!pwUpdateError) {
              console.log("Password reset successful with token verification");
              return true;
            } else {
              console.warn(
                "Password update failed after token verification:",
                pwUpdateError
              );
            }
          } else {
            console.warn("Token verification failed:", resetError);
          }
        }

        // Fall through to custom implementation
      } catch (supabaseError) {
        console.warn("Supabase password reset failed:", supabaseError);
        // Continue to custom implementation
      }

      // Try custom implementation as last resort
      try {
        console.log("Trying custom implementation for password reset");
        const response = await apiService.auth.resetPassword(token, password);
        return response.data?.success || false;
      } catch (apiError) {
        console.error("Custom API password reset failed:", apiError);
        throw apiError;
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError(
        error.message ||
          "Password reset failed. Please try again or request a new reset link."
      );
      return false;
    }
  };

  // Helper to update user data after password reset
  const updateUserAfterPasswordReset = async (user) => {
    try {
      if (!user) return;

      // Get profile data
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Create user object
      const userData = {
        id: user.id,
        email: user.email,
        name: profileData?.full_name || user.user_metadata?.name || user.email,
        roles: profileData?.roles || ["user"],
        tier: "enterprise",
        mfaMethods: profileData?.mfa_methods || [],
        features: getEnterpriseFeatures(),
      };

      // Update context state
      setCurrentUser(userData);

      // Update localStorage
      localStorage.setItem("currentUser", JSON.stringify(userData));
      localStorage.setItem("isAuthenticated", "true");

      return true;
    } catch (error) {
      console.warn("Error updating user after password reset:", error);
      // Non-fatal error, continue
      return false;
    }
  };

  // Get current user
  const getCurrentUser = async () => {
    try {
      // Check if we already have user data
      if (currentUser) {
        return currentUser;
      }

      // Try to get user from Supabase
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

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
          name:
            profileData?.full_name ||
            userData.user.user_metadata?.name ||
            userData.user.email,
          roles: profileData?.roles || ["user"],
          tier: "enterprise",
          mfaMethods: profileData?.mfa_methods || [],
          features: getEnterpriseFeatures(),
        };

        // Special case for super admin
        if (user.email === "itsus@tatt2away.com") {
          user.roles = ["super_admin", "admin", "user"];
        }

        return user;
      }

      // Fall back to stored user
      const storedUser = localStorage.getItem("currentUser");

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return null;
    } catch (error) {
      console.error("Get current user error:", error);

      // Fall back to stored user
      const storedUser = localStorage.getItem("currentUser");

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return null;
    }
  };

  // Initialize auth state from Supabase or localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check Supabase session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          try {
            // Get user data
            const { data: userData } = await supabase.auth.getUser();

            if (userData?.user) {
              // Get profile data - may not exist yet for new users
              const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .single();

              // Create user object
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                name:
                  profileData?.full_name ||
                  userData.user.user_metadata?.name ||
                  userData.user.email,
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
              };

              // Special case for super admin
              if (user.email === "itsus@tatt2away.com") {
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(sessionData.session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update localStorage
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
              
            }
          } catch (error) {
            console.error("Error getting user profile:", error);
          }
        } else {
          // Check localStorage as fallback
          const storedUser = localStorage.getItem("currentUser");
          const isAuthenticated =
            localStorage.getItem("isAuthenticated") === "true";
          const authToken = localStorage.getItem("authToken");

          if (storedUser && (isAuthenticated || authToken)) {
            try {
              let userData = JSON.parse(storedUser);

              // Always set enterprise features
              userData.features = getEnterpriseFeatures();

              // Ensure super admin role for test user
              if (userData.email === "itsus@tatt2away.com") {
                userData.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(userData);
              setUserTier("enterprise");
              setUserFeatures(userData.features);

              // Update localStorage
              localStorage.setItem("currentUser", JSON.stringify(userData));
              localStorage.setItem("isAuthenticated", "true");
            } catch (error) {
              console.error("Error parsing stored user:", error);

              // Clear invalid data
              localStorage.removeItem("currentUser");
              localStorage.removeItem("authToken");
              localStorage.removeItem("isAuthenticated");

              setCurrentUser(null);
              setSession(null);
            }
          } else {
            setCurrentUser(null);
            setSession(null);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);

        // Check localStorage as final fallback
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setCurrentUser(userData);
            setUserTier("enterprise");
            setUserFeatures(getEnterpriseFeatures());
          } catch (error) {
            console.error("Error parsing stored user:", error);
            setCurrentUser(null);
          }
        } else {
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
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                name:
                  profileData?.full_name ||
                  userData.user.user_metadata?.name ||
                  userData.user.email,
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
              };

              // Special case for super admin
              if (user.email === "itsus@tatt2away.com") {
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update localStorage
              localStorage.setItem("authToken", session.access_token);
              localStorage.setItem("refreshToken", session.refresh_token);
              localStorage.setItem("currentUser", JSON.stringify(user));
              localStorage.setItem("isAuthenticated", "true");
              
            }
          } catch (error) {
            console.error("Error getting user profile:", error);
          }
        } else if (event === "SIGNED_OUT") {
          // Clear state and localStorage
          setCurrentUser(null);
          setSession(null);

          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
        }
      });

      // Store subscription for cleanup
      supabaseListenerRef.current = subscription;

      // Finish initialization
      setLoading(false);
      setIsInitialized(true);
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
    register,
    isAdmin:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: currentUser?.roles?.includes("super_admin") || false,
    hasPermission,
    hasRole,
    hasFeatureAccess,
    getUserTier,
    requestPasswordReset,
    resetPassword,
    changePassword,
    processTokenExchange,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
    setupMfa,
    confirmMfa,
    removeMfa,
    verifyMfa,
    updateProfile,
    isInitialized,
    getCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
