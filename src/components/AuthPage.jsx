// src/components/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { AlertCircle, Info, CheckCircle } from "lucide-react";
import { debugAuth } from "../utils/authDebug";
import {
  loginWithGoogle,
  loginWithApple,
} from "../utils/enhancedIdentityLinking";
// Import our custom brand icons instead
import { GoogleIcon, AppleIcon } from "../components/icons/BrandIcons";
import "./auth.css";

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [returnUrl, setReturnUrl] = useState("/admin");

  // Extract query parameters
  useEffect(() => {
    // Get return URL if present
    const redirectPath = searchParams.get("returnUrl") || "/admin";
    setReturnUrl(redirectPath);

    // Check for password changed notification
    const passwordChanged = searchParams.get("passwordChanged") === "true";
    if (passwordChanged) {
      setSuccessMessage(
        "Password changed successfully. Please sign in with your new password."
      );
    }

    // Check for expired session
    const expired = searchParams.get("expired") === "true";
    if (expired) {
      setError("Your session has expired. Please sign in again.");
    }

    // Check if this is a return from MFA verification
    const mfaSuccess = sessionStorage.getItem("mfaSuccess") === "true";
    if (mfaSuccess) {
      debugAuth.log("AuthPage", "Detected successful MFA verification");

      // Clear the flag
      sessionStorage.removeItem("mfaSuccess");

      // Redirect to the intended destination
      const mfaRedirectTarget =
        sessionStorage.getItem("mfaRedirectTarget") || "/admin";
      navigate(mfaRedirectTarget, { replace: true });
    }
  }, [searchParams, navigate]);

  // Check for existing session and redirect if needed
  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session check error:", error);
          return;
        }

        if (data?.session) {
          debugAuth.log(
            "AuthPage",
            "Session exists, checking MFA requirements"
          );

          // Check if MFA is required but not verified
          const mfaVerified =
            sessionStorage.getItem("mfa_verified") === "true" ||
            localStorage.getItem("mfa_verified") === "true";

          const authStage = localStorage.getItem("authStage") || "pre-mfa";

          if (authStage === "pre-mfa" && !mfaVerified) {
            debugAuth.log(
              "AuthPage",
              "MFA required but not verified, redirecting to verification"
            );
            navigate(`/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`);
            return;
          }

          // If MFA is verified or not required, redirect to the requested page
          debugAuth.log(
            "AuthPage",
            `MFA status is OK, redirecting to ${returnUrl}`
          );
          navigate(returnUrl);
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Also listen to future auth changes (like SSO return)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugAuth.log("AuthPage", `Auth state change: ${event}`);

      if (event === "SIGNED_IN" && session) {
        // Set needed flags
        localStorage.setItem("authToken", session.access_token);
        localStorage.setItem("refreshToken", session.refresh_token);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("authStage", "pre-mfa"); // Default to requiring MFA

        // Redirect to MFA verification if needed
        debugAuth.log(
          "AuthPage",
          "SIGNED_IN via listener, redirecting to MFA verification"
        );
        navigate(`/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`);
      }
    });

    checkSessionAndRedirect();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, returnUrl]);

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
          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="success-alert">
              <CheckCircle size={18} />
              <p>{successMessage}</p>
            </div>
          )}

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
                  borderWidths: {
                    buttonBorderWidth: "1px",
                    inputBorderWidth: "1px",
                  },
                  radii: {
                    borderRadiusButton: "6px",
                    buttonBorderRadius: "6px",
                    inputBorderRadius: "6px",
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
            providers={[]}
            redirectTo={`${window.location.origin}/auth/callback`}
            theme="light"
            view="sign_in"
            showLinks={true}
            magicLink={false}
            onlyThirdPartyProviders={false}
            queryParams={{
              returnTo: returnUrl,
            }}
          />
          <div className="social-login-section">
            <div className="social-login-divider">
              <span>OR</span>
            </div>
            <button
              className="social-login-button google-button"
              onClick={async () => {
                setError("");
                try {
                  const result = await loginWithGoogle();
                  if (result.error) {
                    setError(result.error);
                  }
                  // If redirecting, we don't need to do anything else
                } catch (err) {
                  setError(err.message || "Error signing in with Google");
                }
              }}
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>

            {/* Apple Sign In */}
            <button
              className="social-login-button apple-button"
              onClick={async () => {
                setError("");
                try {
                  const result = await loginWithApple();
                  if (result.error) {
                    setError(result.error);
                  }
                  // If redirecting, we don't need to do anything else
                } catch (err) {
                  setError(err.message || "Error signing in with Apple");
                }
              }}
            >
              <AppleIcon size={18} />
              <span>Continue with Apple</span>
            </button>

            <p className="social-login-hint">
              Sign in with your existing social account or use email + password
            </p>
          </div>
        </div>

        <div className="test-credentials-info">
          <Info size={16} />
          <p>
            Test account: <strong>itsus@tatt2away.com</strong> /{" "}
            <strong>password</strong>
          </p>
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
