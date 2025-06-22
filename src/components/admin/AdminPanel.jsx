// src/components/admin/AdminPanel.jsx - Improved version
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import SlackMessaging from "../../utils/SlackMessaging";
import { useTheme } from "../../context/ThemeContext";
import { supabase } from "../../lib/supabase";

import "./Admin.css";
import "./CRMTab.css";
import "./ChatbotTabContent.css";
import "../crm/CRMDashboard.css";
import "../crm/ImportContacts.css";

import {
  User,
  Users,
  Settings,
  MessageSquare,
  MessageCircle,
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
  CheckCircle,
  X,
  Mail,
  RefreshCw,
  Edit,
  Lock,
  Unlock,
  ToggleLeft,
  ToggleRight,
  FileText,
  LogOut,
} from "lucide-react";

const CRMTabContent = lazy(() => import("./CRMTabContent"));
const ChatbotTabContent = lazy(() => import("./ChatbotTabContent"));
const EnhancedUserManagement = lazy(() => import("./EnhancedUserManagement"));
const EnhancedSystemSettings = lazy(() => import("./EnhancedSystemSettings"));
const FilePermissionsManager = lazy(() => import("./FilePermissionsManager"));
const EnhancedAnalyticsDashboard = lazy(() =>
  import("../analytics/EnhancedAnalyticsDashboard")
);
const ThemeSettings = lazy(() => import("./ThemeSettings"));

