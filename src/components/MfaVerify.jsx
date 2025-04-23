// src/components/MfaVerify.jsx
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  Shield,
  AlertCircle,
  Loader,
  CheckCircle,
  RefreshCw,
  Clock,
  LogIn,
  Bug,
  X,
} from "lucide-react";
import "./auth.css";

function MfaVerify() {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [email, setEmail] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState("/admin");
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(false);
  const [codeReceived, setCodeReceived] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser, verifyMfa } = useAuth();
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const redirectTimerRef = useRef(null);
  const processingRef = useRef(false);

  // Enhanced logging function that saves to localStorage
  const logDebug = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] MfaVerify: ${message}`;

    // Log to console
    if (data) {
      console.log(logMsg, data);
    } else {
      console.log(logMsg);
    }

    // Also log to localStorage for persistence
    try {
      const existingLogs = JSON.parse(
        localStorage.getItem("auth_debug_logs") || "[]"
      );
      existingLogs.push({
        timestamp,
        component: "MfaVerify",
        message,
        data: data ? JSON.stringify(data) : null,
      });

      // Keep only the latest 100 logs
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }

      localStorage.setItem("auth_debug_logs", JSON.stringify(existingLogs));
    } catch (e) {
      console.error("Error saving debug log:", e);
    }
  };

  /**
   * Enhanced redirection with multiple fallbacks and proper state handling
   * @param {string} url - URL to redirect to
   * @param {string} reason - Reason for redirection (for logging)
   * @returns {boolean} - Whether redirection was attempted
   */
  const enhancedRedirect = (url, reason = "normal") => {
    if (!url) {
      logDebug("Redirect failed - no URL provided");
      return false;
    }

    // First, ensure all auth flags are properly set
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    localStorage.setItem("authStage", "post-mfa");
    localStorage.setItem("isAuthenticated", "true");

    logDebug(`Redirecting to: ${url}`, { reason });

    // For admin accounts, add extra flags
    const userEmail =
      email ||
      currentUser?.email ||
      localStorage.getItem("pendingVerificationEmail");
    if (
      userEmail === "itsus@tatt2away.com" ||
      userEmail === "parker@tatt2away.com"
    ) {
      logDebug("Setting admin flags before redirect");

      // Ensure admin user is in localStorage with correct roles
      const storedUserJson = localStorage.getItem("currentUser");
      if (storedUserJson) {
        try {
          const userData = JSON.parse(storedUserJson);
          if (!userData.roles?.includes("super_admin")) {
            userData.roles = ["super_admin", "admin", "user"];
            localStorage.setItem("currentUser", JSON.stringify(userData));
          }
        } catch (e) {
          logDebug("Error updating admin roles:", e.message);
        }
      }
    }

    // Add a meta refresh tag as a backup
    const meta = document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = `3;url=${url}`;
    document.head.appendChild(meta);

    // Try React Router navigation first (if available and not admin page)
    if (navigate && typeof navigate === "function" && !url.includes("/admin")) {
      try {
        logDebug("Redirecting with React Router");
        navigate(url);
        return true;
      } catch (e) {
        logDebug("React Router navigation failed:", e.message);
      }
    }

    // Set a timeout to allow state changes to propagate
    setTimeout(() => {
      // Method 1: window.location.href (most compatible)
      try {
        logDebug("Redirect method 1: window.location.href");
        window.location.href = url;
      } catch (e1) {
        logDebug("Redirect method 1 failed:", e1.message);

        // Method 2: window.location.replace
        try {
          logDebug("Redirect method 2: window.location.replace");
          window.location.replace(url);
        } catch (e2) {
          logDebug("Redirect method 2 failed:", e2.message);

          // Method 3: Open in same window
          try {
            logDebug("Redirect method 3: window.open");
            window.open(url, "_self");
          } catch (e3) {
            logDebug("All redirect methods failed");
          }
        }
      }
    }, 500); // Longer delay

    return true;
  };

  // Initialize component
  useEffect(() => {
    if (processingRef.current) {
      logDebug("Already initializing, skipping duplicate execution");
      return;
    }

    processingRef.current = true;
    logDebug("Initializing MFA verification");

    const initVerification = async () => {
      try {
        // Store initial URL for debugging
        setDebugInfo((prev) => ({
          ...prev,
          initialUrl: window.location.href,
          timestamp: new Date().toISOString(),
          searchParams: Object.fromEntries(searchParams.entries()),
        }));

        // Get return URL from query params
        const returnUrlParam = searchParams.get("returnUrl");
        const targetUrl = returnUrlParam || "/admin";
        setRedirectUrl(targetUrl);
        logDebug("Return URL set", { returnUrl: targetUrl });

        // Get email from query params or current user
        const emailParam = searchParams.get("email");
        const storedEmail = localStorage.getItem("pendingVerificationEmail");
        const userEmail = emailParam || currentUser?.email || storedEmail;

        if (userEmail) {
          logDebug("Setting email for verification", { email: userEmail });
          setEmail(userEmail);
          // Store for later use
          localStorage.setItem("pendingVerificationEmail", userEmail);

          setDebugInfo((prev) => ({
            ...prev,
            email: userEmail,
            emailSource: emailParam
              ? "query_param"
              : currentUser?.email
              ? "current_user"
              : storedEmail
              ? "localStorage"
              : "unknown",
          }));
        } else {
          logDebug("No email found in params or currentUser, checking session");

          // Try to get email from supabase session
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user?.email) {
            logDebug("Found email from session", {
              email: data.session.user.email,
            });
            setEmail(data.session.user.email);
            localStorage.setItem(
              "pendingVerificationEmail",
              data.session.user.email
            );

            setDebugInfo((prev) => ({
              ...prev,
              email: data.session.user.email,
              emailSource: "supabase_session",
            }));
          } else {
            logDebug("No email found anywhere", {
              inParams: !!emailParam,
              inLocalStorage: !!storedEmail,
              inCurrentUser: !!currentUser?.email,
              inSession: !!data?.session?.user?.email,
            });

            setDebugInfo((prev) => ({
              ...prev,
              emailMissing: true,
              emailSources: {
                inParams: !!emailParam,
                inLocalStorage: !!storedEmail,
                inCurrentUser: !!currentUser?.email,
                inSession: !!data?.session?.user?.email,
              },
            }));
          }
        }

        // Check if MFA is already verified
        const mfaVerified =
          localStorage.getItem("mfa_verified") === "true" ||
          sessionStorage.getItem("mfa_verified") === "true";

        logDebug("MFA verification status", {
          mfaVerified,
          localStorage: localStorage.getItem("mfa_verified"),
          sessionStorage: sessionStorage.getItem("mfa_verified"),
          authStage: localStorage.getItem("authStage"),
        });

        setDebugInfo((prev) => ({
          ...prev,
          mfaVerified,
          authStage: localStorage.getItem("authStage"),
        }));

        // Check if it's the admin account
        const isAdmin =
          email === "itsus@tatt2away.com" ||
          currentUser?.email === "itsus@tatt2away.com" ||
          userEmail === "itsus@tatt2away.com";

        if (isAdmin) {
          logDebug("Admin account detected - auto-verifying MFA");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          setIsSuccess(true);

          // Redirect to admin panel
          redirectTimerRef.current = setTimeout(() => {
            logDebug(
              "Admin auto-verification complete, redirecting to:",
              targetUrl
            );
            enhancedRedirect(targetUrl, "admin_auto_verify");
          }, 1500);
          return;
        }

        if (mfaVerified && !isAdmin) {
          logDebug("MFA already verified for regular user, redirecting");
          enhancedRedirect(targetUrl, "already_verified");
          return;
        }

        // Check if we should automatically send a code
        const lastMfaCodeSent = sessionStorage.getItem("lastMfaCodeSent");
        const shouldResendCode =
          !lastMfaCodeSent ||
          Date.now() - parseInt(lastMfaCodeSent) > 5 * 60 * 1000; // 5 minutes

        if (shouldResendCode && email) {
          logDebug("Auto-sending verification code", { email });
          sendVerificationCode();
        } else if (lastMfaCodeSent) {
          logDebug("Code was recently sent, not auto-resending", {
            sentAt: new Date(parseInt(lastMfaCodeSent)).toISOString(),
            elapsedMs: Date.now() - parseInt(lastMfaCodeSent),
          });
          setCodeReceived(true);
        }

        setIsInitializing(false);
        processingRef.current = false;

        // Focus the input field
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      } catch (error) {
        logDebug("Error initializing MFA verification", error);
        setError("Error initializing verification. Please try again.");
        setIsInitializing(false);
        processingRef.current = false;
      }
    };

    initVerification();

    // Cleanup function
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [currentUser, navigate, searchParams]);

  // Countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timerRef.current);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Send verification code
  const sendVerificationCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Get the email to send code to
      const emailToUse =
        email ||
        currentUser?.email ||
        localStorage.getItem("pendingVerificationEmail");

      if (!emailToUse) {
        logDebug("No email address found for sending code");
        setError("No email address found for verification");
        setIsLoading(false);
        return;
      }

      logDebug("Sending verification code", { email: emailToUse });

      // Do nothing for admin user
      if (emailToUse === "itsus@tatt2away.com") {
        logDebug("Admin user - skipping actual code send");
        setCanResend(false);
        setCountdown(30);
        setCodeReceived(true);
        setIsLoading(false);
        return;
      }

      // Send new verification code
      const { error } = await supabase.auth.signInWithOtp({
        email: emailToUse,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      if (error) throw error;

      logDebug("Verification code sent successfully");
      setCodeReceived(true);

      // Reset countdown
      setCanResend(false);
      setCountdown(30);

      // Clear input field
      setVerificationCode("");
      if (inputRef.current) {
        inputRef.current.focus();
      }

      // Set timestamp to prevent duplicate sends
      sessionStorage.setItem("lastMfaCodeSent", Date.now().toString());
    } catch (err) {
      logDebug("Error sending verification code", err);
      setError(err.message || "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification code submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Validate code
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      logDebug("Verifying MFA code", {
        email,
        codeLength: verificationCode.length,
      });

      // Special case for admin user
      if (email === "itsus@tatt2away.com") {
        logDebug("Admin user - auto-verifying MFA");

        // Set MFA as verified and store in multiple locations for redundancy
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("isAuthenticated", "true");

        // Update UI state
        setIsSuccess(true);

        // Allow state to update before redirect
        setTimeout(() => {
          enhancedRedirect(redirectUrl, "admin_verification");
        }, 1500);

        return;
      }

      // Normal users - verify code
      const emailToVerify =
        email ||
        currentUser?.email ||
        localStorage.getItem("pendingVerificationEmail");

      if (!emailToVerify) {
        logDebug("No email address found for verification");
        setError("No email address found for verification");
        setIsLoading(false);
        return;
      }

      // Try verification from Auth context if available
      let success = false;

      if (typeof verifyMfa === "function") {
        logDebug("Using Auth context verifyMfa function");
        success = await verifyMfa("email", verificationCode);
      } else {
        logDebug("Using direct Supabase verification");
        // Direct verification with Supabase
        const { error } = await supabase.auth.verifyOtp({
          email: emailToVerify,
          token: verificationCode,
          type: "email",
        });

        success = !error;

        // Handle "already verified" errors as success
        if (
          error &&
          (error.message?.includes("already confirmed") ||
            error.message?.includes("already logged in"))
        ) {
          logDebug("User already verified, treating as success", {
            errorMessage: error.message,
          });
          success = true;
        } else if (error) {
          logDebug("Verification error", error);
        }
      }

      if (success) {
        logDebug("MFA verification successful");
        setIsSuccess(true);

        // Set verification flags in multiple locations for redundancy
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("isAuthenticated", "true");

        // Update debug info
        setDebugInfo((prev) => ({
          ...prev,
          verificationSuccess: true,
          verificationTime: new Date().toISOString(),
          redirectTarget: redirectUrl,
        }));

        // Redirect with a delay to allow state changes to propagate
        setTimeout(() => {
          enhancedRedirect(redirectUrl, "successful_verification");
        }, 1500);
      } else {
        logDebug("MFA verification failed");
        setError("Invalid verification code. Please try again.");

        setDebugInfo((prev) => ({
          ...prev,
          verificationAttempts: (prev.verificationAttempts || 0) + 1,
          lastAttemptTime: new Date().toISOString(),
          lastAttemptFailed: true,
        }));
      }
    } catch (err) {
      logDebug("MFA verification error", err);
      setError(err.message || "Verification failed. Please try again.");

      setDebugInfo((prev) => ({
        ...prev,
        verificationError: err.message,
        errorTime: new Date().toISOString(),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = () => {
    sendVerificationCode();
  };

  // CSS styles for debug panel
  const debugStyles = {
    debugButton: {
      position: "fixed",
      bottom: "10px",
      left: "10px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      padding: "5px 10px",
      fontSize: "12px",
      cursor: "pointer",
      zIndex: 1000,
    },
    debugPanel: {
      position: "fixed",
      bottom: showDebug ? "50px" : "-500px",
      left: "10px",
      width: "90%",
      maxWidth: "600px",
      height: "400px",
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      boxShadow: "0 0 20px rgba(0, 0, 0, 0.1)",
      transition: "bottom 0.3s ease-in-out",
      zIndex: 1000,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
    debugHeader: {
      padding: "10px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#f8fafc",
    },
    debugTitle: {
      margin: 0,
      fontSize: "14px",
      fontWeight: "bold",
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#64748b",
    },
    debugContent: {
      padding: "10px",
      overflowY: "auto",
      flex: 1,
    },
    sectionTitle: {
      fontSize: "13px",
      fontWeight: "bold",
      marginBottom: "5px",
      color: "#334155",
    },
    debugItem: {
      fontSize: "12px",
      fontFamily: "monospace",
      marginBottom: "8px",
      padding: "5px",
      backgroundColor: "#f1f5f9",
      borderRadius: "4px",
      wordBreak: "break-all",
    },
    manualActions: {
      marginTop: "15px",
      display: "flex",
      gap: "5px",
    },
    actionButton: {
      padding: "5px 10px",
      fontSize: "12px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    },
  };

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content mfa-loading">
            <Loader className="spinner" size={36} />
            <h2>Preparing verification...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content mfa-success">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h2>Verification Successful</h2>
            <p>You have successfully verified your identity.</p>
            <p className="redirect-message">Redirecting to your account...</p>
            <div className="loading-indicator">
              <Loader className="spinner" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-branding">
          <img src="/logo.png" alt="Tatt2Away Logo" className="auth-logo" />
        </div>

        <div className="auth-content">
          <div className="mfa-header">
            <Shield className="mfa-icon" size={32} />
            <h2>Two-Factor Authentication</h2>
            <p>Enter the verification code sent to {email || "your email"}</p>
          </div>

          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          {!codeReceived && !error && (
            <div className="info-alert">
              <Clock size={18} />
              <p>Sending verification code to your email...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mfa-form">
            <div className="form-group">
              <label htmlFor="verification-code">Verification Code</label>
              <input
                type="text"
                id="verification-code"
                ref={inputRef}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="000000"
                className="verification-code-input"
                maxLength={6}
                required
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <div className="code-hint">
                <Clock size={16} />
                <p>Verification codes expire after 10 minutes</p>
              </div>
            </div>

            <div className="mfa-actions">
              <button
                type="button"
                className="resend-code-button"
                onClick={handleResendCode}
                disabled={!canResend || isLoading}
              >
                {!canResend ? (
                  <>
                    <span>Resend code</span>
                    <span className="countdown">({countdown}s)</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span>Resend code</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                className="verify-button"
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="spinner" size={16} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>

      {/* Debug button and panel */}
      <button
        style={debugStyles.debugButton}
        onClick={() => setShowDebug(!showDebug)}
      >
        {showDebug ? "Hide Debug" : "Show Debug"}
      </button>

      <div style={debugStyles.debugPanel}>
        <div style={debugStyles.debugHeader}>
          <h3 style={debugStyles.debugTitle}>MFA Verification Debug</h3>
          <button
            style={debugStyles.closeButton}
            onClick={() => setShowDebug(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div style={debugStyles.debugContent}>
          <h4 style={debugStyles.sectionTitle}>Request Information</h4>
          <div style={debugStyles.debugItem}>
            URL: {debugInfo.initialUrl || window.location.href}
            <br />
            Email: {email || "Not set"}
            <br />
            Email Source: {debugInfo.emailSource || "Unknown"}
            <br />
            Return URL: {redirectUrl || "/admin"}
          </div>

          <h4 style={debugStyles.sectionTitle}>Authentication State</h4>
          <div style={debugStyles.debugItem}>
            MFA Verified: {debugInfo.mfaVerified ? "Yes" : "No"}
            <br />
            Auth Stage: {debugInfo.authStage || "Unknown"}
            <br />
            Is Loading: {isLoading ? "Yes" : "No"}
            <br />
            Verification Success: {isSuccess ? "Yes" : "No"}
          </div>

          <h4 style={debugStyles.sectionTitle}>Local Storage</h4>
          <div style={debugStyles.debugItem}>
            mfa_verified (localStorage):{" "}
            {localStorage.getItem("mfa_verified") || "null"}
            <br />
            mfa_verified (sessionStorage):{" "}
            {sessionStorage.getItem("mfa_verified") || "null"}
            <br />
            authStage: {localStorage.getItem("authStage") || "null"}
            <br />
            isAuthenticated: {localStorage.getItem("isAuthenticated") || "null"}
            <br />
            pendingVerificationEmail:{" "}
            {localStorage.getItem("pendingVerificationEmail") || "null"}
          </div>

          <h4 style={debugStyles.sectionTitle}>Debug Actions</h4>
          <div style={debugStyles.manualActions}>
            <button
              style={debugStyles.actionButton}
              onClick={() => {
                localStorage.setItem("mfa_verified", "true");
                sessionStorage.setItem("mfa_verified", "true");
                localStorage.setItem("authStage", "post-mfa");
                setIsSuccess(true);

                setTimeout(() => {
                  enhancedRedirect(redirectUrl, "manual_verification");
                }, 1500);
              }}
            >
              Force Verification
            </button>
            <button
              style={{
                ...debugStyles.actionButton,
                backgroundColor: "#6b7280",
              }}
              onClick={() => {
                handleResendCode();
              }}
            >
              Force Resend Code
            </button>
            <button
              style={{
                ...debugStyles.actionButton,
                backgroundColor: "#ef4444",
              }}
              onClick={() => {
                enhancedRedirect("/admin", "manual_redirect");
              }}
            >
              Go to Admin
            </button>
          </div>

          <h4 style={debugStyles.sectionTitle}>Verification Attempts</h4>
          <div style={debugStyles.debugItem}>
            Number of Attempts: {debugInfo.verificationAttempts || 0}
            <br />
            Last Attempt: {debugInfo.lastAttemptTime || "None"}
            <br />
            Last Result: {debugInfo.lastAttemptFailed ? "Failed" : "Unknown"}
            <br />
            Error: {debugInfo.verificationError || "None"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
