// src/components/admin/Register.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  AlertCircle,
  UserPlus,
  CheckCircle,
  Key,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./Admin.css";

function Register() {
  // Form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(""); // Optional, will be auto-generated if empty
  const [roles, setRoles] = useState(["user"]);
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [formError, setFormError] = useState("");
  const [strengthChecks, setStrengthChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const navigate = useNavigate();
  const { currentUser, error: authError, isAdmin, isSuperAdmin } = useAuth();

  // Check if user can create admins (is super admin or test admin)
  const canCreateAdmin =
    currentUser?.roles?.includes("super_admin") ||
    currentUser?.email === "itsus@tatt2away.com";

  // Check password strength when it changes
  useEffect(() => {
    if (password) {
      setStrengthChecks({
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
      });
    }
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess(null);

    // Validate admin permission
    if (!isAdmin && !currentUser?.email === "itsus@tatt2away.com") {
      setFormError("You need administrator privileges to register new users");
      return;
    }

    // Validate email
    if (!email) {
      setFormError("Email is required");
      return;
    }

    // Validate email domain
    if (!email.endsWith("@tatt2away.com") && email !== "itsus@tatt2away.com") {
      setFormError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    // Validate name
    if (!name) {
      setFormError("Name is required");
      return;
    }

    // Ensure that only super admin can create admin users
    if (roles.includes("admin") && !canCreateAdmin) {
      setFormError("Only super administrators can create admin accounts");
      return;
    }

    // Super admin role can only be granted by another super admin and only to test user
    if (roles.includes("super_admin")) {
      if (!canCreateAdmin) {
        setFormError(
          "Only super administrators can create super admin accounts"
        );
        return;
      }

      if (email !== "itsus@tatt2away.com") {
        setFormError(
          "Super admin role can only be assigned to authorized accounts"
        );
        return;
      }
    }

    try {
      setIsLoading(true);

      // Generate a random password if none provided
      const generatedPassword =
        password ||
        Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2).toUpperCase() +
          "!" +
          Math.floor(Math.random() * 10);

      // Register user with Supabase
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

      if (error) throw error;

      // Create profile in Supabase
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          full_name: name,
          email,
          roles,
          tier: "enterprise",
          created_at: new Date().toISOString(),
          created_by: currentUser.id || currentUser.email,
        },
      ]);

      if (profileError) throw profileError;

      // Log the successful creation for audit purposes
      console.log(
        `User created: ${email} with roles ${roles.join(", ")} by ${
          currentUser.email
        }`
      );

      // Set success state with user and credentials
      setSuccess({
        user: {
          id: data.user.id,
          email,
          name,
          roles,
        },
        credentials: {
          password: password ? null : generatedPassword,
        },
      });

      // Reset form
      setEmail("");
      setName("");
      setPassword("");
      setRoles(["user"]);
    } catch (error) {
      console.error("Registration error:", error);
      setFormError(
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle role selection with checkboxes
  const handleRoleChange = (role) => {
    if (roles.includes(role)) {
      setRoles(roles.filter((r) => r !== role));
    } else {
      setRoles([...roles, role]);
    }
  };

  // Only show this component to admins
  if (!isAdmin && currentUser?.email !== "itsus@tatt2away.com") {
    return (
      <div className="unauthorized-message">
        <AlertCircle size={36} />
        <h3>Admin Access Required</h3>
        <p>You need administrator privileges to access this page.</p>
        <button onClick={() => navigate("/")} className="back-button">
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-card">
        <div className="card-header">
          <UserPlus className="icon" size={24} />
          <h2>Register New User</h2>
        </div>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{formError || authError}</p>
          </div>
        )}

        {/* Display success message */}
        {success && (
          <div className="success-alert">
            <div>
              <CheckCircle size={24} className="success-icon" />
              <h3>User Created Successfully!</h3>
              <p>
                <strong>Email:</strong> {success.user.email}
                <br />
                <strong>Name:</strong> {success.user.name}
                <br />
                <strong>Roles:</strong> {success.user.roles.join(", ")}
              </p>
              {success.credentials?.password && (
                <div className="credentials-box">
                  <h4>Temporary Password</h4>
                  <div className="password-display">
                    <code className="password">
                      {success.credentials.password}
                    </code>
                    <button
                      className="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          success.credentials.password
                        );
                        alert("Password copied to clipboard");
                      }}
                    >
                      <Key size={14} />
                      Copy
                    </button>
                  </div>
                  <p className="password-note">
                    <strong>Important:</strong> Make sure to save or share this
                    password securely. It won't be shown again.
                  </p>
                </div>
              )}
              <button
                className="create-another-button"
                onClick={() => setSuccess(null)}
              >
                Create Another User
              </button>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="admin-form">
            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@tatt2away.com"
                className="form-input"
                disabled={isLoading}
                required
              />
              <p className="input-hint">
                Must be a @tatt2away.com email address
              </p>
            </div>

            {/* Name Field */}
            <div className="form-group">
              <label htmlFor="name">
                Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="form-input"
                disabled={isLoading}
                required
              />
            </div>

            {/* Password Field (Optional) */}
            <div className="form-group">
              <label htmlFor="password">
                Password <span className="optional">(Optional)</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="form-input"
                  disabled={isLoading}
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
              <p className="input-hint">
                If left blank, a secure password will be generated
              </p>

              {password && (
                <div className="password-strength">
                  <div className="strength-item">
                    <span
                      className={
                        strengthChecks.length ? "check passed" : "check"
                      }
                    >
                      {strengthChecks.length ? "✓" : "✗"}
                    </span>
                    <span>At least 8 characters</span>
                  </div>
                  <div className="strength-item">
                    <span
                      className={
                        strengthChecks.uppercase ? "check passed" : "check"
                      }
                    >
                      {strengthChecks.uppercase ? "✓" : "✗"}
                    </span>
                    <span>Uppercase letter</span>
                  </div>
                  <div className="strength-item">
                    <span
                      className={
                        strengthChecks.lowercase ? "check passed" : "check"
                      }
                    >
                      {strengthChecks.lowercase ? "✓" : "✗"}
                    </span>
                    <span>Lowercase letter</span>
                  </div>
                  <div className="strength-item">
                    <span
                      className={
                        strengthChecks.number ? "check passed" : "check"
                      }
                    >
                      {strengthChecks.number ? "✓" : "✗"}
                    </span>
                    <span>Number</span>
                  </div>
                  <div className="strength-item">
                    <span
                      className={
                        strengthChecks.special ? "check passed" : "check"
                      }
                    >
                      {strengthChecks.special ? "✓" : "✗"}
                    </span>
                    <span>Special character</span>
                  </div>
                </div>
              )}
            </div>

            {/* Role Selection */}
            <div className="form-group">
              <label>User Roles</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={roles.includes("user")}
                    onChange={() => handleRoleChange("user")}
                    disabled={isLoading}
                  />
                  User (Basic Access)
                </label>

                <label
                  className={`checkbox-label ${
                    !canCreateAdmin ? "disabled" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={roles.includes("admin")}
                    onChange={() => handleRoleChange("admin")}
                    disabled={isLoading || !canCreateAdmin}
                  />
                  Admin (Management Access)
                  {!canCreateAdmin && (
                    <span className="role-restriction">(Super Admin only)</span>
                  )}
                </label>

                {canCreateAdmin && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={roles.includes("super_admin")}
                      onChange={() => handleRoleChange("super_admin")}
                      disabled={isLoading || email !== "itsus@tatt2away.com"}
                    />
                    Super Admin (Full System Access)
                    {email !== "itsus@tatt2away.com" && (
                      <span className="role-restriction">
                        (Restricted role)
                      </span>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="cancel-button"
                disabled={isLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="submit-button"
                disabled={isLoading || !email || !name}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Creating User...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Register;
