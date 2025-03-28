// src/components/LoginForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiService from "../services/apiService";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  LogIn,
  Eye,
  EyeOff,
  CheckCircle,
  X,
  ArrowRight,
  Shield,
} from "lucide-react";
import "./LoginForm.css";

function LoginForm() {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState([]);
  const [loginMethod, setLoginMethod] = useState("password");
  const [processingCode, setProcessingCode] = useState(false);

  // Error handling
  const [formError, setFormError] = useState("");

  // MFA state
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  // Get auth context
  const {
    login,
    error: authError,
    setError,
    processTokenExchange,
    currentUser,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const codeInputRef = useRef(null);

  // Focus code input when MFA screen shows
  useEffect(() => {
    if (showMfaVerification && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [showMfaVerification]);

  // Get authentication providers on component mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        console.log("Fetching auth providers...");

        const response = await apiService.auth.getProviders();

        if (response.data && response.data.success) {
          const providersData = response.data.providers || {};
          setProviders(Object.values(providersData));

          // If SSO providers exist and there's more than just password,
          // default to the SSO tab
          if (Object.keys(providersData).length > 1) {
            setLoginMethod("sso");
          }
        } else {
          // Fallback to password login if provider fetch fails
          setLoginMethod("password");
        }
      } catch (error) {
        console.error("Failed to fetch providers:", error);
        // Fall back to password login on error
        setLoginMethod("password");
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // Handle SSO code exchange from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error");

    // Clear any previous errors
    if (code || error) {
      setFormError("");
      setError("");
    }

    // Handle error in SSO flow
    if (error) {
      setFormError(`Authentication error: ${error}`);
      return;
    }

    // Process auth code if present
    if (code) {
      setProcessingCode(true);

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
        .catch((error) => {
          console.error("Token exchange error:", error);
          setFormError("Authentication failed. Please try again later.");
        })
        .finally(() => {
          setProcessingCode(false);
        });
    }
  }, [location, navigate, processTokenExchange, setError]);

  // Handle form submission (password login)
  // In LoginForm.jsx, update the handleSubmit function
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setIsLoading(true);

      // First try the normal login
      try {
        const regularLoginSuccess = await login(email, password);
        if (regularLoginSuccess) {
          // Get return URL from query params or default to home
          const params = new URLSearchParams(location.search);
          const returnUrl = params.get("returnUrl") || "/";
          navigate(returnUrl);
          return;
        }
      } catch (regularLoginError) {
        console.log(
          "Regular login failed, trying dev login:",
          regularLoginError
        );
      }

      // If regular login fails, try the dev login endpoint
      try {
        if (
          process.env.NODE_ENV === "development" ||
          process.env.REACT_APP_ALLOW_DEV_LOGIN === "true"
        ) {
          console.log("Attempting dev login...");
          const response = await fetch(
            `${apiService.utils.getBaseUrl()}/api/auth/dev-login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email, password }),
              credentials: "include",
            }
          );

          const data = await response.json();

          if (data.success) {
            // Store tokens
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("currentUser", JSON.stringify(data.user));

            // Set user in context
            setCurrentUser(data.user);

            // Redirect
            const params = new URLSearchParams(location.search);
            const returnUrl = params.get("returnUrl") || "/";
            navigate(returnUrl);
            return;
          }
        }
      } catch (devLoginError) {
        console.error("Dev login also failed:", devLoginError);
      }

      // If we get here, both login methods failed
      setFormError(
        "Login failed. Please check your credentials and try again."
      );
    } catch (error) {
      console.error("Login error:", error);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // In your LoginForm component, add a hardcoded login option
  const attemptHardcodedLogin = () => {
    if (email === "itsus@tatt2away.com") {
      // Create a minimal admin user
      const adminUser = {
        id: "admin-user-123",
        name: "Tatt2Away Admin",
        email: "itsus@tatt2away.com",
        roles: ["admin", "user"],
        tenantId: "default",
      };

      // Store in localStorage
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("currentUser", JSON.stringify(adminUser));

      // Update auth context
      setCurrentUser(adminUser);

      // Navigate to dashboard
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get("returnUrl") || "/";
      navigate(returnUrl);

      return true;
    }
    return false;
  };

  // Call this before attempting regular login
  if (attemptHardcodedLogin()) {
    return; // Skip regular login if hardcoded login succeeds
  }

  // Handle SSO login
  const handleSSOLogin = async (provider) => {
    try {
      setIsLoading(true);
      setFormError("");

      // Get return URL from query params or default to home
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get("returnUrl") || "/";

      // Build SSO URL with proper redirects
      const encodedRedirect = encodeURIComponent(
        `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(
          returnUrl
        )}`
      );
      const ssoUrl = `${provider.loginUrl}?redirectTo=${encodedRedirect}`;

      // Redirect to SSO provider
      window.location.href = ssoUrl;
    } catch (error) {
      console.error("SSO login error:", error);
      setFormError(
        `Error connecting to ${provider.name} login: ${error.message}`
      );
      setIsLoading(false);
    }
  };

  // Handle MFA verification
  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setMfaError("");

    if (!verificationCode || verificationCode.length !== 6) {
      setMfaError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);

      // Call verify endpoint
      const response = await apiService.auth.verifyMfa({
        methodId: mfaData.methodId,
        verificationCode: verificationCode,
      });

      if (response.data.success) {
        // Store new token if provided
        if (response.data.token) {
          localStorage.setItem("authToken", response.data.token);
          // Update axios auth header
          apiService.utils.setAuthToken(response.data.token);
        }

        // Get return URL from query params or default to home
        const params = new URLSearchParams(location.search);
        const returnUrl = params.get("returnUrl") || "/";

        navigate(returnUrl);
      } else {
        setMfaError(response.data.error || "Verification failed");
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      setMfaError("Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel MFA verification
  const handleCancelMfa = () => {
    setShowMfaVerification(false);
    setVerificationCode("");
    setMfaError("");
  };

  // If already processing an SSO code, show loading indicator
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

  // If MFA verification is needed, show MFA screen
  if (showMfaVerification) {
    return (
      <div className="login-form">
        <div className="mfa-verification-container">
          <div className="mfa-header">
            <Shield className="mfa-icon" size={32} />
            <h2>Two-Factor Authentication</h2>
            <p>
              Enter the verification code from your
              {mfaData?.type === "email" ? " email" : " authenticator app"}
            </p>
          </div>

          {mfaError && (
            <div className="mfa-error-alert">
              <AlertCircle size={16} />
              <p>{mfaError}</p>
            </div>
          )}

          <form onSubmit={handleVerifyMfa} className="mfa-form">
            <div className="form-group">
              <label htmlFor="verification-code">Verification Code</label>
              <input
                type="text"
                id="verification-code"
                ref={codeInputRef}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="000000"
                className="verification-code-input"
                maxLength={6}
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>

            <div className="mfa-actions">
              <button
                type="button"
                onClick={handleCancelMfa}
                className="cancel-button"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="verify-button"
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="spinner h-4 w-4" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Regular login form
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
          {/* Hidden username field for browser autocomplete */}
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
              <Link to="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
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

          {/* Submit Button */}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner h-4 w-4" />
                Logging in...
              </>
            ) : (
              <>
                Login
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="sso-section">
          {loadingProviders ? (
            <div className="sso-loading">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading authentication providers...</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="sso-error">
              <AlertCircle className="h-6 w-6" />
              <p>
                No authentication providers available. Please use password
                login.
              </p>
            </div>
          ) : (
            <div className="sso-providers">
              {providers
                .filter((provider) => provider.type !== "password")
                .map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleSSOLogin(provider)}
                    className={`sso-button ${provider.type}`}
                    disabled={isLoading}
                  >
                    <span>Continue with {provider.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
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

      {/* Sign up link */}
      <div className="login-footer">
        <p>
          Don't have an account?{" "}
          <Link to="/register" className="signup-link">
            Create an account
          </Link>
        </p>
      </div>

      {/* Passcode alternative */}
      <div className="quick-access-link">
        <Link to="/passcode">Use Quick Access Passcode</Link>
      </div>
    </div>
  );
}

export default LoginForm;
