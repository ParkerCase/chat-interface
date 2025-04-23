// src/components/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { AlertCircle, Info, CheckCircle, Loader } from "lucide-react";
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
    console.log("Auth page initialized");

    // Get return URL if present
    const redirectPath = searchParams.get("returnUrl") || "/admin";
    setReturnUrl(redirectPath);
    console.log("Return URL:", redirectPath);

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

    // Check for account linking completion
    const linked = searchParams.get("linked") === "true";
    if (linked) {
      setSuccessMessage("Your account has been successfully linked.");
    }
  }, [searchParams]);

  // Check for existing session and redirect if needed
  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      try {
        setIsLoading(true);
        console.log("Checking for existing session");

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session check error:", error);
          setIsLoading(false);
          return;
        }

        if (data?.session) {
          console.log(
            "Session exists, checking MFA requirements for",
            data.session.user.email
          );

          // Check if MFA is required but not verified
          const mfaVerified =
            sessionStorage.getItem("mfa_verified") === "true" ||
            localStorage.getItem("mfa_verified") === "true";

          const authStage = localStorage.getItem("authStage") || "pre-mfa";

          // For test admin, allow bypassing MFA
          const isTestAdmin = data.session.user.email === "itsus@tatt2away.com";
          if (isTestAdmin) {
            console.log("Test admin detected - bypassing MFA");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");
            localStorage.setItem("isAuthenticated", "true");

            console.log(`Redirecting admin to ${returnUrl}`);
            window.location.href = returnUrl;
            return;
          }

          if (authStage === "pre-mfa" && !mfaVerified) {
            console.log(
              "MFA required but not verified, redirecting to verification"
            );
            window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
              returnUrl
            )}&email=${encodeURIComponent(data.session.user.email)}`;
            return;
          }

          // If MFA is verified or not required, redirect to the requested page
          console.log(`MFA status is OK, redirecting to ${returnUrl}`);
          window.location.href = returnUrl;
          return;
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Session check error:", err);
        setIsLoading(false);
      }
    };

    // Also listen to future auth changes (like SSO return)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state change in AuthPage: ${event}`);

      if (event === "SIGNED_IN" && session) {
        console.log("SIGNED_IN event in AuthPage, user:", session.user.email);

        // Set needed flags
        localStorage.setItem("isAuthenticated", "true");

        // Special case for test admin user
        if (session.user.email === "itsus@tatt2away.com") {
          console.log("Test admin signed in - setting MFA as verified");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          console.log("Redirecting admin to admin panel");
          window.location.href = "/admin";
          return;
        } else {
          // For regular users, set pre-MFA stage
          localStorage.setItem("authStage", "pre-mfa");
        }

        // Redirect to MFA verification
        console.log("SIGNED_IN via listener, redirecting to MFA verification");
        window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
          returnUrl
        )}&email=${encodeURIComponent(session.user.email)}`;
      }
    });

    checkSessionAndRedirect();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, returnUrl]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content">
            <div className="auth-loading">
              <Loader className="spinner" size={36} />
              <p>Checking authentication status...</p>
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
            providers={["google", "apple"]}
            redirectTo={`${window.location.origin}/auth/callback`}
            theme="light"
            view="sign_in"
            showLinks={true}
            queryParams={{
              returnTo: returnUrl,
            }}
            onlyThirdPartyProviders={false}
            magicLink={false}
          />
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
