// src/components/admin/Register.jsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { AlertCircle, UserPlus } from "lucide-react";
import "./Admin.css";

function Register() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(""); // Optional, will be auto-generated if empty
  const [roles, setRoles] = useState(["user"]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const { register, error: authError, isAdmin } = useAuth();
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess(null);

    // Validate admin permission
    if (!isAdmin) {
      setFormError("You need administrator privileges to register new users");
      return;
    }

    // Validate email
    if (!email) {
      setFormError("Email is required");
      return;
    }

    // Validate email domain
    if (!email.endsWith("@tatt2away.com")) {
      setFormError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    // Validate name
    if (!name) {
      setFormError("Name is required");
      return;
    }

    try {
      setIsLoading(true);
      const result = await register({
        email,
        name,
        password: password || undefined, // Let server generate if empty
        roles,
      });

      if (result && result.success) {
        setSuccess(result);
        // Reset form
        setEmail("");
        setName("");
        setPassword("");
        setRoles(["user"]);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Registration error:", error);
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
  if (!isAdmin) {
    return (
      <div className="unauthorized-message">
        <AlertCircle />
        <h3>Admin Access Required</h3>
        <p>You need administrator privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-card">
        <div className="card-header">
          <UserPlus className="icon" />
          <h2>Register New User</h2>
        </div>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle />
            <p>{formError || authError}</p>
          </div>
        )}

        {/* Display success message */}
        {success && (
          <div className="success-alert">
            <div>
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
                  <p className="password">{success.credentials.password}</p>
                  <p className="password-note">
                    Make sure to save this! It won't be shown again.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

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
            <p className="input-hint">Must be a @tatt2away.com email address</p>
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
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="input-hint">
              If left blank, a secure password will be generated
            </p>
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

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={roles.includes("admin")}
                  onChange={() => handleRoleChange("admin")}
                  disabled={isLoading}
                />
                Admin (Full Access)
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="admin-button"
            disabled={isLoading || !email || !name}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Creating User...
              </>
            ) : (
              "Create User"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;
