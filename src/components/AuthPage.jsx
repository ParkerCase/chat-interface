// src/components/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
} from "lucide-react";
import "./auth.css";

import { apiService, apiClient } from "../services/apiService";

function AuthPage() {
  const {
    currentUser,
    login,
    logout,
    error: authError,
    setError: setAuthError,
    setCurrentUser,
  } = useAuth();

  const [authMode, setAuthMode] = useState("login");
  const [resetToken, setResetToken] = useState(""); // Add this line
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Handle different auth modes based on URL path
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
  }, [location]);

  return (
    <div className="login-container">
      {authMode === "login" && <LoginForm />}
      {authMode === "passcode" && <PasscodeForm />}
      {authMode === "forgot" && <ForgotPasswordForm />}
      {authMode === "reset" && <ResetPasswordForm />}
    </div>
  );
}

// Regular Login Form Component
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState([]);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [loginMethod, setLoginMethod] = useState("password");
  const [processingCode, setProcessingCode] = useState(false);

  const {
    login,
    error: authError,
    setError,
    processTokenExchange,
    setCurrentUser,
  } = useAuth();
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Get providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        console.log("Fetching auth providers...");

        try {
          // Try the primary method first
          const response = await apiService.auth.getProviders();

          if (response.data && response.data.success) {
            setProviders(Object.values(response.data.providers || {}));
            setDefaultProvider(response.data.defaultProvider);
            return;
          }
        } catch (initialError) {
          console.warn("Primary provider fetch failed:", initialError.message);
        }

        // Fallback to hardcoded providers if API fails
        console.log("Using fallback providers due to API error");
        setProviders([
          {
            id: "password",
            name: "Password",
            type: "password",
          },
        ]);
        setDefaultProvider("password");
        setLoginMethod("password");
      } catch (error) {
        console.error("Failed to fetch providers:", error);
        setLoginMethod("password");
        // Final fallback
        setProviders([{ id: "password", name: "Password", type: "password" }]);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // Check for token exchange code in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");

    if (code) {
      setProcessingCode(true);

      // Use your auth context's processTokenExchange function if it exists
      if (typeof processTokenExchange === "function") {
        processTokenExchange(code)
          .then((success) => {
            if (success) {
              // Get return URL from params or default to home
              const returnUrl = params.get("returnUrl") || "/";
              navigate(returnUrl);
            } else {
              setFormError(
                "Failed to authenticate with SSO provider. Please try again."
              );
            }
          })
          .finally(() => {
            setProcessingCode(false);
          });
      } else {
        // Alternative approach if processTokenExchange isn't available
        apiService.auth
          .exchangeToken(code)
          .then((response) => {
            if (response.data && response.data.success) {
              // Store tokens
              localStorage.setItem("authToken", response.data.token);
              if (response.data.refreshToken) {
                localStorage.setItem(
                  "refreshToken",
                  response.data.refreshToken
                );
              }
              if (response.data.sessionId) {
                localStorage.setItem("sessionId", response.data.sessionId);
              }

              // Update the current user through the auth context
              if (response.data.user) {
                setCurrentUser(response.data.user);
              }

              // Navigate to the return URL
              const returnUrl = params.get("returnUrl") || "/";
              navigate(returnUrl);
            } else {
              setFormError("Authentication failed. Please try again.");
            }
          })
          .catch((error) => {
            console.error("Token exchange error:", error);
            setFormError("Failed to complete authentication");
          })
          .finally(() => {
            setProcessingCode(false);
          });
      }
    }
  }, [location, navigate, processTokenExchange, setCurrentUser]);
  // In AuthPage.jsx or Login component
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        console.log("Fetching auth providers...");

        // First try the API endpoint
        try {
          const response = await apiService.auth.getProviders();
          if (response.data && response.data.success) {
            setProviders(Object.values(response.data.providers || {}));
            setDefaultProvider(response.data.defaultProvider);
            return;
          }
        } catch (error) {
          console.warn("Provider API failed, using fallback:", error.message);
        }

        // If that fails, use a direct fetch with no credentials
        try {
          const response = await fetch(
            `${apiService.utils.getBaseUrl()}/api/auth/providers`
          );
          const data = await response.json();

          if (data.success) {
            setProviders(Object.values(data.providers || {}));
            setDefaultProvider(data.defaultProvider);
            return;
          }
        } catch (error) {
          console.warn("Fallback fetch failed:", error.message);
        }

        // If both fail, use hardcoded fallback
        setProviders([
          {
            id: "password",
            name: "Password",
            type: "password",
          },
        ]);
        setDefaultProvider("password");
        setLoginMethod("password");
      } catch (error) {
        console.error("Failed to fetch providers:", error);
        setLoginMethod("password"); // Fall back to password login
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // In the handleSubmit function of LoginForm
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setIsLoading(true);
      console.log("Attempting login with:", email); // Debug logging

      // Call the login function
      const success = await login(email, password);
      console.log("Login result:", success); // Debug the result

      if (success) {
        // Debug what's in localStorage after login
        console.log("Auth state after login:", {
          token: localStorage.getItem("authToken"),
          isAuthenticated: localStorage.getItem("isAuthenticated"),
        });

        // Get return URL from query params or default to home
        const params = new URLSearchParams(location.search);
        const returnUrl = params.get("returnUrl") || "/";
        navigate(returnUrl);
      }
    } catch (error) {
      console.error("Login error:", error);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle SSO login
  const handleSSOLogin = (provider) => {
    // Generate return URL
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get("returnUrl") || "/";

    // Create URL with return URL param
    const ssoUrl = `${provider.loginUrl}?returnUrl=${encodeURIComponent(
      returnUrl
    )}`;

    // Redirect to SSO provider
    window.location.href = ssoUrl;
  };

  // Render SSO buttons
  const renderSSOButtons = () => {
    if (loadingProviders) {
      return (
        <div className="sso-loading">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading authentication providers...</p>
        </div>
      );
    }

    if (providers.length === 0) {
      return (
        <div className="sso-error">
          <AlertCircle className="h-6 w-6" />
          <p>
            No authentication providers available. Please use password login.
          </p>
        </div>
      );
    }

    return (
      <div className="sso-providers">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleSSOLogin(provider)}
            className={`sso-button ${provider.type}`}
            disabled={isLoading || processingCode}
          >
            <span>Continue with {provider.name}</span>
          </button>
        ))}
      </div>
    );
  };

  if (processingCode) {
    return (
      <div className="login-form">
        <div className="processing-sso">
          <Loader2 className="h-10 w-10 animate-spin" />
          <h2>Authenticating...</h2>
          <p>Please wait while we complete your login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-form">
      <div className="login-header">
        <img
          src="/Tatt2Away-Color-Black-Logo-300.png"
          alt="Tatt2Away Logo"
          className="login-logo"
        />
        <h2>Sign in to your account</h2>
      </div>

      {/* Login method toggle */}
      <div className="login-method-toggle">
        <button
          className={`method-tab ${loginMethod === "password" ? "active" : ""}`}
          onClick={() => setLoginMethod("password")}
          disabled={isLoading}
        >
          <Lock size={16} />
          <span>Password</span>
        </button>
        <button
          className={`method-tab ${loginMethod === "sso" ? "active" : ""}`}
          onClick={() => setLoginMethod("sso")}
          disabled={isLoading || providers.length === 0}
        >
          <LogIn size={16} />
          <span>Single Sign-On</span>
        </button>
      </div>

      {/* Display error message if any */}
      {(formError || authError) && (
        <div className="error-alert">
          <AlertCircle className="h-4 w-4" />
          <p>{formError || authError}</p>
        </div>
      )}

      {loginMethod === "password" ? (
        <form onSubmit={handleSubmit} className="login-form-fields">
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
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div
              style={{
                margin: "20px 0",
                padding: "10px",
                border: "1px dashed #ccc",
              }}
            >
              <h4>Development Login</h4>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(
                      "http://147.182.247.128:4000/api/auth/dev-access",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    const data = await response.json();

                    if (data.success) {
                      localStorage.setItem("authToken", data.token);
                      localStorage.setItem(
                        "currentUser",
                        JSON.stringify(data.user)
                      );
                      window.location.href = "/admin";
                    } else {
                      console.error("Dev login failed", data);
                    }
                  } catch (error) {
                    console.error("Error:", error);
                  }
                }}
              >
                Quick Admin Access
              </button>
            </div>
          </div>
          {/* Submit Button */}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner h-4 w-4" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      ) : (
        <div className="sso-section">{renderSSOButtons()}</div>
      )}

      {/* Divider between login methods */}
      <div className="login-divider">
        <span>Or continue with</span>
      </div>

      {/* Alternative login method button */}
      {loginMethod === "password" ? (
        <button
          onClick={() => setLoginMethod("sso")}
          className="alt-login-button"
          disabled={isLoading || providers.length === 0}
        >
          <LogIn className="h-4 w-4" />
          <span>Single Sign-On</span>
        </button>
      ) : (
        <button
          onClick={() => setLoginMethod("password")}
          className="alt-login-button"
          disabled={isLoading}
        >
          <Lock className="h-4 w-4" />
          <span>Password</span>
        </button>
      )}

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
  );
}

