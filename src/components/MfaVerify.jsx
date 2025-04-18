// src/components/MfaVerify.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Loader2, AlertCircle, Shield, Mail, CheckCircle } from "lucide-react";
import { debugAuth } from "../utils/authDebug";
import "./auth.css";

function MfaVerify() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [returnUrl, setReturnUrl] = useState("/admin");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [showManualVerification, setShowManualVerification] = useState(false);
  const [factorId, setFactorId] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();

  // Extract parameters and initialize component
  useEffect(() => {
    const initMfaVerification = async () => {
      try {
        setIsLoading(true);
        debugAuth.log("MfaVerify", "Initializing MFA verification...");

        // Get return URL
        const redirectUrl = searchParams.get("returnUrl") || "/admin";
        setReturnUrl(redirectUrl);
        debugAuth.log("MfaVerify", `Return URL: ${redirectUrl}`);

        // Get email parameter or from current user
        const emailParam = searchParams.get("email");
        const userEmail =
          emailParam || currentUser?.email || localStorage.getItem("userEmail");

        if (!userEmail) {
          setError("Email address is required for MFA verification");
          setIsLoading(false);
          return;
        }

        setEmail(userEmail);

        // Check if we need to send a verification code
        // Only send if we haven't sent a code recently (within 2 minutes)
        const lastCodeSent = parseInt(
          sessionStorage.getItem("lastMfaCodeSent") || "0"
        );
        const now = Date.now();
        const needToSendCode = !lastCodeSent || now - lastCodeSent > 120000; // 2 minutes

        if (needToSendCode) {
          // Set this first to prevent race conditions
          sessionStorage.setItem("lastMfaCodeSent", now.toString());
          debugAuth.log("MfaVerify", "Sending verification code email");

          try {
            // Send email verification code
            const { error } = await supabase.auth.signInWithOtp({
              email: userEmail,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: null,
              },
            });

            if (error) {
              debugAuth.log(
                "MfaVerify",
                `Error sending verification: ${error.message}`
              );
              setError(`Error sending verification: ${error.message}`);
            } else {
              debugAuth.log("MfaVerify", "Verification code sent successfully");
              setVerificationSent(true);
            }
          } catch (err) {
            debugAuth.log(
              "MfaVerify",
              `Error sending verification: ${err.message}`
            );
            setError(`Error sending verification: ${err.message}`);
          }
        } else {
          debugAuth.log(
            "MfaVerify",
            "Recent code already sent, not sending another"
          );
          setVerificationSent(true);
        }

        // Special case for test admin user - auto verify
        if (userEmail === "itsus@tatt2away.com") {
          debugAuth.log(
            "MfaVerify",
            "Test admin user detected, will auto-verify"
          );
          // Show UI briefly for better UX
          setTimeout(() => {
            handleSuccessfulVerification();
          }, 1500);
        }
      } catch (err) {
        console.error("Error initializing MFA verification:", err);
        setError("Failed to initialize MFA verification");
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for auth state changes during verification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugAuth.log("MfaVerify", `Auth state change: ${event}`);

      if (event === "MFA_CHALLENGE_VERIFIED") {
        debugAuth.log("MfaVerify", "MFA_CHALLENGE_VERIFIED event detected");
        handleSuccessfulVerification();
      }
    });

    initMfaVerification();

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams, currentUser, navigate]);

  // Handle successful verification
  const handleSuccessfulVerification = () => {
    debugAuth.log("MfaVerify", "MFA verification successful");

    // Set multiple flags for better detection
    localStorage.setItem("authStage", "post-mfa");
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfaSuccess", "true");
    sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
    localStorage.setItem("isAuthenticated", "true");

    // Update UI
    setVerificationSuccess(true);

    // Use multiple approaches to ensure navigation works
    sessionStorage.setItem("mfaRedirectPending", "true");
    sessionStorage.setItem("mfaRedirectTarget", returnUrl);

    // Redirect after a short delay
    setTimeout(() => {
      try {
        debugAuth.log("MfaVerify", `Navigating to ${returnUrl}`);

        // Force a complete page reload
        window.location.href = returnUrl;

        // Fallback navigation method
        setTimeout(() => {
          window.location.replace(returnUrl);
        }, 500);
      } catch (e) {
        debugAuth.log("MfaVerify", `Navigation error: ${e.message}`);
        // Last resort
        window.location = returnUrl;
      }
    }, 1500);
  };

  // Send verification code manually
  const resendVerificationCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      debugAuth.log("MfaVerify", `Sending verification code to ${email}`);

      // Set timestamp to prevent duplicates
      const now = Date.now();
      sessionStorage.setItem("lastMfaCodeSent", now.toString());

      // Send email verification code
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      if (error) {
        throw error;
      }

      debugAuth.log("MfaVerify", "Verification code sent successfully");
      setVerificationSent(true);
    } catch (err) {
      console.error("Error sending verification code:", err);
      setError(`Failed to send verification code: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle between Supabase UI and manual verification
  const toggleVerificationMethod = () => {
    setShowManualVerification(!showManualVerification);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content mfa-loading">
            <Loader2 className="spinner" size={36} />
            <p>Preparing MFA verification...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !verificationSent) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content mfa-error">
            <AlertCircle size={36} className="error-icon" />
            <h2>Verification Error</h2>
            <p>{error}</p>
            <button onClick={() => navigate("/login")} className="back-button">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show success screen if verification was successful
  if (verificationSuccess) {
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
              <Loader2 className="spinner" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show verification UI
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-branding">
          <img
            src="/Tatt2Away-Color-Black-Logo-300.png"
            alt="Tatt2Away Logo"
            className="auth-logo"
          />
        </div>

        <div className="auth-content">
          <div className="mfa-header">
            <Shield className="mfa-icon" size={32} />
            <h2>Two-Factor Authentication</h2>
            <p>Enter the verification code sent to {email}</p>
          </div>

          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          {/* Show Supabase Auth UI in OTP verification mode */}
          <div className="auth-wrapper">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#4f46e5",
                      brandAccent: "#4338ca",
                    },
                  },
                },
                className: {
                  container: "auth-form-container",
                  button: "auth-button",
                  label: "auth-label",
                  input: "auth-input",
                  message: "auth-message",
                },
              }}
              view="verify_otp"
              theme="light"
              otpType="email"
              onSuccess={handleSuccessfulVerification}
            />
          </div>

          <div className="mfa-actions">
            <button
              onClick={resendVerificationCode}
              className="resend-code"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Sending...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Resend verification code
                </>
              )}
            </button>

            <button
              onClick={() => navigate("/login")}
              className="cancel-button"
            >
              Cancel and return to login
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
