// src/components/MfaVerify.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, enhancedAuth } from "../lib/supabase";
import MFAVerification from "./auth/MFAVerification";
import { Loader2, AlertCircle } from "lucide-react";
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
        console.log("MFA verification initializing...");

        const params = new URLSearchParams(location.search);

        // Get redirect URL from query params
        const returnUrl = params.get("returnUrl") || "/";
        setRedirectUrl(returnUrl);
        console.log("Return URL set to:", returnUrl);

        // Get factor ID and other MFA data
        let factorIdFromParams = params.get("factorId");
        let methodIdFromParams = params.get("methodId");
        let typeFromParams = params.get("type") || "totp";

        // Check for session MFA requirements
        try {
          console.log("Checking Supabase session for MFA data");
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData?.session) {
            console.log("Active session found, checking MFA requirements");

            // Get MFA status
            const { data: mfaData, error: mfaError } =
              await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (!mfaError && mfaData) {
              console.log("MFA data:", mfaData);

              // Check if MFA is required
              if (
                mfaData.nextLevel &&
                mfaData.nextLevel !== mfaData.currentLevel
              ) {
                console.log("MFA verification required");

                // Set factor ID if available
                if (mfaData.currentFactorId) {
                  factorIdFromParams = mfaData.currentFactorId;
                }
              } else {
                console.log("MFA not required, redirecting");
                navigate(returnUrl);
                return;
              }
            }
          }
        } catch (error) {
          console.error("Error checking MFA status:", error);
        }

        // Prefer URL parameters over session data
        if (factorIdFromParams) {
          setFactorId(factorIdFromParams);
          setType(typeFromParams);
          console.log("Using factor ID from URL:", factorIdFromParams);
        } else if (methodIdFromParams) {
          setFactorId(methodIdFromParams);
          setType(typeFromParams);
          console.log("Using method ID from URL:", methodIdFromParams);
        } else {
          console.warn("No factor ID or method ID found");
        }

        // Get email from current user or params
        if (currentUser?.email) {
          setEmail(currentUser.email);
        } else {
          const emailFromParams = params.get("email");
          if (emailFromParams) {
            setEmail(emailFromParams);
          }
        }

        // Create MFA data object
        const mfaDataObject = {
          factorId: factorIdFromParams || methodIdFromParams,
          methodId: methodIdFromParams || factorIdFromParams,
          type: typeFromParams,
          email: currentUser?.email || params.get("email"),
        };

        setMfaData(mfaDataObject);
        console.log("MFA data prepared:", mfaDataObject);
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
    console.log("MFA verification successful in MfaVerify component");

    // Set multiple flags for better detection
    sessionStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfaSuccess", "true");
    sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
    sessionStorage.setItem("mfaRedirectPending", "true");
    sessionStorage.setItem("mfaRedirectTarget", "/admin");
    
    // Use multiple approaches to ensure navigation works
    try {
      console.log("Executing primary navigation to /admin");
      // Force a complete page reload
      window.location.href = "/admin";
      
      // Use timeout for secondary navigation attempt
      setTimeout(() => {
        console.log("Executing secondary navigation attempt");
        window.location.replace("/admin");
        
        // Last resort - if we're still here after 1.5s, try navigate API
        setTimeout(() => {
          console.log("Executing tertiary navigation attempt");
          navigate("/admin", { replace: true });
        }, 1000);
      }, 500);
    } catch (e) {
      console.error("Navigation error in MfaVerify:", e);
      // Direct navigation as last resort
      window.location = "/admin";
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    console.log("MFA verification cancelled");
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
  if (!mfaData?.factorId && !mfaData?.methodId) {
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
        redirectUrl="/admin"
      />
    </div>
  );
}

export default MfaVerify;
