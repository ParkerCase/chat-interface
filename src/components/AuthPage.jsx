// src/components/AuthPage.jsx - MFA FLOW FIX
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import MFAVerification from "./auth/MFAVerification";
import {
  AlertCircle,
  Loader2,
  Key,
  Lock,
  Mail,
  LogIn,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle,
  X,
  Send,
  Save,
  Shield,
} from "lucide-react";
import { debugAuth } from "../utils/authDebug";
import "./auth.css";

function AuthPage() {
  const {
    currentUser,
    login,
    logout,
    error: authError,
    setError: setAuthError,
    mfaState,
  } = useAuth();

  // State for different auth modes
  const [authMode, setAuthMode] = useState("login");
  const [resetToken, setResetToken] = useState("");

  // State for login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // State for MFA
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaData, setMfaData] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Determine auth mode based on URL path
  useEffect(() => {
    const pathname = location.pathname;
    if (pathname.includes("passcode")) {
      setAuthMode("passcode");
    } else if (pathname.includes("forgot-password")) {
      setAuthMode("forgot");
    } else if (pathname.includes("reset-password")) {
      setAuthMode("reset");
    } else {
      setAuthMode("login");
    }

    // Check for reset token in URL
    const params = new URLSearchParams(location.search);
    if (params.get("token")) {
      setAuthMode("reset");
      setResetToken(params.get("token"));
    }

    // Check for password change flag
    const passwordChanged =
      localStorage.getItem("passwordChanged") === "true" ||
      params.get("passwordChanged") === "true";
    const passwordChangedEmail = localStorage.getItem("passwordChangedEmail");

    if (passwordChanged && (authMode === "login" || pathname === "/login")) {
      console.log("Detected login after password change");

      // Show success message
      setFormError("");
      setAuthError("");
      setSuccessMessage(
        "Password changed successfully. Please log in with your new credentials."
      );

      // Pre-fill the email field if available
      if (passwordChangedEmail) {
        setEmail(passwordChangedEmail);
        setSuccessMessage(
          `Password changed successfully. Please log in with your new password for ${passwordChangedEmail}.`
        );
      }
    }

    // Debug what auth mode we're in
    console.log("Auth mode:", authMode, "Path:", pathname);
  }, [location, authMode]);

  // Check if MFA verification is needed based on mfaState
  useEffect(() => {
    if (mfaState?.required && mfaState?.data && !mfaState?.verified) {
      debugAuth.log("AuthPage", "MFA required, showing verification screen");
      setShowMfaVerification(true);
      setMfaData(mfaState.data);
    } else if (mfaState?.verified) {
      debugAuth.log("AuthPage", "MFA already verified, redirecting to admin");
      navigate("/admin");
    }
  }, [mfaState, navigate]);

  // Handle SSO login
  const handleSSOLogin = async (provider) => {
    try {
      setIsLoading(true);
      setFormError("");

      // Prepare redirect URL
      let redirectUrl = `${window.location.origin}/auth/callback`;

      // Add return URL if specified
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get("returnUrl");
      if (returnUrl) {
        redirectUrl += `?returnUrl=${encodeURIComponent(returnUrl)}`;
      }

      console.log(
        `Initiating SSO login with ${provider} to redirect: ${redirectUrl}`
      );

      // Set a flag to detect potential auth loop failures
      sessionStorage.setItem("ssoAttempt", Date.now().toString());
      sessionStorage.setItem("ssoProvider", provider);

      // Sign in with OAuth provider
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: {},
        },
      });

      if (error) throw error;

      // Handle the redirect URL from Supabase
      if (data?.url) {
        console.log(`SSO redirect URL: ${data.url}`);
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL returned from Supabase");
      }
    } catch (error) {
      console.error("SSO login error:", error);
      setFormError(`Error connecting to ${provider}: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Password login handler - FIXED
  const handlePasswordLogin = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setFormError("");
    setAuthError("");

    if (!email) {
      setFormError("Email is required");
      return;
    }

    if (!password) {
      setFormError("Password is required");
      return;
    }

    // Email domain validation for tatt2away.com
    if (!email.endsWith("@tatt2away.com") && email !== "itsus@tatt2away.com") {
      setFormError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    try {
      // Clear any existing auth-related storage
      localStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfaSuccess");
      sessionStorage.removeItem("mfaVerifiedAt");

      // Show loading state
      setIsLoading(true);

      debugAuth.log("AuthPage", `Attempting login with ${email}`);

      // Execute login with email/password
      const result = await login(email, password);

      debugAuth.log("AuthPage", `Login result:`, result);

      if (result && result.success) {
        if (result.mfaRequired && result.mfaData) {
          // Show MFA verification screen
          debugAuth.log(
            "AuthPage",
            "MFA verification required, showing screen"
          );
          setShowMfaVerification(true);
          setMfaData(result.mfaData);
        } else {
          // Fully authenticated, proceed to dashboard or admin panel
          if (result.isAdmin) {
            debugAuth.log(
              "AuthPage",
              "Admin login successful, redirecting to admin panel"
            );
            navigate("/admin");
          } else {
            // Get redirect URL from query params or default to dashboard
            const params = new URLSearchParams(location.search);
            const returnUrl = params.get("returnUrl") || "/";
            navigate(returnUrl);
          }
        }
      } else {
        setFormError(result?.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      setFormError(error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA verification success - use direct window.location.href for reliable navigation
  const handleMfaSuccess = () => {
    debugAuth.log(
      "AuthPage",
      "MFA verification successful, initiating redirect"
    );

    // Let the system know MFA is verified
    localStorage.setItem("authStage", "post-mfa");
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfaSuccess", "true");
    sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

    // Proceed to admin dashboard with a full page reload for reliable state refresh
    console.log("MFA success, forcing page reload to /admin");
    window.location.href = "/admin";
  };

  // Render different auth form based on authMode
  if (authMode === "login") {
    // Show MFA verification if needed
    if (showMfaVerification && mfaData) {
      return (
        <div className="login-container">
          <MFAVerification
            mfaData={mfaData}
            onSuccess={handleMfaSuccess}
            onCancel={() => {
              setShowMfaVerification(false);
              logout();
            }}
            redirectUrl="/admin"
          />
        </div>
      );
    }

    // Login form with SSO buttons
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="login-header">
            <img
              src="./Tatt2Away-Color-Black-Logo-300.png"
              alt="Tatt2Away Logo"
              className="login-logo"
            />
            <h2>Sign in to your account</h2>
          </div>

          {/* Display error message if any */}
          {(formError || authError) && (
            <div className="error-alert">
              <AlertCircle className="h-4 w-4" />
              <p>{formError || authError}</p>
            </div>
          )}

          {/* Display success message if any */}
          {successMessage && (
            <div className="success-alert">
              <CheckCircle className="h-4 w-4" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* Password login form */}
          <form onSubmit={handlePasswordLogin} className="login-form-fields">
            {/* Hidden username field for accessibility */}
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              className="hidden-username"
              aria-hidden="true"
              tabIndex="-1"
            />

            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="youremail@tatt2away.com"
                  className="form-input"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <div className="password-label-row">
                <label htmlFor="password">Password</label>
                <a
                  href="/forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/forgot-password");
                  }}
                  className="forgot-password"
                >
                  Forgot password?
                </a>
              </div>
              <div className="password-input-wrapper">
                <div className="input-with-icon">
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="form-input"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Divider between SSO and password */}
            <div className="login-divider">
              <span>Or with password</span>
            </div>

            {/* SSO Buttons Section */}
            <div className="sso-section">
              <h3 className="sso-heading">Sign in with</h3>

              <button
                onClick={() => handleSSOLogin("google")}
                className="sso-button google"
                disabled={isLoading}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                    fill="#4285F4"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                onClick={() => handleSSOLogin("apple")}
                className="sso-button apple"
                disabled={isLoading}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.152,6.896c-0.948,0-2.415-1.078-3.96-1.04c-2.04,0.027-3.91,1.183-4.961,3.014c-2.117,3.675-0.546,9.103,1.519,12.066c1.013,1.455,2.208,3.09,3.792,3.039c1.52-0.065,2.09-0.987,3.935-0.987c1.831,0,2.35,0.987,3.96,0.948c1.637-0.026,2.676-1.48,3.676-2.948c1.156-1.688,1.636-3.325,1.662-3.415c-0.039-0.013-3.182-1.221-3.22-4.857c-0.026-3.04,2.48-4.494,2.597-4.559c-1.429-2.09-3.623-2.324-4.39-2.376C14.641,5.781,13.073,6.896,12.152,6.896z M15.629,3.039c0.831-1.014,1.39-2.428,1.237-3.831c-1.195,0.052-2.64,0.793-3.486,1.794c-0.766,0.884-1.443,2.313-1.26,3.675C13.507,4.793,14.786,4.039,15.629,3.039z"
                    fill="#000"
                  />
                </svg>
                <span>Continue with Apple</span>
              </button>
            </div>

            {/* Submit Button */}
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Quick Access Passcode link */}
          <div className="quick-access-link">
            <a
              href="/passcode"
              onClick={(e) => {
                e.preventDefault();
                navigate("/passcode");
              }}
            >
              Use Quick Access Passcode
            </a>
          </div>
        </div>
      </div>
    );
  } else if (authMode === "passcode") {
    return <PasscodeForm />;
  } else if (authMode === "forgot") {
    return <ForgotPasswordForm />;
  } else if (authMode === "reset") {
    return <ResetPasswordForm token={resetToken} />;
  }

  // Default fallback
  return <div>Unknown authentication mode</div>;
}

// Passcode Login Form Component
function PasscodeForm() {
  const [passcode, setPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Use environment variable for security or fallback to hardcoded value
  const TEAM_PASSCODE = process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$";

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();

    // Debug info
    console.log({
      inputPassword: passcode,
      expectedPassword: TEAM_PASSCODE,
      match: passcode === TEAM_PASSCODE,
    });

    if (passcode === TEAM_PASSCODE) {
      // Store auth state in localStorage
      localStorage.setItem("isAuthenticated", "true");

      // Log success for debugging
      console.log("Passcode authentication successful");

      // Navigate to home page
      navigate("/");
    } else {
      setError("Incorrect passcode");
      setPasscode("");
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Quick Access</h2>
        <p className="login-info">
          Enter team passcode for basic access or{" "}
          <a
            href="/login"
            className="admin-link"
            onClick={(e) => {
              e.preventDefault();
              navigate("/login");
            }}
          >
            login as admin
          </a>{" "}
          for full features.
        </p>
        {error && <p className="error-message">{error}</p>}

        {/* Hidden username field for accessibility */}
        <input
          type="text"
          id="username"
          name="username"
          autoComplete="username"
          className="hidden-username"
          aria-hidden="true"
          tabIndex="-1"
        />

        <form onSubmit={handlePasscodeSubmit}>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="password-input"
              autoComplete="current-password"
              id="current-password"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" className="login-button">
            Enter
          </button>
        </form>

        <div className="back-to-login">
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              navigate("/login");
            }}
          >
            <ArrowLeft size={16} />
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

// Forgot Password Form Component
function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate email
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    // Email domain validation
    if (!email.endsWith("@tatt2away.com") && email !== "itsus@tatt2away.com") {
      setError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    try {
      setIsLoading(true);

      // Request password reset via Supabase
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) throw resetError;

      // Show success state
      setIsSuccess(true);
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(error.message || "Failed to request password reset");
    } finally {
      setIsLoading(false);
    }
  };

  // If request was successful, show success message
  if (isSuccess) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" />
            </div>
            <h2>Check Your Email</h2>
            <p>
              If an account exists for {email}, we've sent instructions to reset
              your password. Please check your email inbox and follow the
              instructions provided.
            </p>
            <p className="email-note">
              If you don't receive an email within a few minutes, check your
              spam folder or make sure you entered the correct email address.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="back-to-login-link"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Reset Password</h2>
        <p className="forgot-password-description">
          Enter your email address and we'll send you instructions to reset your
          password.
        </p>

        {/* Display error message if any */}
        {error && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="forgot-password-form">
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="form-input"
              disabled={isLoading}
              required
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="reset-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Sending...
              </>
            ) : (
              <>
                Send Reset Instructions
                <Send size={16} />
              </>
            )}
          </button>
        </form>

        <div className="forgot-password-footer">
          <button onClick={() => navigate("/login")} className="back-link">
            <ArrowLeft size={16} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

// Reset Password Form Component
function ResetPasswordForm({ token }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [error, setError] = useState("");
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

  // Extract token from URL if not provided as prop
  useEffect(() => {
    if (!token) {
      const params = new URLSearchParams(location.search);
      const tokenFromUrl = params.get("token");

      if (!tokenFromUrl) {
        setIsTokenValid(false);
      }
    }
  }, [token, location]);

  // Update password validation checks on password change
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // All validation checks should pass
    const allChecksPass = Object.values(passwordChecks).every((check) => check);

    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);

      // Update password via Supabase
      const { error: resetError } = await supabase.auth.updateUser({
        password: password,
      });

      if (resetError) throw resetError;

      // Show success state
      setIsSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // If token is invalid, show error message
  if (!isTokenValid) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="token-error-message">
            <div className="error-icon-container">
              <X className="error-icon" />
            </div>
            <h2>Invalid or Expired Link</h2>
            <p>
              The password reset link is invalid or has expired. Please request
              a new password reset link.
            </p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="new-request-link"
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If reset was successful, show success message
  if (isSuccess) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" />
            </div>
            <h2>Password Reset Successful</h2>
            <p>
              Your password has been reset successfully. You can now login with
              your new password.
            </p>
            <p className="redirect-note">
              You will be redirected to the login page shortly...
            </p>
            <button
              onClick={() => navigate("/login")}
              className="back-to-login-link"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Create New Password</h2>
        <p className="reset-password-description">
          Enter a new password for your account.
        </p>

        {/* Display error message if any */}
        {error && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="reset-password-form">
          {/* New Password Field */}
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a new password"
                className="form-input"
                disabled={isLoading}
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
              <p className="requirements-title">Password must contain:</p>
              <ul>
                <li className={passwordChecks.length ? "passed" : ""}>
                  {passwordChecks.length ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li className={passwordChecks.uppercase ? "passed" : ""}>
                  {passwordChecks.uppercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one uppercase letter</span>
                </li>
                <li className={passwordChecks.lowercase ? "passed" : ""}>
                  {passwordChecks.lowercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one lowercase letter</span>
                </li>
                <li className={passwordChecks.number ? "passed" : ""}>
                  {passwordChecks.number ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one number</span>
                </li>
                <li className={passwordChecks.special ? "passed" : ""}>
                  {passwordChecks.special ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one special character</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`form-input ${
                  confirmPassword && !passwordChecks.match
                    ? "password-mismatch"
                    : ""
                }`}
                disabled={isLoading}
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
          <button type="submit" className="reset-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Resetting...
              </>
            ) : (
              <>
                Reset Password
                <Save size={16} />
              </>
            )}
          </button>
        </form>

        <div className="reset-password-footer">
          <button onClick={() => navigate("/login")} className="back-link">
            <ArrowLeft size={16} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
