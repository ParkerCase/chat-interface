// src/components/admin/AdminPanel.jsx - updated to include ChatbotTabContent
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/apiService";
import CRMTabContent from "./CRMTabContent";
import ChatbotTabContent from "./ChatbotTabContent"; // Import ChatbotTabContent component
import CRMContactLookup from "../crm/CRMContactLookup";
import ThemeCustomizer from "../ThemeCustomizer";
import "./Admin.css";
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
  CheckCircle,
  X,
  Mail,
  RefreshCw,
  Edit,
  Lock,
  Unlock,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

// User Management Tab Component
function UserManagementTab({
  users,
  currentUser,
  formatDate,
  setError,
  onRefreshUsers,
}) {
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Form state for editing user
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
  });

  // Initialize users list when component mounts or users prop changes
  useEffect(() => {
    setUsersList(users);
  }, [users]);

  // Clear success message after a delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Check if current user can edit/delete another user
  const canManageUser = (user) => {
    // Super admins can manage anyone except themselves and the protected admin accounts
    if (currentUser.roles.includes("super_admin")) {
      return (
        user.id !== currentUser.id &&
        user.email !== "itsus@tatt2away.com" &&
        user.email !== "parker@tatt2away.com"
      ); // Can't delete yourself or the admin accounts
    }

    // Admins can only manage non-admin users
    if (currentUser.roles.includes("admin")) {
      return !user.role.includes("admin") && !user.role.includes("super_admin");
    }

    // Regular users can't manage anyone
    return false;
  };

  // Check if current user can SEE the delete button (even if it's disabled)
  const canSeeDeleteButton = (user) => {
    // Super admins can see delete buttons for everyone except the protected admin accounts
    if (currentUser.roles.includes("super_admin")) {
      return (
        user.email !== "itsus@tatt2away.com" &&
        user.email !== "parker@tatt2away.com"
      );
    }

    // Admins can see delete buttons for regular users only
    if (currentUser.roles.includes("admin")) {
      return !user.role.includes("admin") && !user.role.includes("super_admin");
    }

    // Regular users don't see delete buttons
    return false;
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setIsLoading(true);

      // Special protection for admin accounts
      if (
        userToDelete.email === "itsus@tatt2away.com" ||
        userToDelete.email === "parker@tatt2away.com"
      ) {
        console.log("Protected admin account cannot be deleted");
        setError("Protected admin accounts cannot be deleted");
        setShowDeleteModal(false);
        setUserToDelete(null);
        setIsLoading(false);
        return;
      }

      // Import supabase
      const { supabase } = await import("../../lib/supabase");

      // First delete from profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userToDelete.id);

      if (profileError) {
        console.error("Error deleting user profile:", profileError);
        throw new Error(
          `Failed to delete user profile: ${profileError.message}`
        );
      }

      // Then delete the auth user if we have admin access
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(
          userToDelete.id
        );

        if (authError) {
          console.warn(
            "Could not delete auth user (might require higher permissions):",
            authError
          );
          // Continue anyway as we've deleted the profile
        }
      } catch (adminError) {
        console.warn("Admin API access error:", adminError);
        // Continue anyway as we've deleted the profile
      }

      // Update local state
      setUsersList(usersList.filter((user) => user.id !== userToDelete.id));
      setSuccessMessage(`User ${userToDelete.name} successfully deleted`);

      // Close modal
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      setError(`Failed to delete user: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle opening edit modal
  const openEditModal = (user) => {
    setUserToEdit(user);

    // Determine the highest role for display in dropdown
    let displayRole = "user";

    // Use the roleArray to determine the highest role
    if (user.roleArray) {
      if (user.roleArray.includes("super_admin")) {
        displayRole = "super_admin";
      } else if (user.roleArray.includes("admin")) {
        displayRole = "admin";
      }
    } else {
      // Fallback to simple role if roleArray not available
      displayRole = user.role;
    }

    // Override for special admin user
    if (user.email === "itsus@tatt2away.com") {
      displayRole = "super_admin";
    }

    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: displayRole,
    });

    setShowEditModal(true);
  };

  // Handle edit user form change
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle edit user submission
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;

    try {
      setIsLoading(true);

      // Import supabase
      const { supabase } = await import("../../lib/supabase");

      // First get the current roles from the database to ensure we preserve any specialized roles
      let existingRoles = userToEdit.roleArray || ["user"];

      // If we don't have roleArray in userToEdit, fetch from database
      if (!userToEdit.roleArray) {
        try {
          const { data: userData, error: userError } = await supabase
            .from("profiles")
            .select("roles")
            .eq("id", userToEdit.id)
            .single();

          if (!userError && userData && Array.isArray(userData.roles)) {
            existingRoles = userData.roles;
          }
        } catch (fetchError) {
          console.warn("Failed to fetch current roles:", fetchError);
          // Continue with default roles
        }
      }

      // Determine what roles to add/remove based on the selected role in the form
      let newRoles = [...existingRoles];

      // Remove existing role levels we're changing
      newRoles = newRoles.filter(
        (role) => role !== "user" && role !== "admin" && role !== "super_admin"
      );

      // Add the appropriate roles based on selected level
      if (editForm.role === "super_admin") {
        newRoles.push("super_admin", "admin", "user");
      } else if (editForm.role === "admin") {
        newRoles.push("admin", "user");
      } else {
        newRoles.push("user");
      }

      // Remove duplicates
      newRoles = [...new Set(newRoles)];

      // Special case for admin users - ensure they always have super_admin role
      if (
        userToEdit.email === "itsus@tatt2away.com" ||
        userToEdit.email === "parker@tatt2away.com"
      ) {
        console.log("Ensuring admin user has super_admin role");
        if (!newRoles.includes("super_admin")) {
          newRoles.push("super_admin");
        }
        if (!newRoles.includes("admin")) {
          newRoles.push("admin");
        }
        if (!newRoles.includes("user")) {
          newRoles.push("user");
        }
      }

      console.log(`Updating user ${userToEdit.email} with roles:`, newRoles);

      // Update profile in Supabase
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.name,
          roles: newRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userToEdit.id);

      if (error) {
        console.error("Error updating user:", error);
        throw new Error(`Failed to update user: ${error.message}`);
      }

      // Update user list with the new data
      setUsersList(
        usersList.map((user) => {
          if (user.id === userToEdit.id) {
            return {
              ...user,
              name: editForm.name,
              role:
                userToEdit.email === "itsus@tatt2away.com" ||
                userToEdit.email === "parker@tatt2away.com"
                  ? "super_admin"
                  : editForm.role,
              roleArray: newRoles,
            };
          }
          return user;
        })
      );

      setSuccessMessage(`User ${editForm.name} successfully updated`);
      setShowEditModal(false);
      setUserToEdit(null);
    } catch (error) {
      console.error("Error updating user:", error);
      setError(`Failed to update user: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reset password
  const handleResetPassword = async () => {
    if (!userToReset) return;

    try {
      setIsLoading(true);

      // Import supabase
      const { supabase } = await import("../../lib/supabase");

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(
        userToReset.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        console.error("Error sending password reset:", error);
        throw new Error(`Failed to send password reset: ${error.message}`);
      }

      setSuccessMessage(`Password reset email sent to ${userToReset.email}`);
      setShowResetModal(false);
      setUserToReset(null);
    } catch (error) {
      console.error("Error resetting password:", error);
      setError(`Failed to reset password: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle managing MFA for a user
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [userForMfa, setUserForMfa] = useState(null);
  const [mfaOptions, setMfaOptions] = useState({
    requireMfa: false,
    methods: [],
  });

  // Open MFA management modal for a user
  const openMfaModal = async (user) => {
    try {
      setIsLoading(true);

      // Import supabase
      const { supabase } = await import("../../lib/supabase");

      // Get user's current MFA settings from profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("mfa_methods")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching MFA methods:", profileError);
        throw new Error(`Failed to fetch MFA methods: ${profileError.message}`);
      }

      // Set user and MFA options
      setUserForMfa(user);
      setMfaOptions({
        requireMfa: profileData?.mfa_methods?.length > 0 || false,
        methods: profileData?.mfa_methods || [],
      });
      setShowMfaModal(true);
    } catch (error) {
      console.error("Error opening MFA modal:", error);
      setError(`Failed to open MFA settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle saving MFA settings for a user
  const handleSaveMfaSettings = async () => {
    if (!userForMfa) return;

    try {
      setIsLoading(true);

      // Import supabase
      const { supabase } = await import("../../lib/supabase");

      // Create a default email MFA method if required and none exists
      let updatedMethods = [...mfaOptions.methods];

      if (mfaOptions.requireMfa && updatedMethods.length === 0) {
        // Create a default email MFA method
        const emailMfaMethod = {
          id: `email-${userForMfa.email.replace(/[^a-zA-Z0-9]/g, "")}`,
          type: "email",
          createdAt: new Date().toISOString(),
          email: userForMfa.email,
        };

        updatedMethods.push(emailMfaMethod);
      } else if (!mfaOptions.requireMfa) {
        // If MFA is not required, remove all methods
        updatedMethods = [];
      }

      // Update profile in Supabase
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          mfa_methods: updatedMethods,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userForMfa.id);

      if (profileError) {
        console.error("Error updating MFA settings:", profileError);
        throw new Error(
          `Failed to update MFA settings: ${profileError.message}`
        );
      }

      // Send reset password email if enabling MFA to force user to set up MFA
      if (mfaOptions.requireMfa && !mfaOptions.methods.length) {
        await supabase.auth.resetPasswordForEmail(userForMfa.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }

      setSuccessMessage(`MFA settings updated for ${userForMfa.name}`);
      setShowMfaModal(false);
      setUserForMfa(null);

      // Refresh user list
      await refreshUserList();
    } catch (error) {
      console.error("Error saving MFA settings:", error);
      setError(`Failed to save MFA settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refreshing user list
  const refreshUserList = async () => {
    try {
      setIsLoading(true);

      // Import supabase directly here to avoid circular dependencies
      const { supabase } = await import("../../lib/supabase");

      console.log("Fetching users from Supabase");

      // Get profiles with a longer timeout
      const profilesPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Profiles query timed out after 10 seconds"));
        }, 10000);

        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .then((result) => {
            clearTimeout(timeout);
            if (result.error) reject(result.error);
            else resolve(result.data || []);
          })
          .catch((error) => {
            clearTimeout(timeout);
            reject(error);
          });
      });

      // Await the profiles
      let supabaseProfiles = [];
      try {
        supabaseProfiles = await profilesPromise;
        console.log("Received user profiles:", supabaseProfiles.length);
      } catch (fetchError) {
        console.error("Error fetching users:", fetchError);
        // Continue with empty array - we'll add admin user later
      }

      // Process user profiles with accurate role handling
      let enrichedUsers = supabaseProfiles.map((profile) => {
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

        // Special case for admin user - ALWAYS super_admin
        if (profile.email === "itsus@tatt2away.com") {
          primaryRole = "super_admin";
        }

        // Format last activity time
        const lastActivity =
          profile.last_login ||
          profile.last_active ||
          profile.created_at ||
          new Date().toISOString();

        // Process MFA methods
        const hasMfa =
          Array.isArray(profile.mfa_methods) && profile.mfa_methods.length > 0;

        return {
          id: profile.id,
          name: profile.full_name || profile.email,
          email: profile.email,
          role: primaryRole, // For display
          roleArray: rolesArray, // Complete role array for editing
          status: profile.status || "Active",
          lastActive: lastActivity,
          mfaEnabled: hasMfa,
          mfaMethods: profile.mfa_methods || [],
        };
      });

      // Helper function to generate valid UUID v4 for virtual admin accounts
      const generateDeterministicUUID = (email) => {
        // Convert email to a predictable sequence of bytes
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
          hash = (hash << 5) - hash + email.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }

        // Format as UUID v4
        let hexStr = Math.abs(hash).toString(16).padStart(8, "0");
        while (hexStr.length < 32) {
          hexStr += Math.floor(Math.random() * 16).toString(16);
        }

        // Insert dashes and ensure version 4 UUID format
        return `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-4${hexStr.slice(
          13,
          16
        )}-${((parseInt(hexStr.slice(16, 17), 16) & 0x3) | 0x8).toString(
          16
        )}${hexStr.slice(17, 20)}-${hexStr.slice(20, 32)}`;
      };

      // Check for required admin accounts
      const adminEmails = ["itsus@tatt2away.com", "parker@tatt2away.com"];
      const existingAdminEmails = enrichedUsers.map((user) => user.email);
      let finalUserList = [...enrichedUsers];

      // Add any missing admin accounts with proper UUIDs
      adminEmails.forEach((adminEmail) => {
        if (!existingAdminEmails.includes(adminEmail)) {
          console.log(`Adding default admin account for ${adminEmail} to list`);

          const adminName =
            adminEmail === "itsus@tatt2away.com"
              ? "Tatt2Away Admin"
              : "Parker Admin";

          // Generate a valid UUID for this admin user
          const adminUUID = generateDeterministicUUID(adminEmail);

          finalUserList.unshift({
            id: adminUUID,
            name: adminName,
            email: adminEmail,
            role: "super_admin",
            roleArray: ["super_admin", "admin", "user"],
            status: "Active",
            lastActive: new Date().toISOString(),
            mfaEnabled: true,
            isVirtualUser: true, // Flag to identify this as a virtual user
            mfaMethods: [
              {
                id: `email-${adminEmail.replace(/[^a-zA-Z0-9]/g, "")}`,
                type: "email",
                createdAt: new Date().toISOString(),
                email: adminEmail,
              },
            ],
          });
        }
      });

      console.log("Final processed user list:", finalUserList.length);

      // Set users list with processed data
      setUsersList(finalUserList);
      setSuccessMessage("User list refreshed successfully");

      // Call the parent component's refresh function if provided
      if (onRefreshUsers && typeof onRefreshUsers === "function") {
        onRefreshUsers(finalUserList);
      }
    } catch (error) {
      console.error("Error refreshing users:", error);
      setError(`Failed to refresh users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-users">
      <div className="admin-section">
        <h2 className="admin-section-title">User Management</h2>

        {/* Success message */}
        {successMessage && (
          <div className="success-message">
            <CheckCircle className="success-icon" size={18} />
            <p>{successMessage}</p>
          </div>
        )}

        <div className="admin-actions">
          <Link to="/admin/register" className="admin-button">
            <UserPlus size={18} />
            <span>Register New User</span>
          </Link>

          <button
            className="action-button refresh-button"
            onClick={refreshUserList}
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? "spinning" : ""} />
            <span>Refresh Users</span>
          </button>
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
              {usersList.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span
                      className={`user-badge ${
                        user.role === "super_admin"
                          ? "super-admin-badge"
                          : user.role === "admin"
                          ? "admin-badge"
                          : ""
                      }`}
                    >
                      {user.role === "super_admin"
                        ? "Super Admin"
                        : user.role === "admin"
                        ? "Admin"
                        : "User"}
                    </span>
                    {user.roleArray &&
                      user.roleArray.length > 1 &&
                      user.roleArray.some(
                        (r) => !["user", "admin", "super_admin"].includes(r)
                      ) && (
                        <span
                          className="additional-roles-tooltip"
                          title={user.roleArray
                            .filter(
                              (r) =>
                                !["user", "admin", "super_admin"].includes(r)
                            )
                            .join(", ")}
                        >
                          +
                        </span>
                      )}
                  </td>
                  <td>
                    <span
                      className={`user-status ${user.status.toLowerCase()}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td>{formatDate(user.lastActive)}</td>
                  <td>
                    <div className="action-buttons">
                      {/* Edit button - visible to admins for non-admins and super_admins for everyone */}
                      {canManageUser(user) ||
                      currentUser.roles.includes("super_admin") ? (
                        <button
                          className="action-button edit-button"
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                        >
                          <Edit size={14} />
                        </button>
                      ) : null}

                      {/* Reset password button - visible to admins and super_admins */}
                      {(currentUser.roles.includes("admin") ||
                        currentUser.roles.includes("super_admin")) && (
                        <button
                          className="action-button reset-password-button"
                          onClick={() => {
                            setUserToReset(user);
                            setShowResetModal(true);
                          }}
                          title="Reset Password"
                        >
                          <Key size={14} />
                        </button>
                      )}

                      {/* MFA management button - visible to admins and super_admins */}
                      {(currentUser.roles.includes("admin") ||
                        currentUser.roles.includes("super_admin")) && (
                        <button
                          className="action-button mfa-button"
                          onClick={() => openMfaModal(user)}
                          title="Manage MFA Settings"
                        >
                          {user.mfaEnabled ? (
                            <Lock size={14} />
                          ) : (
                            <Unlock size={14} />
                          )}
                        </button>
                      )}

                      {/* Delete button - only shown according to user role permissions */}
                      {canSeeDeleteButton(user) && (
                        <button
                          className="action-button delete-button"
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          title="Delete User"
                          disabled={
                            !canManageUser(user) ||
                            user.email === "itsus@tatt2away.com" ||
                            user.email === "parker@tatt2away.com"
                          }
                        >
                          <Trash2 size={14} />
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

      {/* Delete User Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Delete User</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the following user?</p>
              <div className="user-info">
                <p>
                  <strong>Name:</strong> {userToDelete.name}
                </p>
                <p>
                  <strong>Email:</strong> {userToDelete.email}
                </p>
                <p>
                  <strong>Role:</strong> {userToDelete.role}
                </p>
                {(userToDelete.email === "itsus@tatt2away.com" ||
                  userToDelete.email === "parker@tatt2away.com") && (
                  <p className="admin-user-note">
                    <strong>Note:</strong> This is a protected admin account and
                    cannot be deleted.
                  </p>
                )}
              </div>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="delete-button"
                onClick={handleDeleteUser}
                disabled={
                  isLoading ||
                  userToDelete.email === "itsus@tatt2away.com" ||
                  userToDelete.email === "parker@tatt2away.com"
                }
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="spinner" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && userToEdit && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Edit User</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setUserToEdit(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditUserSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={editForm.email}
                    className="form-input"
                    disabled
                  />
                  <p className="input-help">Email cannot be changed</p>
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    name="role"
                    value={editForm.role}
                    onChange={handleEditFormChange}
                    className="form-select"
                    required
                    disabled={
                      !currentUser.roles.includes("super_admin") &&
                      editForm.role === "admin"
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {currentUser.roles.includes("super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => {
                      setShowEditModal(false);
                      setUserToEdit(null);
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="save-button"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader size={14} className="spinner" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && userToReset && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowResetModal(false);
                  setUserToReset(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Send password reset email to:</p>
              <div className="user-info">
                <p>
                  <strong>Name:</strong> {userToReset.name}
                </p>
                <p>
                  <strong>Email:</strong> {userToReset.email}
                </p>
              </div>
              <p>
                A password reset link will be sent to the user's email address.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowResetModal(false);
                  setUserToReset(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="send-button"
                onClick={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="spinner" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={14} />
                    Send Reset Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MFA Management Modal */}
      {showMfaModal && userForMfa && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>MFA Settings</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowMfaModal(false);
                  setUserForMfa(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="user-info">
                <p>
                  <strong>User:</strong> {userForMfa.name}
                </p>
                <p>
                  <strong>Email:</strong> {userForMfa.email}
                </p>
              </div>

              <div className="mfa-settings">
                <div className="mfa-toggle">
                  <label className="toggle-label">
                    <span>Require Multi-Factor Authentication</span>
                    <button
                      type="button"
                      className={`toggle-button ${
                        mfaOptions.requireMfa ? "enabled" : "disabled"
                      }`}
                      onClick={() =>
                        setMfaOptions({
                          ...mfaOptions,
                          requireMfa: !mfaOptions.requireMfa,
                        })
                      }
                    >
                      {mfaOptions.requireMfa ? (
                        <ToggleRight size={24} />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                  </label>
                </div>

                <div className="mfa-info">
                  {mfaOptions.requireMfa ? (
                    <div className="info-box enabled">
                      <Lock size={18} />
                      <div>
                        <p>
                          <strong>MFA Enabled</strong>
                        </p>
                        <p>
                          User will be required to set up and use MFA to login.
                        </p>
                        {mfaOptions.methods && mfaOptions.methods.length > 0 ? (
                          <ul className="mfa-methods-list">
                            {mfaOptions.methods.map((method) => (
                              <li key={method.id} className="mfa-method">
                                {method.type === "email" ? (
                                  <>
                                    <Mail size={14} /> Email:{" "}
                                    {method.email || userForMfa.email}
                                  </>
                                ) : method.type === "totp" ? (
                                  <>
                                    <Smartphone size={14} /> Authenticator App
                                  </>
                                ) : (
                                  <>
                                    <Shield size={14} /> {method.type}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="setup-note">
                            <strong>Note:</strong> The user will be prompted to
                            set up MFA on next login.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="info-box disabled">
                      <Unlock size={18} />
                      <div>
                        <p>
                          <strong>MFA Disabled</strong>
                        </p>
                        <p>
                          User can log in with password only. Enable MFA to
                          increase security.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowMfaModal(false);
                  setUserForMfa(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleSaveMfaSettings}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Add the debug function here, inside the component
  const debugAdminPanel = (message, data = null) => {
    const prefix = "AdminPanel Debug:";
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  // Updated ensureAdminUser function with fallback for AdminPanel.jsx
  const ensureAdminUser = async () => {
    try {
      console.log("Checking for admin user in database");

      const { supabase } = await import("../../lib/supabase");

      // Check if the admin user already exists by name
      const { data: existingAdmin, error: queryError } = await supabase
        .from("profiles")
        .select("id, roles")
        .eq("full_name", "Tatt2Away Admin")
        .maybeSingle();

      if (queryError) {
        console.error("Error checking for admin user:", queryError);
        return;
      }

      if (existingAdmin) {
        console.log("Admin user exists, ensuring super_admin role");

        // Ensure admin has super_admin role
        if (
          !existingAdmin.roles ||
          !existingAdmin.roles.includes("super_admin")
        ) {
          const roles = ["super_admin", "admin", "user"];

          // Update roles
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ roles })
            .eq("id", existingAdmin.id);

          if (updateError) {
            console.error("Error updating admin roles:", updateError);
          } else {
            console.log("Admin user roles updated successfully");
          }
        }
      } else {
        console.log("Admin user doesn't exist in the database");

        // Instead of trying to create with admin API, handle the case gracefully
        console.log("Adding virtual admin user to local state only");

        // The admin user will be created virtually in the recentUsers state
        // in the loadAdminData function with a fallback UUID
        // No need to attempt API calls that will fail with 403
      }
    } catch (error) {
      console.error("Error in ensureAdminUser:", error);
    }
  };

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      // Add debug logging
      debugAdminPanel("Component mounting", {
        isAdmin,
        currentUser: currentUser?.email,
        roles: currentUser?.roles || [],
      });

      // Redirect to home if not admin - BUT let's add a detailed log first
      if (!isAdmin) {
        debugAdminPanel("User is not admin, preparing to redirect", {
          currentUser: currentUser,
          authContextValue: {
            isAdmin,
            roles: currentUser?.roles,
          },
        });

        // Check if this is the test admin account before redirecting
        if (
          currentUser?.email === "itsus@tatt2away.com" ||
          currentUser?.email === "parker@tatt2away.com"
        ) {
          debugAdminPanel("Test admin detected, overriding redirection");
          // Don't redirect - this is a special test account
        } else {
          debugAdminPanel("Redirecting non-admin user to home");
          navigate("/");
          return;
        }
      }

      // The automatic refresh of users will happen in the UserManagementTab component

      try {
        setIsLoading(true);
        debugAdminPanel("Loading admin panel data");

        console.log("Loading admin panel data");

        // Set current user profile
        setUserProfile(currentUser);
        debugAdminPanel("User profile set", currentUser);

        // Ensure admin user exists in database
        try {
          await ensureAdminUser();
        } catch (adminError) {
          console.warn("Admin user check failed, continuing:", adminError);
          // Non-critical error, continue loading
        }

        // Import supabase directly here to avoid circular dependencies
        const { supabase } = await import("../../lib/supabase");

        // Get users from Supabase with timeout protection
        const userPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("User query timed out after 15 seconds"));
          }, 15000);

          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false })
            .then((result) => {
              clearTimeout(timeout);
              if (result.error) reject(result.error);
              else resolve(result.data || []);
            })
            .catch((error) => {
              clearTimeout(timeout);
              reject(error);
            });
        });

        // Fetch users with error handling
        let supabaseUsers = [];
        try {
          supabaseUsers = await userPromise;
          console.log(
            "Successfully retrieved users from database:",
            supabaseUsers.length
          );
        } catch (fetchError) {
          console.error("Error fetching users:", fetchError);
          // Continue with empty array - we'll add admin user later
        }

        // Process user profiles with accurate role handling
        const enrichedUsers = supabaseUsers.map((profile) => {
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

          // Special case for admin user - ALWAYS super_admin
          if (profile.email === "itsus@tatt2away.com") {
            primaryRole = "super_admin";
          }

          // Format last activity time
          const lastActivity =
            profile.last_login ||
            profile.last_active ||
            profile.created_at ||
            new Date().toISOString();

          // Process MFA methods
          const hasMfa =
            Array.isArray(profile.mfa_methods) &&
            profile.mfa_methods.length > 0;

          return {
            id: profile.id,
            name: profile.full_name || profile.email,
            email: profile.email,
            role: primaryRole, // For display
            roleArray: rolesArray, // Complete role array for editing
            status: profile.status || "Active",
            lastActive: lastActivity,
            mfaEnabled: hasMfa,
            mfaMethods: profile.mfa_methods || [],
          };
        });

        // Helper function to generate valid UUID v4 for virtual admin accounts
        const generateDeterministicUUID = (email) => {
          // Convert email to a predictable sequence of bytes
          let hash = 0;
          for (let i = 0; i < email.length; i++) {
            hash = (hash << 5) - hash + email.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
          }

          // Format as UUID v4 (with certain bits set according to the standard)
          let hexStr = Math.abs(hash).toString(16).padStart(8, "0");
          while (hexStr.length < 32) {
            hexStr += Math.floor(Math.random() * 16).toString(16);
          }

          // Insert dashes and ensure version 4 UUID format (set bits according to RFC4122)
          return `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-4${hexStr.slice(
            13,
            16
          )}-${((parseInt(hexStr.slice(16, 17), 16) & 0x3) | 0x8).toString(
            16
          )}${hexStr.slice(17, 20)}-${hexStr.slice(20, 32)}`;
        };

        // Check for required admin accounts
        let adminEmails = ["itsus@tatt2away.com", "parker@tatt2away.com"];
        let existingAdminEmails = enrichedUsers.map((user) => user.email);
        let finalUserList = [...enrichedUsers];

        // Add any missing admin accounts with proper UUIDs
        adminEmails.forEach((adminEmail) => {
          if (!existingAdminEmails.includes(adminEmail)) {
            console.log(
              `Adding default admin account for ${adminEmail} to list`
            );

            let adminName =
              adminEmail === "itsus@tatt2away.com"
                ? "Tatt2Away Admin"
                : "Parker Admin";

            // Generate a valid UUID for this admin user
            const adminUUID = generateDeterministicUUID(adminEmail);

            finalUserList.unshift({
              id: adminUUID, // Valid UUID format for compatibility with Supabase
              name: adminName,
              email: adminEmail,
              role: "super_admin",
              roleArray: ["super_admin", "admin", "user"],
              status: "Active",
              lastActive: new Date().toISOString(),
              mfaEnabled: true,
              isVirtualUser: true, // Flag to identify this as a virtual user that doesn't exist in the database
              mfaMethods: [
                {
                  id: `email-${adminEmail.replace(/[^a-zA-Z0-9]/g, "")}`,
                  type: "email",
                  createdAt: new Date().toISOString(),
                  email: adminEmail,
                },
              ],
            });
          }
        });

        console.log("Final processed user list:", finalUserList.length);

        // Set users and generate stats
        setRecentUsers(finalUserList);

        // Calculate stats
        const statsData = {
          totalUsers: finalUserList.length,
          activeUsers: finalUserList.filter(
            (user) =>
              user.status === "Active" &&
              new Date(user.lastActive) >
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // active in last 30 days
          ).length,
          totalMessages: 0, // Would be populated from actual message stats
          filesProcessed: 0, // Would be populated from actual file stats
          averageResponseTime: 0,
          lastUpdateTime: new Date().toISOString(),
        };

        setStats(statsData);
      } catch (err) {
        console.error("Error loading admin data:", err);
        setError("Failed to load admin data. Please try again.");

        // Emergency fallback - load just the known admin users using real UUIDs from the database
        try {
          // Use the known users from the context with proper fields based on the database structure
          const emergencyUsers = [
            {
              id: "c64b6462-ecfa-4d63-aeee-da2f18fd1db3", // Real UUID from database
              name: "ITSUS",
              email: "itsus@tatt2away.com",
              role: "super_admin",
              roleArray: ["super_admin", "admin", "user"],
              status: "Active",
              lastActive: new Date().toISOString(),
              mfaEnabled: true,
              mfaMethods: [
                {
                  id: "email-itsustatt2awaycom",
                  type: "email",
                  createdAt: new Date().toISOString(),
                  email: "itsus@tatt2away.com",
                },
              ],
            },
            {
              id: "234587f0-9b25-416f-af00-d6d491e01286", // Real UUID from database
              name: "Parker Admin",
              email: "parker@tatt2away.com",
              role: "super_admin",
              roleArray: ["super_admin", "admin", "user"],
              status: "Active",
              lastActive: new Date().toISOString(),
            },
          ];

          setRecentUsers(emergencyUsers);
          setStats({
            totalUsers: emergencyUsers.length,
            activeUsers: emergencyUsers.length,
            totalMessages: 0,
            filesProcessed: 0,
            averageResponseTime: 0,
            lastUpdateTime: new Date().toISOString(),
          });
        } catch (fallbackError) {
          console.error("Even emergency fallback failed:", fallbackError);
        }
      } finally {
        setIsLoading(false);
        debugAdminPanel("Admin data loading complete");
      }
    };
    // Only run this effect if we have a valid currentUser or isAdmin has changed
    if (currentUser || isAdmin !== undefined) {
      loadAdminData();
    } else {
      debugAdminPanel(
        "Skipping loadAdminData - no currentUser or isAdmin is undefined"
      );
    }
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
            <UserManagementTab
              users={recentUsers}
              currentUser={currentUser}
              formatDate={formatDate}
              setError={setError}
              onRefreshUsers={(users) => {
                console.log(
                  "Refreshed users from child component:",
                  users.length
                );
                setRecentUsers(users);
              }}
            />
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
