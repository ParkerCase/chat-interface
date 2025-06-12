// src/components/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";
import "../auth.css";
import { InkOutLogo } from "../AuthPage";

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [signingOut, setSigningOut] = useState(true);
  const navigate = useNavigate();

  // Sign out on mount to ensure a clean reset flow
  useEffect(() => {
    const doSignOut = async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // Ignore sign out errors
      } finally {
        setSigningOut(false);
      }
    };
    doSignOut();
  }, []);

  // Handler for successful password reset
  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      navigate("/login?passwordChanged=true", { replace: true });
    }, 3000);
  };

  // Handler for errors (e.g., PKCE failure)
  const handleError = (err) => {
    if (
      err?.message?.toLowerCase().includes("code verifier") ||
      err?.message?.toLowerCase().includes("pkce") ||
      err?.message?.toLowerCase().includes("invalid request")
    ) {
      setError(
        "This reset link is invalid or expired. Please request a new one."
      );
    } else {
      setError(err?.message || "An unknown error occurred.");
    }
  };

  if (signingOut) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content">
            <div className="auth-loading">
              <Loader className="spinner" size={36} />
              <p>Preparing password reset...</p>
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
          <InkOutLogo />
        </div>
        <div className="auth-content">
          <div
            className="info-box"
            style={{
              marginBottom: 24,
              background: "#f9fafb",
              borderRadius: 8,
              padding: 16,
              color: "#374151",
              fontSize: 15,
            }}
          >
            <strong>Important:</strong> For security, you must open the password
            reset link in the <b>same browser and device</b> where you requested
            it. If you see an error, please request a new link and avoid using
            private/incognito mode.
          </div>
          {success ? (
            <div className="success-alert">
              <CheckCircle size={36} className="success-icon" />
              <h3>Password Reset Successful</h3>
              <p>
                Your password has been reset. You can now sign in with your new
                password.
              </p>
            </div>
          ) : error ? (
            <div className="error-alert">
              <AlertCircle size={36} className="error-icon" />
              <h3>Reset Link Invalid</h3>
              <p>{error}</p>
              <button
                className="primary-button"
                onClick={() => navigate("/forgot-password")}
              >
                Request New Link
              </button>
            </div>
          ) : (
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
              theme="light"
              view="update_password"
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}
        </div>
        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
