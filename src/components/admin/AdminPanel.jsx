// src/components/admin/AdminPanel.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
import {
  User,
  Users,
  Settings,
  Shield,
  Database,
  BarChart,
  UserPlus,
  Bell,
  ArrowRight,
  AlertCircle,
  Clock,
  Loader,
} from "lucide-react";
import "./Admin.css";

const AdminPanel = () => {
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();
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

        // Fetch admin stats (in a real app, this would be an API call)
        // For the demo, we'll simulate data
        const statsData = {
          totalUsers: 25,
          activeUsers: 18,
          totalMessages: 1248,
          filesProcessed: 352,
        };

        setStats(statsData);

        // Fetch recent users (in a real app, this would be an API call)
        // For the demo, we'll simulate data
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
  }, [isAdmin, navigate]);

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

              {/* Quick actions section */}
              <div className="admin-section">
                <h2 className="admin-section-title">Quick Actions</h2>

                <div className="admin-actions">
                  <Link to="/admin/register" className="admin-button">
                    <UserPlus size={18} />
                    Register New User
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
                  <Link to="/admin/register" className="admin-button">
                    <UserPlus size={18} />
                    Register New User
                  </Link>
                </div>

                {/* Users would be listed here */}
                <p className="placeholder-message">
                  User management interface would be displayed here.
                </p>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="admin-settings">
              <div className="admin-section">
                <h2 className="admin-section-title">System Settings</h2>

                {/* Settings would be displayed here */}
                <p className="placeholder-message">
                  System settings interface would be displayed here.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPanel;
