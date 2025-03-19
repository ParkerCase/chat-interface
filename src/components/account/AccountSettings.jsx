// src/components/account/AccountSettings.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Shield,
  Key,
  LogOut,
  Save,
  AlertCircle,
  CheckCircle,
  Devices,
  UserCog,
} from "lucide-react";
import MfaSetup from "./MfaSetup";
import SessionManagement from "./SessionManagement";
import PasswordChange from "./PasswordChange";
import "./AccountSettings.css";

function AccountSettings() {
  const { currentUser, updateProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Initialize form data when user data is available
  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || "",
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
      });
    }
  }, [currentUser]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      setIsLoading(true);

      const success = await updateProfile({
        name: formData.name,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (success) {
        setSuccessMessage("Profile updated successfully");
      }
    } catch (error) {
      setError("Failed to update profile. Please try again.");
      console.error("Profile update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!currentUser) {
    return (
      <div className="account-loading">
        <div className="spinner"></div>
        <p>Loading account information...</p>
      </div>
    );
  }

  return (
    <div className="account-settings-container">
      <div className="account-settings-header">
        <div className="account-info">
          <div className="account-avatar">
            <User size={28} />
          </div>
          <div className="account-details">
            <h2>{currentUser.name}</h2>
            <p>{currentUser.email}</p>
          </div>
        </div>

        <button onClick={handleLogout} className="logout-button">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="account-settings-content">
        <div className="account-tabs">
          <button
            className={`account-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <UserCog size={20} />
            <span>Profile</span>
          </button>

          <button
            className={`account-tab ${
              activeTab === "security" ? "active" : ""
            }`}
            onClick={() => setActiveTab("security")}
          >
            <Key size={20} />
            <span>Password</span>
          </button>

          <button
            className={`account-tab ${activeTab === "mfa" ? "active" : ""}`}
            onClick={() => setActiveTab("mfa")}
          >
            <Shield size={20} />
            <span>Two-Factor Authentication</span>
          </button>

          <button
            className={`account-tab ${
              activeTab === "sessions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("sessions")}
          >
            <Devices size={20} />
            <span>Active Sessions</span>
          </button>
        </div>

        <div className="account-tab-content">
          {/* Success Message */}
          {successMessage && (
            <div className="success-message">
              <CheckCircle size={18} />
              <p>{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="profile-settings">
              <h3>Profile Information</h3>
              <p className="tab-description">
                Update your personal information
              </p>

              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    className="form-input"
                    disabled
                  />
                  <p className="input-help">Email address cannot be changed</p>
                </div>

                <button
                  type="submit"
                  className="save-button"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-sm"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === "security" && (
            <PasswordChange
              setError={setError}
              setSuccessMessage={setSuccessMessage}
            />
          )}

          {/* MFA Tab */}
          {activeTab === "mfa" && (
            <MfaSetup
              setError={setError}
              setSuccessMessage={setSuccessMessage}
            />
          )}

          {/* Sessions Tab */}
          {activeTab === "sessions" && (
            <SessionManagement
              setError={setError}
              setSuccessMessage={setSuccessMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
