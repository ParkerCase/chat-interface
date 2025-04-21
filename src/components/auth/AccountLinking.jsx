// src/components/auth/AccountLinking.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import {
  linkIdentity,
  completeEmailVerification,
  startOAuthLinking,
  checkLinkingStatus,
  clearLinkingState,
} from "../../utils/identityLinking";
import {
  Loader2,
  AlertCircle,
  Shield,
  Mail,
  Google,
  Apple,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import "./AccountLinking.css";

/**
 * Account linking component for handling the process of linking
 * existing accounts with social providers
 */
function AccountLinking() {
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState("initial"); // initial, verify_email, start_oauth, complete, error
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL params on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const providerParam = params.get("provider");
    const stepParam = params.get("step");

    if (emailParam) setEmail(emailParam);
    if (providerParam) setProvider(providerParam);
    if (stepParam) setStep(stepParam);

    // Check if we were in the middle of linking
    const {
      isLinking,
      provider: savedProvider,
      email: savedEmail,
    } = checkLinkingStatus();

    if (isLinking && savedProvider) {
      if (savedProvider) setProvider(savedProvider);
      if (savedEmail) setEmail(savedEmail);

      // If we have both email and provider, move to email verification step
      if (savedEmail && savedProvider) {
        setStep("verify_email");
      }
    }
  }, [location]);

  // Initiate account linking process
  const handleStartLinking = async () => {
    if (!email) {
      setErrorMessage("Please enter your email address");
      return;
    }

    if (!provider) {
      setErrorMessage("Please select a provider to link");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await linkIdentity(email, provider);

      if (!result.success) {
        throw new Error(result.error || "Failed to start account linking");
      }

      // Update UI based on next step
      setStep(result.step);
      setMessage(result.message);

      // Update URL to reflect current state
      navigate(
        `/link-account?email=${encodeURIComponent(
          email
        )}&provider=${provider}&step=${result.step}`,
        { replace: true }
      );
    } catch (error) {
      setErrorMessage(error.message);
      debugAuth.log(
        "AccountLinking",
        `Error starting linking: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setErrorMessage("Please enter a valid 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await completeEmailVerification(
        email,
        provider,
        verificationCode
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to verify code");
      }

      // Move to next step based on result
      setStep(result.step);
      setMessage(result.message);

      // If we need to start OAuth, do it after a brief delay
      if (result.step === "start_oauth") {
        setTimeout(() => {
          startOAuthLinking(provider);
        }, 1500);
      }

      // If we're complete, redirect after delay
      if (result.step === "complete") {
        setTimeout(() => {
          navigate("/login?linked=true");
        }, 3000);
      }
    } catch (error) {
      setErrorMessage(error.message);
      debugAuth.log("AccountLinking", `Verification error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Start OAuth flow directly
  const handleStartOAuth = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await startOAuthLinking(provider);

      if (!result.success) {
        throw new Error(result.error || "Failed to start OAuth flow");
      }

      // If redirecting, we don't need to do anything else
    } catch (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      debugAuth.log("AccountLinking", `OAuth error: ${error.message}`);
    }
  };

  // Handle going back to previous step
  const handleBack = () => {
    if (step === "verify_email") {
      setStep("initial");
    } else if (step === "start_oauth") {
      setStep("verify_email");
    } else {
      navigate("/login");
    }
  };

  // Handle cancellation - clear state and go back to login
  const handleCancel = () => {
    clearLinkingState();
    navigate("/login");
  };

  // Initial step - select provider and enter email
  if (step === "initial") {
    return (
      <div className="account-linking-container">
        <div className="linking-header">
          <Shield size={32} className="linking-icon" />
          <h2>Link Your Account</h2>
          <p>
            Connect your existing account with a social provider for easier
            sign-in
          </p>
        </div>

        {errorMessage && (
          <div className="error-message">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="linking-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your existing account email"
              disabled={isLoading}
              required
            />
            <p className="input-hint">
              Enter the email you normally use to sign in
            </p>
          </div>

          <div className="form-group">
            <label>Select Provider to Link</label>
            <div className="provider-buttons">
              <button
                type="button"
                className={`provider-button ${
                  provider === "google" ? "selected" : ""
                }`}
                onClick={() => setProvider("google")}
                disabled={isLoading}
              >
                <Google size={18} />
                <span>Google</span>
              </button>

              <button
                type="button"
                className={`provider-button ${
                  provider === "apple" ? "selected" : ""
                }`}
                onClick={() => setProvider("apple")}
                disabled={isLoading}
              >
                <Apple size={18} />
                <span>Apple</span>
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={handleStartLinking}
              disabled={isLoading || !email || !provider}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Email verification step
  if (step === "verify_email") {
    return (
      <div className="account-linking-container">
        <div className="linking-header">
          <Mail size={32} className="linking-icon" />
          <h2>Verify Your Email</h2>
          <p>{message || `We've sent a verification code to ${email}`}</p>
        </div>

        {errorMessage && (
          <div className="error-message">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="linking-form">
          <div className="form-group">
            <label htmlFor="verification-code">Verification Code</label>
            <input
              type="text"
              id="verification-code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="Enter 6-digit code"
              maxLength={6}
              disabled={isLoading}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <p className="input-hint">Check your email inbox and spam folder</p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={handleVerifyCode}
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // OAuth authorization step
  if (step === "start_oauth") {
    return (
      <div className="account-linking-container">
        <div className="linking-header">
          {provider === "google" ? (
            <Google size={32} className="linking-icon" />
          ) : (
            <Apple size={32} className="linking-icon" />
          )}
          <h2>Link with {provider === "google" ? "Google" : "Apple"}</h2>
          <p>
            {message ||
              `Authorize with ${
                provider === "google" ? "Google" : "Apple"
              } to complete linking`}
          </p>
        </div>

        {errorMessage && (
          <div className="error-message">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="oauth-content">
          <div className="info-box">
            <p>
              Click the button below to continue to{" "}
              {provider === "google" ? "Google" : "Apple"} for authorization.
            </p>
            <p>
              You'll be redirected back to this site automatically after signing
              in.
            </p>
          </div>

          <div className="form-actions oauth-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button
              type="button"
              className={`oauth-button ${provider}-button`}
              onClick={handleStartOAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  {provider === "google" ? (
                    <Google size={18} />
                  ) : (
                    <Apple size={18} />
                  )}
                  <span>
                    Continue with {provider === "google" ? "Google" : "Apple"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete step - success message
  if (step === "complete") {
    return (
      <div className="account-linking-container">
        <div className="success-state">
          <CheckCircle size={48} className="success-icon" />
          <h2>Account Linked Successfully</h2>
          <p>
            {message ||
              `Your account has been linked with ${
                provider === "google" ? "Google" : "Apple"
              }`}
          </p>
          <p className="redirect-message">Redirecting to login page...</p>

          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/login?linked=true")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="account-linking-container">
        <div className="error-state">
          <AlertCircle size={48} className="error-icon" />
          <h2>Account Linking Failed</h2>
          <p>
            {errorMessage ||
              "An error occurred during the account linking process"}
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancel}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => setStep("initial")}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback - should not happen
  return (
    <div className="account-linking-container">
      <div className="loading-state">
        <Loader2 className="spinner" size={36} />
        <p>Processing...</p>
      </div>
    </div>
  );
}

export default AccountLinking;
