// src/components/admin/AdminPanel.jsx - updated to include ChatbotTabContent
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/apiService";
import CRMTabContent from "./CRMTabContent";
import ChatbotTabContent from "./ChatbotTabContent"; // Import ChatbotTabContent component
import "./CRMTab.css";
import "./ChatbotTabContent.css"; // Make sure to import the CSS
import "../crm/CRMDashboard.css";
import "../crm/ImportContacts.css";
import {
  User,
  Users,
  Settings,
  MessageSquare,
  Sliders,
  CreditCard,
  Shield,
  Database,
  BarChart,
  UserPlus,
  Trash2,
  Bell,
  ArrowRight,
  BarChart4,
  AlertCircle,
  Clock,
  Loader,
  Save,
  Key,
  Trash,
  Globe,
  Smartphone,
} from "lucide-react";
import CRMContactLookup from "../crm/CRMContactLookup";
import "./Admin.css";
import ThemeCustomizer from "../ThemeCustomizer";

const AdminPanel = () => {
  const { currentUser, isAdmin, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    filesProcessed: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  // We'll maintain a basic list of themes
  const [availableThemes, setAvailableThemes] = useState([
    { id: "default", name: "Default", description: "Default system theme" },
    { id: "dark", name: "Dark Mode", description: "Dark interface theme" },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Professional enterprise theme",
    },
  ]);
  const [currentTheme, setCurrentTheme] = useState("default");

  const navigate = useNavigate();

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      if (!isAdmin) {
        navigate("/");
        return;
      }

      try {
        setIsLoading(true);

        // Fetch current user profile (we'll use the currentUser for now)
        setUserProfile(
          currentUser || {
            name: "Admin User",
            email: "admin@tatt2away.com",
            role: "admin",
          }
        );

        // Fetch admin stats (in a real app, this would be an API call)
        const statsData = {
          totalUsers: 25,
          activeUsers: 18,
          totalMessages: 1248,
          filesProcessed: 352,
          averageResponseTime: 0.8,
          lastUpdateTime: new Date().toISOString(),
        };

        setStats(statsData);

        // Fetch recent users (in a real app, this would be an API call)
        const usersData = [
          {
            id: 1,
            name: "John Doe",
            email: "john@tatt2away.com",
            role: "admin",
            lastActive: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 2,
            name: "Jane Smith",
            email: "jane@tatt2away.com",
            role: "user",
            lastActive: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: 3,
            name: "Mike Johnson",
            email: "mike@tatt2away.com",
            role: "user",
            lastActive: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 4,
            name: "Sarah Williams",
            email: "sarah@tatt2away.com",
            role: "user",
            lastActive: new Date(Date.now() - 172800000).toISOString(),
          },
          {
            id: 5,
            name: "Robert Brown",
            email: "robert@tatt2away.com",
            role: "user",
            lastActive: new Date(Date.now() - 259200000).toISOString(),
          },
        ];

        setRecentUsers(usersData);
      } catch (err) {
        console.error("Error loading admin data:", err);
        setError("Failed to load admin data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, [isAdmin, navigate, currentUser]);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 60) {
      return `${diffMin} minutes ago`;
    } else if (diffMin < 1440) {
      return `${Math.floor(diffMin / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMin / 1440)} days ago`;
    }
  };

  // Handle theme change
  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    // In a real app, this would make an API call to save the preference
    localStorage.setItem("preferredTheme", themeId);
  };

  // If user is not an admin, show unauthorized message
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
      <h1>Admin Panel</h1>

      {/* Admin navigation */}
      <nav className="admin-nav">
        <div
          className={`admin-nav-item ${
            activeTab === "dashboard" ? "active" : ""
          }`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </div>
        <div
          className={`admin-nav-item ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </div>
        <div
          className={`admin-nav-item ${
            activeTab === "profile" ? "active" : ""
          }`}
          onClick={() => setActiveTab("profile")}
        >
          My Profile
        </div>
        <div
          className={`admin-nav-item ${activeTab === "crm" ? "active" : ""}`}
          onClick={() => setActiveTab("crm")}
        >
          CRM
        </div>
        <div
          className={`admin-nav-item ${
            activeTab === "chatbot" ? "active" : ""
          }`}
          onClick={() => setActiveTab("chatbot")}
        >
          Chatbot
        </div>
        <div
          className={`admin-nav-item ${activeTab === "themes" ? "active" : ""}`}
          onClick={() => setActiveTab("themes")}
        >
          Themes
        </div>
        <div
          className={`admin-nav-item ${
            activeTab === "settings" ? "active" : ""
          }`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </div>
      </nav>

      {/* Error message */}
      {error && (
        <div className="error-alert">
          <AlertCircle />
          <p>{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="admin-loading">
          <Loader className="spinner" />
          <p>Loading admin data...</p>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="admin-dashboard">
              {/* Stats section */}
              <div className="admin-section">
                <h2 className="admin-section-title">System Overview</h2>

                <div className="admin-stats">
                  <div className="stat-card">
                    <div className="stat-title">Total Users</div>
                    <div className="stat-value">{stats.totalUsers}</div>
                    <div className="stat-change positive">↑ 12%</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-title">Active Users</div>
                    <div className="stat-value">{stats.activeUsers}</div>
                    <div className="stat-change positive">↑ 8%</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-title">Total Messages</div>
                    <div className="stat-value">{stats.totalMessages}</div>
                    <div className="stat-change positive">↑ 24%</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-title">Files Processed</div>
                    <div className="stat-value">{stats.filesProcessed}</div>
                    <div className="stat-change positive">↑ 15%</div>
                  </div>
                </div>
              </div>

              {/* Analytics preview section (conditionally rendered based on tier) */}
              {isFeatureEnabled("analytics_basic") && (
                <div className="admin-section">
                  <h2 className="admin-section-title">Analytics Preview</h2>
                  <div className="analytics-preview">
                    <div className="analytics-chart-placeholder">
                      <BarChart4 size={48} />
                      <p>Usage statistics chart would appear here</p>
                    </div>
                    <div className="analytics-summary">
                      <p>
                        Average response time:{" "}
                        <strong>{stats.averageResponseTime}s</strong>
                      </p>
                      <p>
                        Last updated:{" "}
                        <strong>{formatDate(stats.lastUpdateTime)}</strong>
                      </p>
                    </div>
                    <Link to="/analytics" className="view-analytics-button">
                      View Full Analytics Dashboard
                    </Link>
                  </div>
                </div>
              )}

              {/* Quick actions section */}
              <div className="admin-section">
                <h2 className="admin-section-title">Quick Actions</h2>

                <div className="admin-actions">
                  <Link to="/admin/register" className="admin-button">
                    <UserPlus size={18} />
                    Register New User
                  </Link>

                  <Link to="/chat" className="admin-button">
                    <MessageSquare size={18} />
                    Open Chatbot
                  </Link>

                  <Link to="/admin/permissions" className="admin-button">
                    <Shield size={18} />
                    Manage File Permissions
                  </Link>
                </div>
              </div>

              {/* Recent users section */}
              <div className="admin-section">
                <h2 className="admin-section-title">Recent Users</h2>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Last Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className={`user-badge ${
                              user.role === "admin" ? "admin-badge" : ""
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>{formatDate(user.lastActive)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="action-button edit-button">
                              <Settings size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="view-all-link">
                  <Link to="/admin/users">
                    View All Users <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="admin-users">
              <div className="admin-section">
                <h2 className="admin-section-title">User Management</h2>

                <div className="admin-actions">
                  <Link to="/admin/register" className="action-button">
                    <UserPlus size={18} />
                    Register New User
                  </Link>
                </div>

                <div className="users-list-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <span
                              className={`user-badge ${
                                user.role === "admin" ? "admin-badge" : ""
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className="user-status active">Active</span>
                          </td>
                          <td>{formatDate(user.lastActive)}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="action-button edit-button">
                                <Settings size={14} title="Edit User" />
                              </button>
                              <button className="action-button reset-password-button">
                                <Key size={14} title="Reset Password" />
                              </button>
                              {user.role !== "admin" && (
                                <button className="action-button delete-button">
                                  <Trash2 size={14} title="Delete User" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && userProfile && (
            <div className="admin-profile">
              <div className="admin-section">
                <h2 className="admin-section-title">My Profile</h2>

                <div className="profile-details">
                  <div className="profile-avatar">
                    {userProfile.name?.charAt(0) || "U"}
                  </div>

                  <div className="profile-info">
                    <form className="profile-form">
                      <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          defaultValue={userProfile.name}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          defaultValue={userProfile.email}
                          className="form-input"
                          disabled
                        />
                        <p className="input-help">
                          Email address cannot be changed
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="role">Role</label>
                        <input
                          type="text"
                          id="role"
                          name="role"
                          defaultValue={userProfile.role || "Admin"}
                          className="form-input"
                          disabled
                        />
                      </div>

                      <button type="submit" className="save-button">
                        Save Changes
                      </button>
                    </form>
                  </div>
                </div>

                <div className="profile-security">
                  <h3>Security Settings</h3>

                  <div className="security-options">
                    <Link to="/security" className="security-option">
                      <Shield size={18} />
                      <span>Change Password</span>
                    </Link>

                    <Link to="/sessions" className="security-option">
                      <Globe size={18} />
                      <span>Manage Active Sessions</span>
                    </Link>

                    <Link to="/security" className="security-option">
                      <Smartphone size={18} />
                      <span>Two-Factor Authentication</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM Tab */}
          {activeTab === "crm" && <CRMTabContent />}

          {/* Chatbot Tab - Use the new ChatbotTabContent component */}
          {activeTab === "chatbot" && (
            <div className="admin-section">
              <h2 className="admin-section-title">Chatbot Management</h2>
              <ChatbotTabContent />
            </div>
          )}

          {/* Themes Tab */}
          {activeTab === "themes" && (
            <div className="admin-themes">
              <div className="admin-section">
                <h2 className="admin-section-title">Theme Management</h2>

                <div className="crm-section">
                  <h3>Select Theme</h3>
                  <p>Choose a theme for your Tatt2Away AI interface.</p>

                  <div className="themes-grid">
                    {availableThemes.map((theme) => (
                      <div
                        key={theme.id}
                        className={`theme-card ${
                          theme.id === currentTheme ? "active" : ""
                        }`}
                        onClick={() => handleThemeChange(theme.id)}
                      >
                        <div className="theme-info">
                          <h4>{theme.name}</h4>
                          <p>{theme.description}</p>
                          {theme.id === currentTheme && (
                            <span className="current-theme-badge">Current</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isFeatureEnabled("custom_branding") && (
                  <div className="crm-section">
                    <h3>Custom Branding</h3>
                    <p>
                      Customize your theme colors and branding (available on
                      Professional and Enterprise tiers).
                    </p>

                    <div className="form-group">
                      <label>Primary Color</label>
                      <input
                        type="color"
                        defaultValue="#4f46e5"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Secondary Color</label>
                      <input
                        type="color"
                        defaultValue="#10b981"
                        className="form-input"
                      />
                    </div>

                    <button className="save-button">Save Theme</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="admin-settings">
              <div className="admin-section">
                <h2 className="admin-section-title">System Settings</h2>

                <div className="settings-grid">
                  <div className="settings-card">
                    <div className="settings-header">
                      <Sliders size={20} />
                      <h3>General Settings</h3>
                    </div>

                    <form className="settings-form">
                      <div className="form-group">
                        <label htmlFor="site-name">Site Name</label>
                        <input
                          type="text"
                          id="site-name"
                          defaultValue="Tatt2Away AI Assistant"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="timezone">Timezone</label>
                        <select
                          id="timezone"
                          className="form-select"
                          defaultValue="America/New_York"
                        >
                          <option value="America/New_York">
                            Eastern Time (ET)
                          </option>
                          <option value="America/Chicago">
                            Central Time (CT)
                          </option>
                          <option value="America/Denver">
                            Mountain Time (MT)
                          </option>
                          <option value="America/Los_Angeles">
                            Pacific Time (PT)
                          </option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>File Upload Settings</label>
                        <div className="input-group">
                          <label htmlFor="max-file-size">
                            Max File Size (MB)
                          </label>
                          <input
                            type="number"
                            id="max-file-size"
                            defaultValue={10}
                            min={1}
                            max={50}
                            className="form-input"
                          />
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="settings-card">
                    <div className="settings-header">
                      <Shield size={20} />
                      <h3>Security Settings</h3>
                    </div>

                    <form className="settings-form">
                      <div className="form-group">
                        <label htmlFor="session-timeout">
                          Session Timeout (minutes)
                        </label>
                        <input
                          type="number"
                          id="session-timeout"
                          defaultValue={60}
                          min={15}
                          max={1440}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Security Policies</label>
                        <div className="checkbox-group">
                          <label className="checkbox-label">
                            <input type="checkbox" defaultChecked={true} />
                            Require Strong Passwords
                          </label>

                          <label className="checkbox-label">
                            <input type="checkbox" defaultChecked={true} />
                            Password Expiry (90 days)
                          </label>

                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              defaultChecked={isFeatureEnabled(
                                "advanced_security"
                              )}
                            />
                            Force MFA for all users
                          </label>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="settings-card">
                    <div className="settings-header">
                      <Database size={20} />
                      <h3>Storage Settings</h3>
                    </div>

                    <form className="settings-form">
                      <div className="form-group">
                        <label htmlFor="storage-path">
                          Default Storage Path
                        </label>
                        <input
                          type="text"
                          id="storage-path"
                          defaultValue="/data/uploads"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="storage-quota">
                          Storage Quota (GB)
                        </label>
                        <input
                          type="number"
                          id="storage-quota"
                          defaultValue={50}
                          min={1}
                          className="form-input"
                        />
                      </div>
                    </form>
                  </div>
                </div>

                <div className="admin-actions">
                  <button type="button" className="admin-button">
                    Save All Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPanel;
