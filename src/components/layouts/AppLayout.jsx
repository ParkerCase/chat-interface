// src/components/layouts/AppLayout.jsx
import React, { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import ThemeCustomizer from "../ThemeCustomizer";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import {
  Menu,
  X,
  Home,
  User,
  Shield,
  Settings,
  Users,
  LogOut,
  Bell,
  BarChart4,
  Workflow,
  Cloud,
  MessageSquare,
} from "lucide-react";
import "./AppLayout.css";

/**
 * Main application layout with sidebar navigation
 */
const AppLayout = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { enterpriseEnabled } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  // Close sidebar when clicking outside on mobile
  const handleContentClick = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
    if (userMenuOpen) {
      setUserMenuOpen(false);
    }
  };

  // Is the current route active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <img src="/logo.png" alt="Tatt2Away Logo" className="sidebar-logo" />
          <button
            className="sidebar-close-button"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link
                to="/"
                className={isActive("/") ? "active" : ""}
                onClick={() => setSidebarOpen(false)}
              >
                <Home size={20} />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className={isActive("/profile") ? "active" : ""}
                onClick={() => setSidebarOpen(false)}
              >
                <User size={20} />
                <span>Profile</span>
              </Link>
            </li>

            <li>
              <Link
                to="/security"
                className={isActive("/security") ? "active" : ""}
                onClick={() => setSidebarOpen(false)}
              >
                <Shield size={20} />
                <span>Security</span>
              </Link>
            </li>
            <li>
              <Link
                to="/chat"
                className={isActive("/chat") ? "active" : ""}
                onClick={() => setSidebarOpen(false)}
              >
                <MessageSquare size={20} />
                <span>Chatbot</span>
              </Link>
            </li>

            {/* Analytics section */}
            {isFeatureEnabled("analytics_basic") && (
              <li className="sidebar-section">Analytics</li>
            )}

            {/* Basic analytics for Professional tier */}
            {isFeatureEnabled("analytics_basic") && (
              <li>
                <Link
                  to="/analytics"
                  className={isActive("/analytics") ? "active" : ""}
                  onClick={() => setSidebarOpen(false)}
                >
                  <BarChart4 size={20} />
                  <span>Analytics Dashboard</span>
                </Link>
              </li>
            )}

            {/* Advanced analytics for Enterprise tier */}
            {isFeatureEnabled("advanced_analytics") && (
              <li>
                <Link
                  to="/analytics/advanced"
                  className={isActive("/analytics/advanced") ? "active" : ""}
                  onClick={() => setSidebarOpen(false)}
                >
                  <BarChart4 size={20} />
                  <span>Advanced Analytics</span>
                </Link>
              </li>
            )}

            {/* Enterprise features section */}
            {isFeatureEnabled("custom_workflows") && (
              <li className="sidebar-section">Enterprise</li>
            )}

            {/* Workflows for Enterprise tier */}
            {isFeatureEnabled("custom_workflows") && (
              <li>
                <Link
                  to="/workflows"
                  className={isActive("/workflows") ? "active" : ""}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Workflow size={20} />
                  <span>Workflows</span>
                </Link>
              </li>
            )}

            {/* Integrations for Enterprise tier */}
            {isFeatureEnabled("custom_integrations") && (
              <li>
                <Link
                  to="/integrations"
                  className={isActive("/integrations") ? "active" : ""}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Cloud size={20} />
                  <span>Integrations</span>
                </Link>
              </li>
            )}

            {/* Admin section */}
            {isAdmin && (
              <>
                <li className="sidebar-section">Admin</li>
                <li>
                  <Link
                    to="/admin"
                    className={isActive("/admin") ? "active" : ""}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Settings size={20} />
                    <span>Admin Panel</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/users"
                    className={isActive("/admin/users") ? "active" : ""}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Users size={20} />
                    <span>User Management</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <div className="app-content" onClick={handleContentClick}>
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <button
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu size={24} />
            </button>
            <h1>Tatt2Away</h1>
          </div>

          <div className="header-right">
            <button className="notification-button">
              <Bell size={20} />
            </button>

            <div className="user-menu-container">
              <button
                className="user-menu-button"
                onClick={toggleUserMenu}
                aria-label="User menu"
              >
                <div className="user-avatar">
                  {currentUser?.name?.charAt(0) || "U"}
                </div>
                <span className="user-name">{currentUser?.name}</span>
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">
                      {currentUser?.name}
                    </div>
                    <div className="user-dropdown-email">
                      {currentUser?.email}
                    </div>
                  </div>

                  <ul className="user-dropdown-menu">
                    <li>
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/security"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Shield size={16} />
                        <span>Security</span>
                      </Link>
                    </li>
                    <li>
                      <button onClick={handleLogout} className="logout-button">
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      {enterpriseEnabled && <ThemeCustomizer />}
    </div>
  );
};

export default AppLayout;
