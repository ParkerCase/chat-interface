// src/components/MfaVerify.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import MFAVerification from "./auth/MFAVerification";
import { AlertCircle, Loader2 } from "lucide-react";
import "./auth.css";

/**
 * Standalone MFA verification page
 * Used for verifying MFA during login or when navigating to protected resources
 */
function MfaVerify() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState(null);
  const [type, setType] = useState("totp");
  const [email, setEmail] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("/");

  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  // Extract parameters from URL and initialize the component
  useEffect(() => {
    const initMfaVerification = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams(location.search);

        // Get redirect URL from query params
        const returnUrl = params.get("returnUrl") || "/";
        setRedirectUrl(returnUrl);

        // Get factor ID from query params or try to get from current session
        const factorIdFromParams = params.get("factorId");

        if (factorIdFromParams) {
          setFactorId(factorIdFromParams);

          // Try to get additional info about the factor
          try {
            const { data, error } =
              await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (!error && data) {
              console.log("MFA assurance level data:", data);
              // Use available info to enhance the UX
            }
          } catch (err) {
            console.warn("Failed to get MFA details:", err);
          }
        } else {
          // Check if we have an active Supabase session
          const { data: session } = await supabase.auth.getSession();

          if (session?.session) {
            // Try to get MFA status for the current session
            const { data: mfaData, error: mfaError } =
              await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (!mfaError && mfaData) {
              console.log("Session MFA data:", mfaData);

              // Check if MFA is currently required for this session
              if (
                mfaData.nextLevel &&
                mfaData.nextLevel !== mfaData.currentLevel
              ) {
                // We should prompt for MFA verification
                setFactorId(mfaData.currentFactorId);
              } else {
                // MFA is not required, redirect to destination
                navigate(returnUrl);
                return;
              }
            }
          } else if (!currentUser) {
            // No active session and no user - redirect to login
            navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
            return;
          }
        }

        // Get email and type, either from params or current user
        const typeFromParams = params.get("type");
        if (typeFromParams) {
          setType(typeFromParams);
        }

        if (currentUser) {
          setEmail(currentUser.email);
        } else {
          const emailFromParams = params.get("email");
          if (emailFromParams) {
            setEmail(emailFromParams);
          }
        }
      } catch (err) {
        console.error("Error initializing MFA verification:", err);
        setError("Failed to initialize MFA verification. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initMfaVerification();
  }, [location, navigate, currentUser]);

  // Handle successful verification
  const handleSuccess = () => {
    // Redirect to the specified URL
    navigate(redirectUrl);
  };

  // Handle cancellation
  const handleCancel = () => {
    // Redirect to login page
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

  // Render MFA verification component
  return (
    <div className="mfa-container">
      <MFAVerification
        standalone={true}
        mfaData={{
          factorId,
          type,
          email,
        }}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        redirectUrl={redirectUrl}
      />
    </div>
  );
}

export default MfaVerify;
