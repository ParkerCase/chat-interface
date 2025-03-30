// src/components/MfaVerify.jsx - Complete replacement

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import MFAVerification from "./auth/MFAVerification";
import { AlertCircle, Loader2 } from "lucide-react";
import "./auth.css";

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

        console.log("MFA Verify initializing with returnUrl:", returnUrl);

        // Get factor ID and other MFA data
        let factorIdFromParams = params.get("factorId");
        let methodIdFromParams = params.get("methodId");
        let typeFromParams = params.get("type") || "totp";

        if (factorIdFromParams) {
          console.log("Using factorId from URL params:", factorIdFromParams);
          setFactorId(factorIdFromParams);
          setType(typeFromParams);
        } else {
          // Try to get MFA status from Supabase session
          try {
            console.log("Checking Supabase session for MFA data");
            const { data: sessionData } = await supabase.auth.getSession();

            if (sessionData?.session) {
              console.log("Active Supabase session found");
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
                  setType("totp"); // Default to TOTP
                  console.log(
                    "MFA verification required with factorId:",
                    mfaData.currentFactorId
                  );
                } else {
                  console.log("MFA not required for this session, redirecting");
                  // MFA is not required, redirect to destination
                  navigate(returnUrl);
                  return;
                }
              } else if (mfaError) {
                console.warn("Error getting MFA status:", mfaError);
              }
            } else if (!currentUser) {
              console.log(
                "No active session and no user, redirecting to login"
              );
              // No active session and no user - redirect to login
              navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
              return;
            }
          } catch (err) {
            console.error("Error getting MFA status:", err);
            throw new Error("Failed to get MFA status");
          }
        }

        // Get email from current user or params
        if (currentUser) {
          setEmail(currentUser.email);
          console.log("Using email from current user:", currentUser.email);
        } else {
          const emailFromParams = params.get("email");
          if (emailFromParams) {
            setEmail(emailFromParams);
            console.log("Using email from URL params:", emailFromParams);
          }
        }

        // Reset loading state once all data is loaded
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing MFA verification:", err);
        setError("Failed to initialize MFA verification. Please try again.");
        setIsLoading(false);
      }
    };

    initMfaVerification();
  }, [location, navigate, currentUser]);

  // Handle successful verification
  const handleSuccess = () => {
    console.log("MFA verification successful, redirecting to:", redirectUrl);

    // Force complete page reload with the updated auth state
    setTimeout(() => {
      // Get current user to check admin status
      const isAdmin =
        currentUser?.roles?.includes("admin") ||
        currentUser?.roles?.includes("super_admin") ||
        currentUser?.email === "itsus@tatt2away.com";

      // Use replace for a complete page reload
      window.location.replace(isAdmin ? "/admin" : redirectUrl || "/");
    }, 1000);
  };

  // Handle cancellation
  const handleCancel = () => {
    console.log("MFA verification cancelled, redirecting to login");
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
          methodId: factorId, // For backward compatibility
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
