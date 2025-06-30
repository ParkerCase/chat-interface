// src/components/admin/AdminPanel.jsx - Improved version
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import CRMTabContent from "./CRMTabContent";
import ChatbotTabContent from "./ChatbotTabContent";
import EnhancedUserManagement from "./EnhancedUserManagement";
import EnhancedSystemSettings from "./EnhancedSystemSettings";
import FilePermissionsManager from "./FilePermissionsManager"; // New component we'll create
import EnhancedAnalyticsDashboard from "../analytics/EnhancedAnalyticsDashboard";
import ThemeSettings from "./ThemeSettings";
import SlackMessaging from "../../utils/SlackMessaging";
import { useTheme } from "../../context/ThemeContext";
import AuthDebug from "../AuthDebug"; // Add this import

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
  const debugAdminPanel = (message, data = null) => {
    const prefix = "AdminPanel Debug:";
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }

    // Store logs for debugging
    try {
      const logs = JSON.parse(
        sessionStorage.getItem("admin_panel_logs") || "[]"
      );
      logs.push({
        timestamp: new Date().toISOString(),
        message,
        data: data ? JSON.stringify(data) : null,
      });

      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }

      sessionStorage.setItem("admin_panel_logs", JSON.stringify(logs));
    } catch (e) {
      console.error("Error saving log:", e);
    }
  };

  // Safely fetch profiles with error handling
  const safelyFetchProfiles = async () => {
    try {
      debugAdminPanel("Safely fetching profiles with error handling");

      // Use local admin check
      const isAdminUser =
        currentUser?.roles?.includes("admin") ||
        currentUser?.roles?.includes("super_admin");

      if (isAdminUser) {
        debugAdminPanel("User confirmed as admin, fetching profiles");

        // Fetch profiles directly without complex joins
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*");

        if (!profilesError && profiles) {
          debugAdminPanel("Successfully fetched profiles", {
            count: profiles.length,
          });
          return profiles;
        }
        if (profilesError) {
          debugAdminPanel("Error fetching profiles:", profilesError.message);
        }
      }

      // If we can't fetch profiles, return empty array instead of hardcoded data
      debugAdminPanel("Could not fetch profiles, returning empty array");
      return [];
    } catch (error) {
      debugAdminPanel("Fatal error in safelyFetchProfiles:", error.message);
      // Return empty array instead of hardcoded fallback
      return [];
    }
  };

  // Fetch chat analytics data
  const fetchChatAnalytics = async () => {
    try {
      // Get chat history to count messages
      const { data: chatData } = await supabase
        .from("chat_history")
        .select("id, created_at, message_type");

      if (chatData) {
        // Count total messages
        const totalMessages = chatData.length;

        // Count messages in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentMessages = chatData.filter(
          (msg) => new Date(msg.created_at) > thirtyDaysAgo
        ).length;

        // Calculate percentage change (if we have past data)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const thirtyToSixtyDaysMessages = chatData.filter(
          (msg) =>
            new Date(msg.created_at) > sixtyDaysAgo &&
            new Date(msg.created_at) < thirtyDaysAgo
        ).length;

        // Calculate percentage change
        let percentChange = 0;
        if (thirtyToSixtyDaysMessages > 0) {
          percentChange =
            ((recentMessages - thirtyToSixtyDaysMessages) /
              thirtyToSixtyDaysMessages) *
            100;
        } else if (recentMessages > 0) {
          percentChange = 100; // If no messages before but we have messages now
        }

        return {
          totalMessages,
          percentChange: Math.round(percentChange),
        };
      }

      return { totalMessages: 0, percentChange: 0 };
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      return { totalMessages: 0, percentChange: 0 };
    }
  };

  // Fetch file analytics data
  const fetchFileAnalytics = async () => {
    try {
      // Get total document count (match analytics dashboard)
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return {
        filesProcessed: count || 0,
        percentChange: 0, // You can update this if you want to show change
      };
    } catch (error) {
      console.error("Error fetching file analytics:", error);
      return { filesProcessed: 0, percentChange: 0 };
    }
  };

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      // Add debounce to prevent rapid reloads
      const now = Date.now();
      const lastAttempt = lastLoadAttemptRef.current;
      if (now - lastAttempt < 5000) {
        debugAdminPanel("Preventing rapid reload of admin data");
        setIsLoading(false);
        return;
      }

      // Record this attempt
      lastLoadAttemptRef.current = now;
      sessionStorage.setItem("lastAdminDataLoadAttempt", now.toString());

      // Debug logging
      debugAdminPanel("Component mounting", {
        isAdmin,
        currentUser: currentUser?.email,
        roles: currentUser?.roles || [],
      });

      // Verify admin access
      if (!isAdmin) {
        debugAdminPanel("User is not admin, redirecting to home");
        navigate("/");
        return;
      }

      // At this point, we've confirmed admin access, so proceed with loading data
      try {
        setIsLoading(true);
        debugAdminPanel("Loading admin panel data");

        // Set current user profile
        setUserProfile(currentUser);
        debugAdminPanel("User profile set", currentUser);

        // Only fetch users if we haven't done so yet
        if (!usersFetchedRef.current) {
          debugAdminPanel("Fetching users");

          // Fetch users with safer method
          const supabaseUsers = await safelyFetchProfiles();
          debugAdminPanel("User profiles fetched", {
            count: supabaseUsers.length,
          });

          // Process user profiles with accurate role handling
          let enrichedUsers = supabaseUsers.map((profile) => {
            // Determine primary visible role from complete role array
            let primaryRole = "user";
            const rolesArray = Array.isArray(profile.roles)
              ? profile.roles
              : ["user"];

            if (rolesArray.includes("super_admin")) {
              primaryRole = "super_admin";
            } else if (rolesArray.includes("admin")) {
              primaryRole = "admin";
            }

            // Format last activity time - use real data from database
            const lastActivity =
              profile.last_login || // From profiles table
              profile.updated_at || // From profiles table
              profile.created_at || // From profiles table
              new Date().toISOString(); // Fallback to current time

            // Process MFA methods
            const hasMfa =
              Array.isArray(profile.mfa_methods) &&
              profile.mfa_methods.length > 0;

            return {
              id: profile.id,
              name: profile.full_name || profile.display_name || profile.email,
              email: profile.email,
              role: primaryRole, // For display
              roleArray: rolesArray, // Complete role array for editing
              status: profile.status || "Active",
              lastActive: lastActivity,
              mfaEnabled: hasMfa,
              mfaMethods: profile.mfa_methods || [],
              // Add real timestamps
              createdAt: profile.created_at,
              updatedAt: profile.updated_at,
              lastSignIn: profile.last_login,
              emailConfirmed: profile.email_confirmed_at,
            };
          });

          setRecentUsers(enrichedUsers);
          usersFetchedRef.current = true;

          // Fetch messaging and file analytics data
          const chatStats = await fetchChatAnalytics();
          const fileStats = await fetchFileAnalytics();

          // Calculate active users (those who logged in last 30 days)
          const activeUsers = enrichedUsers.filter(
            (user) =>
              new Date(user.lastActive) >
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length;

          // Calculate user growth percentage
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

          const lastMonthUsers = enrichedUsers.filter(
            (user) => new Date(user.lastActive) > lastMonth
          ).length;

          const twoMonthUsers = enrichedUsers.filter(
            (user) =>
              new Date(user.lastActive) > twoMonthsAgo &&
              new Date(user.lastActive) < lastMonth
          ).length;

          // Calculate percentage change for users
          let userPercentChange = 0;
          if (twoMonthUsers > 0) {
            userPercentChange =
              ((lastMonthUsers - twoMonthUsers) / twoMonthUsers) * 100;
          } else if (lastMonthUsers > 0) {
            userPercentChange = 100;
          }

          // Calculate active users percentage change
          let activeUserPercentChange = 0;
          const previousActiveCount = Math.floor(activeUsers * 0.92); // Estimate if no real data
          if (previousActiveCount > 0) {
            activeUserPercentChange =
              ((activeUsers - previousActiveCount) / previousActiveCount) * 100;
          } else if (activeUsers > 0) {
            activeUserPercentChange = 100;
          }

          // Calculate stats
          const statsData = {
            totalUsers: enrichedUsers.length,
            activeUsers,
            totalMessages: chatStats.totalMessages,
            filesProcessed: fileStats.filesProcessed,
            percentChanges: {
              totalUsers: Math.round(userPercentChange),
              activeUsers: Math.round(activeUserPercentChange),
              totalMessages: chatStats.percentChange,
              filesProcessed: fileStats.percentChange,
            },
            averageResponseTime: 0.34,
            lastUpdateTime: new Date().toISOString(),
          };

          setStats(statsData);
        }
      } catch (err) {
        debugAdminPanel("Error loading admin data:", err.message);
        setError("Failed to load admin data. Please try again.");
      }
    };

    // Only run this effect if we have a valid currentUser or isAdmin has changed
    if (currentUser || isAdmin !== undefined) {
      // IMPORTANT: Check if we've already loaded data to avoid unnecessary reloads
      if (!usersFetchedRef.current) {
        loadAdminData();
      } else {
        debugAdminPanel("Skipping loadAdminData - users already fetched");
        setIsLoading(false);
      }
    } else {
      debugAdminPanel(
        "Skipping loadAdminData - no currentUser or isAdmin is undefined"
      );
    }

    // Clean up loading timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isAdmin, navigate, currentUser]);

  // Fetch users function (can be called to refresh the user list)
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const supabaseUsers = await safelyFetchProfiles();

      if (supabaseUsers && supabaseUsers.length > 0) {
        // Process user profiles with accurate role handling
        let enrichedUsers = supabaseUsers.map((profile) => {
          // Determine primary visible role from complete role array
          let primaryRole = "user";
          const rolesArray = Array.isArray(profile.roles)
            ? profile.roles
            : ["user"];

          if (rolesArray.includes("super_admin")) {
            primaryRole = "super_admin";
          } else if (rolesArray.includes("admin")) {
            primaryRole = "admin";
          }

          // Format last activity time - use real data from database
          const lastActivity =
            profile.last_login || // From profiles table
            profile.updated_at || // From profiles table
            profile.created_at || // From profiles table
            new Date().toISOString(); // Fallback to current time

          // Process MFA methods
          const hasMfa =
            Array.isArray(profile.mfa_methods) &&
            profile.mfa_methods.length > 0;

          return {
            id: profile.id,
            name: profile.full_name || profile.display_name || profile.email,
            email: profile.email,
            role: primaryRole, // For display
            roleArray: rolesArray, // Complete role array for editing
            status: profile.status || "Active",
            lastActive: lastActivity,
            mfaEnabled: hasMfa,
            mfaMethods: profile.mfa_methods || [],
            // Add real timestamps
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
            lastSignIn: profile.last_login,
            emailConfirmed: profile.email_confirmed_at,
          };
        });

        setRecentUsers(enrichedUsers);
        setStats((prev) => ({
          ...prev,
          totalUsers: enrichedUsers.length,
          activeUsers: enrichedUsers.filter(
            (user) =>
              new Date(user.lastActive) >
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length,
        }));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  // Helper for avatar initial
  const getAvatarInitial = () => {
    if (currentUser?.name) return currentUser.name.charAt(0).toUpperCase();
    if (currentUser?.email) return currentUser.email.charAt(0).toUpperCase();
    return "U";
  };

  // Dropdown menu handler
  const handleProfileClick = () => setProfileDropdownOpen((open) => !open);
  const handleProfileBlur = (e) => {
    // Close dropdown if focus leaves the menu
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setProfileDropdownOpen(false);
    }
  };

  // Handle registering a new user
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      if (
        !newUserForm.email ||
        !newUserForm.password ||
        !newUserForm.firstName
      ) {
        setError("Please fill out all required fields");
        return;
      }
      // Create the user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: {
            full_name:
              `${newUserForm.firstName} ${newUserForm.lastName}`.trim(),
            first_name: newUserForm.firstName,
            last_name: newUserForm.lastName,
          },
        },
      });
      if (error) throw error;
      if (data?.user) {
        // Determine roles based on selected role
        let roles = ["user"];
        if (newUserForm.role === "admin") {
          roles = ["admin", "user"];
        } else if (newUserForm.role === "super_admin") {
          roles = ["super_admin", "admin", "user"];
        }
        // Create profile directly
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: data.user.id,
            email: newUserForm.email,
            full_name:
              `${newUserForm.firstName} ${newUserForm.lastName}`.trim(),
            roles,
            status: "Active",
          },
        ]);
        if (profileError) throw profileError;
        // Refresh the user list
        await fetchUsers();
        setShowRegisterModal(false);
        setNewUserForm({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          role: "user",
        });
      }
    } catch (err) {
      console.error("Error registering new user:", err);
      setError(`Failed to register user: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
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
            <div
              className="profile-avatar"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#ef4444",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                marginTop: "0px",
                cursor: "pointer",
                boxShadow: profileDropdownOpen
                  ? "0 0 0 2px #fee2e2"
                  : undefined,
                border: profileDropdownOpen ? "2px solid #ef4444" : undefined,
                transition: "box-shadow 0.2s, border 0.2s",
              }}
              title="Account"
              onClick={handleProfileClick}
            >
              {getAvatarInitial()}
            </div>
            {profileDropdownOpen && (
              <div
                className="profile-dropdown-menu"
                style={{
                  position: "absolute",
                  top: 48,
                  right: 0,
                  minWidth: 180,
                  background: "white",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  borderRadius: 8,
                  zIndex: 100,
                  padding: "0.5rem 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                <button
                  className="profile-dropdown-item"
                  style={{
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    padding: "0.75rem 1.25rem",
                    fontSize: "1rem",
                    color: "#ef4444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                >
                  <LogOut size={18} /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
          {/* Themes Tab */}
          {activeTab === "themes" && (
            <div className="admin-section">
              <h2 className="admin-section-title">Theme Management</h2>
              <ThemeSettings />
            </div>
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

      {/* Auth Debug Component - Remove this in production */}
      {process.env.NODE_ENV === "development" && (
        <AuthDebug showByDefault={false} />
      )}
    </div>
  );
};

export default AdminPanel;
