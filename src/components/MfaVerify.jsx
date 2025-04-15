// src/components/MfaVerify.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import MFAVerification from "./auth/MFAVerification";
import { Loader2, AlertCircle } from "lucide-react";
import { debugAuth } from "../utils/authDebug";
import "./auth.css";

function MfaVerify() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState(null);
  const [type, setType] = useState("totp");
  const [email, setEmail] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("/");
  const [mfaData, setMfaData] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Extract parameters from URL and initialize the component
  useEffect(() => {
    const initMfaVerification = async () => {
      try {
        setIsLoading(true);
        debugAuth.log("MfaVerify", "MFA verification initializing...");

        const params = new URLSearchParams(location.search);

        // Get redirect URL from query params
        const returnUrl = params.get("returnUrl") || "/admin";
        setRedirectUrl(returnUrl);
        debugAuth.log("MfaVerify", `Return URL set to: ${returnUrl}`);

        // Get factor ID and other MFA data
        const methodIdFromParams = params.get("methodId");
        const typeFromParams = params.get("type") || "email";
        const emailFromParams = params.get("email");

        // Get user email from params or current user
        const userEmail =
          emailFromParams ||
          currentUser?.email ||
          localStorage.getItem("userEmail");

        if (!userEmail) {
          setError("Email address is required for MFA verification");
          setIsLoading(false);
          return;
        }

        setEmail(userEmail);

        // Generate methodId from email if not provided
        const methodId =
          methodIdFromParams ||
          `email-${userEmail.replace(/[^a-zA-Z0-9]/g, "")}`;
        setFactorId(methodId);
        setType(typeFromParams);

        // Create MFA data object
        const mfaDataObject = {
          methodId: methodId,
          type: typeFromParams,
          email: userEmail,
        };

        setMfaData(mfaDataObject);
        debugAuth.log(
          "MfaVerify",
          `MFA data prepared: ${JSON.stringify(mfaDataObject)}`
        );

        // Check if we need to send a verification code
        // Only send if:
        // 1. Email type is requested AND
        // 2. We haven't sent a code recently (within 2 minutes)
        if (typeFromParams === "email") {
          const lastCodeSent = sessionStorage.getItem("lastMfaCodeSent");
          const now = Date.now();
          const needToSendCode =
            !lastCodeSent || now - parseInt(lastCodeSent) > 120000; // 2 minutes

          if (needToSendCode) {
            debugAuth.log(
              "MfaVerify",
              "No recent code detected, sending new verification code"
            );
            try {
              // Send a new verification code
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
                  `Error sending verification code: ${error.message}`
                );
                // Continue anyway - user can request a new code
              } else {
                debugAuth.log(
                  "MfaVerify",
                  "Verification code sent successfully"
                );
                sessionStorage.setItem("lastMfaCodeSent", now.toString());
              }
            } catch (err) {
              debugAuth.log(
                "MfaVerify",
                `Error sending verification code: ${err.message}`
              );
              // Continue anyway - user can request a new code
            }
          } else {
            debugAuth.log(
              "MfaVerify",
              "Recent code already sent, not sending another"
            );
          }
        }
      } catch (err) {
        console.error("Error initializing MFA verification:", err);
        setError("Failed to initialize MFA verification");
      } finally {
        setIsLoading(false);
      }
    };

    initMfaVerification();
  }, [location, currentUser, navigate]);

  // Handle successful verification
  const handleSuccess = () => {
    debugAuth.log("MfaVerify", "MFA verification successful");

    // Set multiple flags for better detection
    localStorage.setItem("authStage", "post-mfa");
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfaSuccess", "true");
    sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
    localStorage.setItem("isAuthenticated", "true");

    // Use multiple approaches to ensure navigation works
    try {
      debugAuth.log("MfaVerify", `Navigating to ${redirectUrl}`);
      // Force a complete page reload
      window.location.href = redirectUrl;

      // Use timeout for secondary navigation attempt
      setTimeout(() => {
        debugAuth.log("MfaVerify", "Executing secondary navigation attempt");
        window.location.replace(redirectUrl);

        // Last resort - if we're still here after 1s, try navigate API
        setTimeout(() => {
          debugAuth.log("MfaVerify", "Executing tertiary navigation attempt");
          navigate(redirectUrl, { replace: true });
        }, 1000);
      }, 500);
    } catch (e) {
      debugAuth.log("MfaVerify", `Navigation error: ${e.message}`);
      // Direct navigation as last resort
      window.location = redirectUrl;
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    debugAuth.log("MfaVerify", "MFA verification cancelled");
    navigate("/login");
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="mfa-container loading">
        <Loader2 className="spinner" size={36} />
        <p>Preparing verification...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="mfa-container error">
        <div className="error-content">
          <AlertCircle size={36} className="error-icon" />
          <h2>Verification Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/login")} className="back-button">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // No valid MFA data
  if (!mfaData?.methodId) {
    return (
      <div className="mfa-container error">
        <div className="error-content">
          <AlertCircle size={36} className="error-icon" />
          <h2>Verification Error</h2>
          <p>No MFA authentication method found.</p>
          <button onClick={() => navigate("/login")} className="back-button">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Render MFA verification component
  return (
    <div className="mfa-container">
      <MFAVerification
        standalone={true}
        mfaData={mfaData}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        redirectUrl={redirectUrl}
      />
    </div>
  );
}

export default MfaVerify;