const AdminPanel = () => {
  // Core state
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
    percentChanges: {
      totalUsers: 0,
      activeUsers: 0,
      totalMessages: 0,
      filesProcessed: 0,
    },
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
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
  const [unreadCount, setUnreadCount] = useState(0);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "user",
  });

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Refs
  const lastLoadAttemptRef = useRef(0);
  const loadingTimeoutRef = useRef(null);
  const usersFetchedRef = useRef(false);

  // Navigation
  const navigate = useNavigate();

  // Debug logging helper
  const debugAdminPanel = (message, data = "") => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[AdminPanel Debug] ${message}`, data);
    }
  };

  // Format date utility
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
  };

  const { setTheme } = useTheme();
  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    setTheme(themeId);
  };

  // Handle new user registration
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Logic to register user via API
      // await apiService.auth.register(newUserForm);
      setShowRegisterModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      // Prevent re-fetching if already loading or just tried
      if (Date.now() - lastLoadAttemptRef.current < 5000) return;
      lastLoadAttemptRef.current = Date.now();

      setIsLoading(true);
      setError(null);

      // Set a timeout to prevent infinite loading state
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoading) {
          setError(
            "Admin data is taking longer than expected to load. Please refresh."
          );
          setIsLoading(false);
        }
      }, 20000); // 20 seconds

      try {
        const [statsData, usersData] = await Promise.all([
          apiService.analytics.getAdminStats(),
          usersFetchedRef.current ? recentUsers : apiService.users.getUsers(),
        ]);

        if (statsData?.data) {
          setStats(statsData.data);
        }
        if (usersData?.data && !usersFetchedRef.current) {
          setRecentUsers(usersData.data.users);
          usersFetchedRef.current = true;
        }
      } catch (err) {
        console.error("Error loading admin data:", err);
        setError("Failed to load admin data. Please try again later.");
      } finally {
        clearTimeout(loadingTimeoutRef.current);
        setIsLoading(false);
      }
    };

    if (!currentUser) {
      // If no current user, check localStorage and try to authenticate
      const storedUserJson = localStorage.getItem("currentUser");
      if (storedUserJson) {
        try {
          const storedUser = JSON.parse(storedUserJson);
          if (
            storedUser.roles?.includes("admin") ||
            storedUser.roles?.includes("super_admin")
          ) {
            // Re-authenticate silently or set user context
            // This part depends on your auth context implementation
            loadAdminData();
          } else {
            navigate("/");
          }
        } catch (e) {
          navigate("/");
        }
      } else {
        navigate("/");
      }
    } else {
      // Verify admin rights before loading data
      if (!isAdmin) {
        debugAdminPanel(
          "User is not admin according to auth context, checking localStorage"
        );

        // Check localStorage as a fallback
        const storedUserJson = localStorage.getItem("currentUser");
        let hasAdminRole = false;

        if (storedUserJson) {
          try {
            const storedUser = JSON.parse(storedUserJson);
            hasAdminRole =
              storedUser.roles?.includes("admin") ||
              storedUser.roles?.includes("super_admin");

            debugAdminPanel("Admin check from localStorage:", hasAdminRole);
          } catch (e) {
            console.warn("Error parsing stored user:", e);
          }
        }

        // Only redirect if not admin in any form
        if (!hasAdminRole) {
          debugAdminPanel("Not an admin user, redirecting to home");
          navigate("/");
          return;
        }
      }

      // At this point, we've confirmed admin access, so proceed with loading data
      loadAdminData();
    }

    return () => clearTimeout(loadingTimeoutRef.current);
  }, [currentUser, isAdmin, navigate]);

  // Handle profile click
  const handleProfileClick = () => {
    setActiveTab("profile");
    if (currentUser && !userProfile) {
      setUserProfile({
        name:
          currentUser.name ||
          `${currentUser.firstName} ${currentUser.lastName}`,
        email: currentUser.email,
        role: currentUser.roles?.join(", ") || "User",
      });
    }
  };

  // User Management Tab Component
  const UserManagementTab = () => {
    // This wrapper component allows us to load the EnhancedUserManagement component
    // while passing necessary props from the parent AdminPanel

    if (activeTab !== "users") return null;

    return (
      <EnhancedUserManagement
        users={recentUsers}
        currentUser={currentUser}
        formatDate={formatDate}
        setError={setError}
        onRefreshUsers={(users) => {
          console.log(
            "Refreshed users from EnhancedUserManagement:",
            users.length
          );
          setRecentUsers(users);
        }}
      />
    );
  };

  // System Settings Tab Component
  const SystemSettingsTab = () => {
    // This wrapper component allows us to load the EnhancedSystemSettings component

    if (activeTab !== "settings") return null;

    return (
      <EnhancedSystemSettings currentUser={currentUser} isAdmin={isAdmin} />
    );
  };

  // Analytics Dashboard Tab Component
  const AnalyticsDashboardTab = () => {
    // This wrapper component allows us to load the EnhancedAnalyticsDashboard component

    if (activeTab !== "analytics") return null;

    return <EnhancedAnalyticsDashboard stats={stats} users={recentUsers} />;
  };

  // File Permissions Tab Component
  const FilePermissionsTab = () => {
    if (activeTab !== "permissions") return null;

    return <FilePermissionsManager currentUser={currentUser} />;
  };

  return (
    <div className="admin-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "2rem",
        }}
        className="admin-header"
      >
        <h1 style={{ margin: 0 }}>Admin Panel</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div className="message-icon">
            <Link to="/messages" title="Messages">
              <MessageCircle size={24} />
              {unreadCount > 0 && (
                <span className="unread-badge">{unreadCount}</span>
              )}
            </Link>
          </div>
          {/* Profile avatar and dropdown */}
          <div
            className="profile-dropdown"
            onMouseEnter={() => setProfileDropdownOpen(true)}
            onMouseLeave={() => setProfileDropdownOpen(false)}
            style={{ pointerEvents: "auto" }}
          >
            <div className="profile-avatar" onClick={handleProfileClick}>
              {currentUser?.name ? currentUser.name.charAt(0) : "A"}
            </div>
            {profileDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={handleProfileClick}>
                  <User size={16} /> My Profile
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => setActiveTab("settings")}
                >
                  <Settings size={16} /> Settings
                </div>
                <div className="dropdown-item" onClick={logout}>
                  <LogOut size={16} /> Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
            activeTab === "analytics" ? "active" : ""
          }`}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </div>
        {/* Show Permissions tab only for super_admin users */}
        {currentUser?.roles?.includes("super_admin") && (
          <div
            className={`admin-nav-item ${
              activeTab === "permissions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("permissions")}
          >
            File Permissions
          </div>
        )}
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
          <button className="dismiss-button" onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            margin: "25%",
          }}
          className="admin-loading"
        >
          <Loader className="spinner" />
          <p>Loading admin data...</p>
        </div>
      ) : (
        <>
          <Suspense
            fallback={
              <div className="admin-loading">
                <Loader className="spinner" />
                <p>Loading tab...</p>
              </div>
            }
          >
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
                      <div
                        className={`stat-change ${
                          stats.percentChanges.totalUsers >= 0
                            ? "positive"
                            : "negative"
                        }`}
                      >
                        {stats.percentChanges.totalUsers >= 0 ? "↑" : "↓"}{" "}
                        {Math.abs(stats.percentChanges.totalUsers)}%
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-title">Active Users</div>
                      <div className="stat-value">{stats.activeUsers}</div>
                      <div
                        className={`stat-change ${
                          stats.percentChanges.activeUsers >= 0
                            ? "positive"
                            : "negative"
                        }`}
                      >
                        {stats.percentChanges.activeUsers >= 0 ? "↑" : "↓"}{" "}
                        {Math.abs(stats.percentChanges.activeUsers)}%
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-title">Total Messages</div>
                      <div className="stat-value">{stats.totalMessages}</div>
                      <div
                        className={`stat-change ${
                          stats.percentChanges.totalMessages >= 0
                            ? "positive"
                            : "negative"
                        }`}
                      >
                        {stats.percentChanges.totalMessages >= 0 ? "↑" : "↓"}{" "}
                        {Math.abs(stats.percentChanges.totalMessages)}%
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-title">All Records</div>
                      <div className="stat-value">
                        {stats.filesProcessed.toLocaleString()}
                      </div>
                      <div
                        className={`stat-change ${
                          stats.percentChanges.filesProcessed >= 0
                            ? "positive"
                            : "negative"
                        }`}
                      >
                        {stats.percentChanges.filesProcessed >= 0 ? "↑" : "↓"}{" "}
                        {Math.abs(stats.percentChanges.filesProcessed)}%
                      </div>
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
                      <button
                        className="view-analytics-button"
                        onClick={() => setActiveTab("analytics")}
                      >
                        View Full Analytics Dashboard
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick actions section */}
                <div className="admin-section">
                  <h2 className="admin-section-title">Quick Actions</h2>

                  <div className="admin-actions">
                    <button
                      className="admin-button"
                      onClick={() => setShowRegisterModal(true)}
                    >
                      <UserPlus size={18} />
                      Register New User
                    </button>

                    <button
                      className="admin-button"
                      onClick={() => setActiveTab("chatbot")}
                    >
                      <MessageSquare size={18} />
                      Open Chatbot
                    </button>

                    {currentUser?.roles?.includes("super_admin") && (
                      <button
                        className="admin-button"
                        onClick={() => setActiveTab("permissions")}
                      >
                        <Shield size={18} />
                        Manage File Permissions
                      </button>
                    )}
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
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: "white" }}>
                      {recentUsers.slice(0, 5).map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <span
                              className={`user-badge ${
                                user.role === "admin" ||
                                user.role === "super_admin"
                                  ? "admin-badge"
                                  : ""
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span>{formatDate(user.lastActive)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="view-all-link">
                    <button
                      className="view-all-button"
                      onClick={() => setActiveTab("users")}
                    >
                      View All Users <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && <UserManagementTab />}

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
                      <button
                        className="security-option"
                        onClick={() => navigate("/security")}
                      >
                        <Shield size={18} />
                        <span>Change Password</span>
                      </button>

                      <button
                        className="security-option"
                        onClick={() => navigate("/sessions")}
                      >
                        <Globe size={18} />
                        <span>Manage Active Sessions</span>
                      </button>

                      <button
                        className="security-option"
                        onClick={() => navigate("/security")}
                      >
                        <Smartphone size={18} />
                        <span>Two-Factor Authentication</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CRM Tab */}
            {activeTab === "crm" && <CRMTabContent />}

            {/* Chatbot Tab */}
            {activeTab === "chatbot" && (
              <div className="admin-section">
                <h2 className="admin-section-title">Chatbot Management</h2>
                <ChatbotTabContent />
              </div>
            )}

            {/* Themes Tab */}
            {activeTab === "themes" && (
              <ThemeSettings
                themes={availableThemes}
                currentTheme={currentTheme}
                onThemeChange={handleThemeChange}
              />
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && <SystemSettingsTab />}

            {/* Analytics Tab */}
            {activeTab === "analytics" && <AnalyticsDashboardTab />}

            {/* File Permissions Tab */}
            {activeTab === "permissions" &&
              currentUser?.roles?.includes("super_admin") && (
                <FilePermissionsTab />
              )}
          </Suspense>
        </>
      )}

      {/* Register New User Modal */}
      {showRegisterModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Register New User</h3>
              <button
                className="modal-close"
                onClick={() => setShowRegisterModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegisterUser}>
                <div className="form-group">
                  <label htmlFor="email">Email Address*</label>
                  <input
                    type="email"
                    id="email"
                    value={newUserForm.email}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, email: e.target.value })
                    }
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password*</label>
                  <input
                    type="password"
                    id="password"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        password: e.target.value,
                      })
                    }
                    className="form-input"
                    required
                    minLength="8"
                  />
                  <p className="input-help">Must be at least 8 characters</p>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name*</label>
                    <input
                      type="text"
                      id="firstName"
                      value={newUserForm.firstName}
                      onChange={(e) =>
                        setNewUserForm({
                          ...newUserForm,
                          firstName: e.target.value,
                        })
                      }
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      value={newUserForm.lastName}
                      onChange={(e) =>
                        setNewUserForm({
                          ...newUserForm,
                          lastName: e.target.value,
                        })
                      }
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, role: e.target.value })
                    }
                    className="form-select"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {currentUser?.roles?.includes("super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setShowRegisterModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader size={14} className="spinner" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        Register User
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
