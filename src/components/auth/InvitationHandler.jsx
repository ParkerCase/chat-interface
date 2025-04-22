// src/components/auth/InvitationHandler.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import {
  User,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  Lock,
} from "lucide-react";
import "../auth.css";

function InvitationHandler() {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitationToken, setInvitationToken] = useState(null);

  // Password validation
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Check for invitation token and parse URL
  useEffect(() => {
    const processInvitation = async () => {
      try {
        debugAuth.log("InvitationHandler", "Processing invitation");

        // Set flag for invitation flow
        localStorage.setItem("invitation_flow", "true");
        sessionStorage.setItem("invitation_flow", "true");

        // Get token from URL or session storage
        const params = new URLSearchParams(location.search);
        const tokenFromUrl =
          params.get("token") || params.get("invitation_token");
        const tokenFromStorage = sessionStorage.getItem("invitation_token");
        const token = tokenFromUrl || tokenFromStorage;

        if (token) {
          setInvitationToken(token);
          sessionStorage.setItem("invitation_token", token);

          debugAuth.log("InvitationHandler", "Found invitation token");
        }

        // Extract email from hash or params if available
        const hash = window.location.hash;
        let emailFromFlow = "";

        if (hash) {
          // Parse hash fragment
          const hashParams = new URLSearchParams(hash.substring(1));
          emailFromFlow = hashParams.get("email") || "";
        }

        // Alternatively, try to get email from query params
        if (!emailFromFlow) {
          emailFromFlow = params.get("email") || "";
        }

        if (emailFromFlow) {
          setEmail(emailFromFlow);
          debugAuth.log("InvitationHandler", `Found email: ${emailFromFlow}`);
        }

        // Try to check if we already have a session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          // We already have a session, try to get user data
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (!userError && userData?.user?.email) {
            setEmail(userData.user.email);
            debugAuth.log(
              "InvitationHandler",
              `Using email from session: ${userData.user.email}`
            );
          }
        }

        // If we have hash parameters, wait for Supabase to process them
        if (hash && hash.includes("type=invite")) {
          debugAuth.log("InvitationHandler", "Processing hash parameters");

          // Give Supabase time to process the hash
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if session was created
          const { data: updatedSessionData } = await supabase.auth.getSession();

          if (updatedSessionData?.session) {
            debugAuth.log("InvitationHandler", "Session created from hash");

            // Get user data
            const { data: updatedUserData } = await supabase.auth.getUser();

            if (updatedUserData?.user?.email) {
              setEmail(updatedUserData.user.email);
            }
          }
        }
      } catch (err) {
        console.error("Error processing invitation:", err);
        setError(
          "Failed to process invitation. Please try again or contact support."
        );
        debugAuth.log("InvitationHandler", `Error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    processInvitation();
  }, [location]);

  // Update password validation checks
  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password === confirmPassword && password !== "",
    });
  }, [password, confirmPassword]);

  // Complete invitation
  const handleSetupAccount = async (e) => {
    e.preventDefault();

    // Validate all fields
    if (!email) {
      setError("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Check if all password requirements are met
    const allChecksPass = Object.values(passwordChecks).every((check) => check);
    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      debugAuth.log("InvitationHandler", "Setting up account");

      // Handle password setup
      // If we have a current session, update the user
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session) {
        debugAuth.log("InvitationHandler", "Updating user with active session");

        // Update user password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
          data: {
            full_name: name,
            name: name,
          },
        });

        if (updateError) throw updateError;
      } else {
        debugAuth.log(
          "InvitationHandler",
          "No active session, attempting password setup"
        );

        // Try to use the invitation token if available
        if (invitationToken) {
          // Use the token to set up the account
          const { error: tokenError } = await supabase.auth.verifyOtp({
            token_hash: invitationToken,
            type: "invite",
          });

          if (tokenError && !tokenError.message.includes("already been used")) {
            throw tokenError;
          }

          // Update password
          const { error: updateError } = await supabase.auth.updateUser({
            password: password,
            data: {
              full_name: name,
              name: name,
            },
          });

          if (updateError) throw updateError;
        } else {
          // No token, no session - fallback to direct login with create user option
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                name: name,
              },
            },
          });

          if (signUpError) throw signUpError;
        }
      }

      // Create or update profile in the database
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (!userError && userData?.user?.id) {
        const userId = userData.user.id;

        // Try to update profile
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: userId,
            email: email,
            full_name: name || email.split("@")[0],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (profileError) {
          console.warn("Error updating profile:", profileError);
        }
      }

      // Success!
      setSuccess(true);

      // Clear invitation flow flags
      localStorage.removeItem("invitation_flow");
      sessionStorage.removeItem("invitation_flow");
      sessionStorage.removeItem("invitation_token");

      // Set auth flags
      localStorage.setItem("authStage", "pre-mfa");

      // Redirect after a delay
      setTimeout(() => {
        // Go to MFA setup - this ensures security
        navigate("/mfa/verify?returnUrl=/admin");
      }, 2000);
    } catch (err) {
      console.error("Account setup error:", err);
      setError(err.message || "Failed to set up account. Please try again.");
      debugAuth.log("InvitationHandler", `Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="loading-state">
            <Loader2 className="spinner" size={36} />
            <h3>Processing Invitation</h3>
            <p>Please wait while we process your invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h3>Account Setup Complete!</h3>
            <p>Your account has been successfully set up.</p>
            <p>
              You'll be redirected to verify your identity for enhanced
              security.
            </p>
            <div className="loading-indicator">
              <Loader2 className="spinner" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Account setup form
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <User size={28} className="auth-icon" />
          <h2>Complete Your Account Setup</h2>
          <p>Please create a password to activate your account.</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSetupAccount} className="login-form-fields">
          {/* Email Field (usually pre-filled and disabled) */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="form-input"
              disabled={!!email || isSubmitting}
              required
            />
          </div>

          {/* Name Field */}
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="form-input"
              disabled={isSubmitting}
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Create Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password"
                className="form-input"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="password-requirements">
              <p className="requirements-title">Password must have:</p>
              <ul>
                <li className={passwordChecks.length ? "passed" : ""}>
                  {passwordChecks.length ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="check-marker">✗</span>
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li className={passwordChecks.uppercase ? "passed" : ""}>
                  {passwordChecks.uppercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="check-marker">✗</span>
                  )}
                  <span>At least one uppercase letter</span>
                </li>
                <li className={passwordChecks.lowercase ? "passed" : ""}>
                  {passwordChecks.lowercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="check-marker">✗</span>
                  )}
                  <span>At least one lowercase letter</span>
                </li>
                <li className={passwordChecks.number ? "passed" : ""}>
                  {passwordChecks.number ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="check-marker">✗</span>
                  )}
                  <span>At least one number</span>
                </li>
                <li className={passwordChecks.special ? "passed" : ""}>
                  {passwordChecks.special ? (
                    <CheckCircle size={14} />
                  ) : (
                    <span className="check-marker">✗</span>
                  )}
                  <span>At least one special character</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`form-input ${
                  confirmPassword && !passwordChecks.match
                    ? "password-mismatch"
                    : ""
                }`}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && !passwordChecks.match && (
              <p className="password-mismatch-text">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="spinner" size={16} />
                Setting Up Account...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-security-note">
          <Lock size={16} />
          <p>
            Your password must meet all the requirements above for security
            purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default InvitationHandler;