// Passcode Login Form Component
function PasscodeForm() {
  const [passcode, setPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Use environment variable for security or fallback to hardcoded value
  const TEAM_PASSCODE = process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$";

  // Fix in AuthPage.jsx - PasscodeForm component
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
    </div>
  );
}

// Forgot Password Form Component
function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    requestPasswordReset,
    error: authError,
    setError: setAuthError,
  } = useAuth();
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    // Validate email
    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }

    try {
      setIsLoading(true);

      // Call the password reset request function
      const success = await requestPasswordReset(email);

      if (success) {
        setIsSuccess(true);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Password reset request error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // If request was successful, show success message
  if (isSuccess) {
    return (
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
            If you don't receive an email within a few minutes, check your spam
            folder or make sure you entered the correct email address.
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
    );
  }

  return (
    <div className="login-form">
      <h2>Reset Password</h2>
      <p className="forgot-password-description">
        Enter your email address and we'll send you instructions to reset your
        password.
      </p>

      {/* Display error message if any */}
      {(formError || authError) && (
        <div className="error-alert">
          <AlertCircle className="error-icon" />
          <p>{formError || authError}</p>
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
  );
}

// Reset Password Form Component
function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const { resetPassword, error: authError, setError: setAuthError } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get("token");

    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
    } else {
      // No token found
      setIsTokenValid(false);
    }
  }, [location]);

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
    setFormError("");
    setAuthError("");

    // All validation checks should pass
    const allChecksPass = Object.values(passwordChecks).every((check) => check);

    if (!allChecksPass) {
      setFormError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);

      // Call the password reset function
      const success = await resetPassword(password, resetToken);

      if (success) {
        setIsSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // If token is invalid, show error message
  if (!isTokenValid) {
    return (
      <div className="login-form">
        <div className="token-error-message">
          <div className="error-icon-container">
            <X className="error-icon" />
          </div>
          <h2>Invalid or Expired Link</h2>
          <p>
            The password reset link is invalid or has expired. Please request a
            new password reset link.
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="new-request-link"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  // If reset was successful, show success message
  if (isSuccess) {
    return (
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
    );
  }

  return (
    <div className="login-form">
      <h2>Create New Password</h2>
      <p className="reset-password-description">
        Enter a new password for your account.
      </p>

      {/* Display error message if any */}
      {(formError || authError) && (
        <div className="error-alert">
          <AlertCircle className="error-icon" />
          <p>{formError || authError}</p>
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
  );
}

export default AuthPage;
