// src/components/admin/EnhancedUserManagement.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  UserPlus,
  Users,
  Shield,
  Key,
  Lock,
  Unlock,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Save,
  X,
  Eye,
  EyeOff,
  Filter,
  Search,
  Download,
  Clock,
  Loader,
  MoreHorizontal,
  ArrowUpDown,
  CheckSquare,
  UserCog,
  Settings as SettingsIcon,
} from "lucide-react";
import "./EnhancedUserManagement.css";

const EnhancedUserManagement = ({
  users: initialUsers,
  currentUser,
  formatDate,
  setError,
  onRefreshUsers,
  error,
}) => {
  // State
  const [users, setUsers] = useState(initialUsers || []);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [userForMfa, setUserForMfa] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "user",
    status: "Active",
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "user",
    firstName: "",
    lastName: "",
  });

  const [mfaOptions, setMfaOptions] = useState({
    requireMfa: false,
    methods: [],
  });

  // Initialize and filter users when component mounts
  useEffect(() => {
    if (initialUsers?.length) {
      setUsers(initialUsers);
      setFilteredUsers(initialUsers);
    } else {
      fetchUsers();
    }
  }, [initialUsers]);

  // Filter and sort users when dependencies change
  useEffect(() => {
    applyFiltersAndSort();
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortDirection]);

  // Clear success message after 5 seconds
  useEffect(() => {
    let timeout;
    if (success) {
      timeout = setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [success]);

  // Helper function to generate a deterministic UUID
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

  // Fetch users from Supabase
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user auth data first
      const { data: authData, error: authError } =
        await supabase.auth.admin.listUsers();

      if (authError) {
        console.warn("Admin API access error:", authError);
        // Fall back to profiles table
      }

      // CHANGE THIS PART: Use the safe RPC function instead
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) {
        throw profilesError;
      }

      // The rest of your function remains the same
      let processedUsers = [];

      if (profilesData) {
        processedUsers = profilesData.map((profile) => {
          // Find matching auth data if available
          const authUser = authData?.users?.find((u) => u.id === profile.id);

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

          // Special case for admin user
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
            firstName: profile.first_name || "",
            lastName: profile.last_name || "",
            email: profile.email,
            role: primaryRole, // For display
            roleArray: rolesArray, // Complete role array for editing
            status: authUser?.banned
              ? "Banned"
              : authUser?.user_metadata?.status || profile.status || "Active",
            lastActive: lastActivity,
            mfaEnabled: hasMfa,
            mfaMethods: profile.mfa_methods || [],
            createdAt: profile.created_at,
            tier: profile.tier || "basic",
            emailConfirmed: authUser?.email_confirmed || true,
            lastSignIn: authUser?.last_sign_in_at || lastActivity,
            metadata: authUser?.user_metadata || profile.metadata || {},
          };
        });
      }

      setUsers(processedUsers);
      setFilteredUsers(processedUsers);

      // Update parent component if callback provided
      if (onRefreshUsers) {
        onRefreshUsers(processedUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting to users
  const applyFiltersAndSort = () => {
    let result = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (user) =>
          // Check all text fields
          (user.name &&
            typeof user.name === "string" &&
            user.name.toLowerCase().includes(query)) ||
          (user.email &&
            typeof user.email === "string" &&
            user.email.toLowerCase().includes(query)) ||
          (user.firstName &&
            typeof user.firstName === "string" &&
            user.firstName.toLowerCase().includes(query)) ||
          (user.lastName &&
            typeof user.lastName === "string" &&
            user.lastName.toLowerCase().includes(query)) ||
          (user.role &&
            typeof user.role === "string" &&
            user.role.toLowerCase().includes(query))
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter((user) => {
        if (roleFilter === "super_admin") {
          return user.role === "super_admin";
        } else if (roleFilter === "admin") {
          return user.role === "admin" || user.role === "super_admin";
        } else {
          return user.role === roleFilter;
        }
      });
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (user) => user.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparisonResult = 0;

      switch (sortField) {
        case "name":
          comparisonResult = a.name.localeCompare(b.name);
          break;
        case "email":
          comparisonResult = a.email.localeCompare(b.email);
          break;
        case "role":
          comparisonResult = a.role.localeCompare(b.role);
          break;
        case "status":
          comparisonResult = a.status.localeCompare(b.status);
          break;
        case "lastActive":
          comparisonResult = new Date(b.lastActive) - new Date(a.lastActive);
          break;
        default:
          comparisonResult = 0;
      }

      return sortDirection === "asc" ? comparisonResult : -comparisonResult;
    });

    setFilteredUsers(result);
  };

  // Toggle sort direction
  const handleSort = (field) => {
    setSortDirection((prevDirection) =>
      sortField === field && prevDirection === "asc" ? "desc" : "asc"
    );
    setSortField(field);
  };

  // Check if user can manage another user
  const canManageUser = (user) => {
    // Super admins can manage anyone except themselves and protected admin accounts
    if (currentUser.roles.includes("super_admin")) {
      return (
        user.id !== currentUser.id &&
        user.email !== "itsus@tatt2away.com" &&
        user.email !== "parker@tatt2away.com"
      );
    }

    // Admins can only manage non-admin users
    if (currentUser.roles.includes("admin")) {
      return !user.role.includes("admin") && !user.role.includes("super_admin");
    }

    // Regular users can't manage anyone
    return false;
  };

  // Check if current user can SEE the delete button
  const canSeeDeleteButton = (user) => {
    // Super admins can see delete buttons for everyone except protected accounts
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

  // Handle user selection
  const handleSelectUser = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    }
    setIsAllSelected(!isAllSelected);
  };

  // Update isAllSelected when selectedUsers changes
  useEffect(() => {
    setIsAllSelected(
      filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length
    );
  }, [selectedUsers, filteredUsers]);

  // Open edit modal
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
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      role: displayRole,
      status: user.status || "Active",
    });

    setShowEditModal(true);
  };

  // Handle edit form change
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Fetch user by email
  const fetchUserByEmail = async (email) => {
    // Always select all fields you need and filter by email
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name,full_name,roles,status")
      .eq("email", email)
      .single();
    if (error) throw error;
    return data;
  };

  // Submit edit user form
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;
    try {
      setLoading(true);
      // Call Edge Function to update user
      const response = await fetch(
        "https://rfnglcfyzoyqenofmsev.functions.supabase.co/update-user",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userToEdit.id,
            email: userToEdit.email,
            full_name: `${editForm.firstName} ${editForm.lastName}`.trim(),
            first_name: editForm.firstName,
            last_name: editForm.lastName,
            role: editForm.role,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to update user");
        setLoading(false);
        return;
      }
      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (user.id === userToEdit.id) {
            return {
              ...user,
              name: `${editForm.firstName} ${editForm.lastName}`.trim(),
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              role: editForm.role,
              status: editForm.status,
              roleArray: [editForm.role],
            };
          }
          return user;
        })
      );
      setSuccess(
        `User ${editForm.firstName} ${editForm.lastName}`.trim() +
          " successfully updated"
      );
      setShowEditModal(false);
      setUserToEdit(null);
      if (onRefreshUsers) {
        onRefreshUsers(
          users.map((user) =>
            user.id === userToEdit.id
              ? {
                  ...user,
                  name: `${editForm.firstName} ${editForm.lastName}`.trim(),
                  firstName: editForm.firstName,
                  lastName: editForm.lastName,
                  role: editForm.role,
                  status: editForm.status,
                  roleArray: [editForm.role],
                }
              : user
          )
        );
      }
    } catch (error) {
      setError(`Failed to update user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);

      // Special protection for admin accounts
      if (
        userToDelete.email === "itsus@tatt2away.com" ||
        userToDelete.email === "parker@tatt2away.com"
      ) {
        setError("Protected admin accounts cannot be deleted");
        setShowDeleteModal(false);
        setUserToDelete(null);
        return;
      }

      // First delete from profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userToDelete.id);

      if (profileError) {
        throw profileError;
      }

      // Then try to delete the auth user if we have admin access
      try {
        // Comment out or remove the following line
        // const { error: authError } = await supabase.auth.admin.deleteUser(
        //   userToDelete.id
        // );

        if (error) {
          console.warn("Could not delete auth user:", error);
        }
      } catch (error) {
        console.warn("Admin API access error:", error);
      }

      // Update local state
      const updatedUsers = users.filter((user) => user.id !== userToDelete.id);
      setUsers(updatedUsers);
      setSelectedUsers((prevSelected) =>
        prevSelected.filter((id) => id !== userToDelete.id)
      );

      setSuccess(`User ${userToDelete.name} successfully deleted`);
      setShowDeleteModal(false);
      setUserToDelete(null);

      // Update parent component if callback provided
      if (onRefreshUsers) {
        onRefreshUsers(updatedUsers);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      setError(`Failed to delete user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      setLoading(true);

      // Filter out protected admin accounts
      const deletableUsers = selectedUsers.filter((id) => {
        const user = users.find((u) => u.id === id);
        return (
          user &&
          user.email !== "itsus@tatt2away.com" &&
          user.email !== "parker@tatt2away.com"
        );
      });

      if (deletableUsers.length === 0) {
        setError("No users can be deleted");
        setShowBulkDeleteModal(false);
        return;
      }

      // Delete users one by one
      const results = await Promise.allSettled(
        deletableUsers.map(async (userId) => {
          // First delete from profiles table
          await supabase.from("profiles").delete().eq("id", userId);

          // Then try to delete auth user
          try {
            // Comment out or remove the following line
            // await supabase.auth.admin.deleteUser(userId);
          } catch (error) {
            console.warn(`Auth delete failed for ${userId}:`, error);
          }

          return userId;
        })
      );

      // Get successfully deleted users
      const deletedIds = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      // Update local state
      const updatedUsers = users.filter(
        (user) => !deletedIds.includes(user.id)
      );
      setUsers(updatedUsers);
      setSelectedUsers([]);

      setSuccess(`Successfully deleted ${deletedIds.length} users`);
      setShowBulkDeleteModal(false);

      // Update parent component if callback provided
      if (onRefreshUsers) {
        onRefreshUsers(updatedUsers);
      }
    } catch (error) {
      console.error("Error in bulk delete:", error);
      setError(`Failed to delete users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!userToReset) return;

    try {
      setLoading(true);

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(
        userToReset.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        throw error;
      }

      setSuccess(`Password reset email sent to ${userToReset.email}`);
      setShowResetModal(false);
      setUserToReset(null);
    } catch (error) {
      console.error("Error resetting password:", error);
      setError(`Failed to reset password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Open MFA modal
  const openMfaModal = async (user) => {
    try {
      setLoading(true);

      // Get user's current MFA settings from profile
      const { data, error } = await supabase.rpc("get_user_profile", {
        user_id: user.id,
      });

      if (error) {
        throw error;
      }

      // Process the first profile found or use default
      const profile = data && data.length > 0 ? data[0] : { mfa_methods: [] };

      setUserForMfa(user);
      setMfaOptions({
        requireMfa: profile?.mfa_methods?.length > 0 || false,
        methods: profile?.mfa_methods || [],
      });
      setShowMfaModal(true);
    } catch (error) {
      console.error("Error opening MFA modal:", error);
      setError(`Failed to load MFA settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Save MFA settings
  const handleSaveMfaSettings = async () => {
    if (!userForMfa) return;
    try {
      setLoading(true);
      let updatedMethods = [...mfaOptions.methods];
      if (mfaOptions.requireMfa && updatedMethods.length === 0) {
        const emailMfaMethod = {
          id: `email-${userForMfa.email.replace(/[^a-zA-Z0-9]/g, "")}`,
          type: "email",
          createdAt: new Date().toISOString(),
          email: userForMfa.email,
        };
        updatedMethods.push(emailMfaMethod);
      } else if (!mfaOptions.requireMfa) {
        updatedMethods = [];
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          mfa_methods: updatedMethods,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userForMfa.id);
      if (error) {
        if (error.message?.includes("recursion")) {
          setError("Database recursion error: Please contact support.");
        } else if (error.code === "42501") {
          setError(
            "Permission denied: You do not have access to update MFA settings."
          );
        } else {
          setError(`Failed to update MFA: ${error.message}`);
        }
        throw error;
      }
      if (mfaOptions.requireMfa && !mfaOptions.methods.length) {
        await supabase.auth.resetPasswordForEmail(userForMfa.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }
      const updatedUsers = users.map((user) => {
        if (user.id === userForMfa.id) {
          return {
            ...user,
            mfaEnabled: updatedMethods.length > 0,
            mfaMethods: updatedMethods,
          };
        }
        return user;
      });
      setUsers(updatedUsers);
      setSuccess(`MFA settings updated for ${userForMfa.name}`);
      setShowMfaModal(false);
      setUserForMfa(null);
      if (onRefreshUsers) {
        onRefreshUsers(updatedUsers);
      }
    } catch (error) {
      // Already handled above
    } finally {
      setLoading(false);
    }
  };

  // Handle inviting a new user
  const handleInviteUser = async () => {
    try {
      setLoading(true);
      // Check if user already exists in profiles
      const { data: existingUser, error: existingError } = await supabase
        .from("profiles")
        .select("id,email")
        .eq("email", inviteForm.email)
        .single();
      if (existingUser) {
        setError("A user with this email already exists.");
        setLoading(false);
        return;
      }
      // Call Edge Function to invite user
      const response = await fetch(
        "https://rfnglcfyzoyqenofmsev.functions.supabase.co/invite-user",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteForm.email,
            full_name: `${inviteForm.firstName} ${inviteForm.lastName}`.trim(),
            first_name: inviteForm.firstName,
            last_name: inviteForm.lastName,
            role: inviteForm.role,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to invite user");
        setLoading(false);
        return;
      }
      // Add new user to local state
      const newUser = {
        id: result.user.id,
        name:
          `${inviteForm.firstName} ${inviteForm.lastName}`.trim() ||
          inviteForm.email,
        firstName: inviteForm.firstName,
        lastName: inviteForm.lastName,
        email: inviteForm.email,
        role: inviteForm.role,
        roleArray: [inviteForm.role],
        status: "Active",
        lastActive: new Date().toISOString(),
        mfaEnabled: false,
        mfaMethods: [],
        createdAt: new Date().toISOString(),
        tier: "enterprise",
        emailConfirmed: true,
      };
      const updatedUsers = [newUser, ...users];
      setUsers(updatedUsers);
      setSuccess(`Invitation sent to ${inviteForm.email}`);
      setShowInviteModal(false);
      setInviteForm({ email: "", role: "user", firstName: "", lastName: "" });
      if (onRefreshUsers) {
        onRefreshUsers(updatedUsers);
      }
    } catch (error) {
      setError(`Failed to invite user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export users to CSV
  const exportUsers = () => {
    try {
      // Prepare CSV data
      const headers = [
        "Name",
        "Email",
        "Role",
        "Status",
        "Last Active",
        "MFA Enabled",
      ];

      const csvData = filteredUsers.map((user) => [
        user.name,
        user.email,
        user.role,
        user.status,
        new Date(user.lastActive).toLocaleString(),
        user.mfaEnabled ? "Yes" : "No",
      ]);

      // Create CSV content
      let csvContent = headers.join(",") + "\n";
      csvContent += csvData.map((row) => row.join(",")).join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess("Users exported to CSV");
    } catch (error) {
      console.error("Error exporting users:", error);
      setError(`Export failed: ${error.message}`);
    }
  };

  return (
    <div className="enhanced-user-management">
      <div className="admin-section">
        <h2 className="admin-section-title">User Management</h2>

        {/* Success message */}
        {success && (
          <div className="success-message">
            <CheckCircle className="success-icon" size={18} />
            <p>{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="error-message">
            <AlertCircle className="error-icon" size={18} />
            <p>{error}</p>
          </div>
        )}

        {/* IMPROVED LAYOUT: More compact controls with better alignment */}
        <div className="user-management-controls">
          {/* Left side actions */}
          <div className="user-management-actions">
            <button
              className=" invite-button"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus size={16} />
              Invite
            </button>

            <button
              className=" refresh-button"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw
                style={{ marginBottom: "0" }}
                size={16}
                color="white"
                className={loading ? "spinning" : ""}
              />
            </button>

            <button
              className=" export-button"
              onClick={exportUsers}
              disabled={filteredUsers.length === 0}
            >
              <Download size={16} />
              Export
            </button>
          </div>

          {/* Right side filters - IMPROVED LAYOUT */}
          <div className="user-management-filters">
            {/* Search input */}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Role filter */}
            <div className="filter-group">
              <select
                id="role-filter"
                className="filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>

            {/* Status filter */}
            <div className="filter-group">
              <select
                id="status-filter"
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
        </div>

        <div className="users-table-container">
          {loading && filteredUsers.length === 0 ? (
            <div className="loading-container">
              <Loader className="spinner" size={32} />
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <h3>No Users Found</h3>
              <p>No users match your current search or filter criteria.</p>
              {(searchQuery ||
                roleFilter !== "all" ||
                statusFilter !== "all") && (
                <button
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "20px",
                padding: "20px",
              }}
            >
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                    transition: "all 0.3s ease",
                    border: selectedUsers.includes(user.id)
                      ? "2px solid #4f46e5"
                      : "1px solid #e5e7eb",
                    position: "relative",
                    cursor: "pointer",
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflowWrap: "break-word",
                    margin: "0 auto 16px auto",
                    ...(window.innerWidth <= 440
                      ? {
                          width: "100%",
                          minWidth: 0,
                          maxWidth: "100%",
                          boxSizing: "border-box",
                          overflowX: "hidden",
                          overflowWrap: "break-word",
                          margin: "0 0 16px 0",
                        }
                      : {}),
                    ...(selectedUsers.includes(user.id) && {
                      boxShadow:
                        "0 0 0 2px rgba(79, 70, 229, 0.1), 0 2px 8px rgba(0, 0, 0, 0.08)",
                    }),
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedUsers.includes(user.id)) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(0, 0, 0, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedUsers.includes(user.id)) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 2px 8px rgba(0, 0, 0, 0.08)";
                    }
                  }}
                >
                  <label
                    className="checkbox-container"
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                    />
                    <span className="checkbox-checkmark"></span>
                  </label>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "15px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1e293b",
                          marginBottom: "5px",
                        }}
                      >
                        {user.name}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#64748b",
                          marginBottom: "10px",
                        }}
                      >
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "15px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: "500",
                        backgroundColor:
                          user.role === "super_admin"
                            ? "#fee2e2"
                            : user.role === "admin"
                            ? "#e0e7ff"
                            : "#f3f4f6",
                        color:
                          user.role === "super_admin"
                            ? "#dc2626"
                            : user.role === "admin"
                            ? "#4338ca"
                            : "#6b7280",
                        border: `1px solid ${
                          user.role === "super_admin"
                            ? "#fecaca"
                            : user.role === "admin"
                            ? "#c7d2fe"
                            : "#e5e7eb"
                        }`,
                      }}
                    >
                      {user.role === "super_admin"
                        ? "Super Admin"
                        : user.role === "admin"
                        ? "Admin"
                        : "User"}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: "500",
                        backgroundColor:
                          user.status.toLowerCase() === "active"
                            ? "#dcfce7"
                            : "#f3f4f6",
                        color:
                          user.status.toLowerCase() === "active"
                            ? "#16a34a"
                            : "#6b7280",
                        border: `1px solid ${
                          user.status.toLowerCase() === "active"
                            ? "#bbf7d0"
                            : "#e5e7eb"
                        }`,
                      }}
                    >
                      {user.status}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      color: "#94a3b8",
                      marginBottom: "15px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Clock size={14} />
                    Last active {formatDate(user.lastActive)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      paddingTop: "15px",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(user);
                      }}
                      style={{
                        padding: "8px",
                        borderRadius: "6px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        flex: 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e0e7ff";
                        e.currentTarget.style.borderColor = "#c7d2fe";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                      title="Edit User"
                    >
                      <Edit size={14} color="#4f46e5" />
                    </button>

                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToReset(user);
                        setShowResetModal(true);
                      }}
                      style={{
                        padding: "8px",
                        borderRadius: "6px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        flex: 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef3c7";
                        e.currentTarget.style.borderColor = "#fde68a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                      title="Reset Password"
                    >
                      <Key size={14} color="#f59e0b" />
                    </button>

                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMfaModal(user);
                      }}
                      style={{
                        padding: "8px",
                        borderRadius: "6px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        flex: 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#dcfce7";
                        e.currentTarget.style.borderColor = "#bbf7d0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                      title="Manage MFA Settings"
                    >
                      {user.mfaEnabled ? (
                        <Lock size={14} color="#16a34a" />
                      ) : (
                        <Unlock size={14} color="#16a34a" />
                      )}
                    </button>

                    {canSeeDeleteButton(user) && (
                      <button
                        className="action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserToDelete(user);
                          setShowDeleteModal(true);
                        }}
                        style={{
                          padding: "8px",
                          borderRadius: "6px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          cursor:
                            canManageUser(user) &&
                            user.email !== "itsus@tatt2away.com" &&
                            user.email !== "parker@tatt2away.com"
                              ? "pointer"
                              : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                          flex: 1,
                          opacity:
                            canManageUser(user) &&
                            user.email !== "itsus@tatt2away.com" &&
                            user.email !== "parker@tatt2away.com"
                              ? 1
                              : 0.5,
                        }}
                        onMouseEnter={(e) => {
                          if (
                            canManageUser(user) &&
                            user.email !== "itsus@tatt2away.com" &&
                            user.email !== "parker@tatt2away.com"
                          ) {
                            e.currentTarget.style.backgroundColor = "#fee2e2";
                            e.currentTarget.style.borderColor = "#fecaca";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }}
                        disabled={
                          !canManageUser(user) ||
                          user.email === "itsus@tatt2away.com" ||
                          user.email === "parker@tatt2away.com"
                        }
                        title="Delete User"
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="users-table-footer">
          <div className="pagination-info">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Invite New User</h3>
              <button
                className="modal-close"
                onClick={() => setShowInviteModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleInviteUser} className="invite-form">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
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
                      value={inviteForm.firstName}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
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
                      name="lastName"
                      value={inviteForm.lastName}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          lastName: e.target.value,
                        })
                      }
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    name="role"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value })
                    }
                    className="form-select"
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {currentUser.roles.includes("super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>

                <div className="form-info">
                  <p>
                    An invitation email will be sent to this address with
                    instructions to set up their password and account.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={
                      loading || !inviteForm.email || !inviteForm.firstName
                    }
                  >
                    {loading ? (
                      <>
                        <Loader size={14} className="spinner" />
                        Sending Invitation...
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Send Invitation
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setShowInviteModal(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
              <form onSubmit={handleEditUserSubmit} className="edit-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={editForm.firstName}
                      onChange={handleEditFormChange}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={editForm.lastName}
                      onChange={handleEditFormChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
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
                      (!currentUser.roles.includes("super_admin") &&
                        editForm.role === "admin") ||
                      userToEdit.email === "itsus@tatt2away.com" ||
                      userToEdit.email === "parker@tatt2away.com"
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {currentUser.roles.includes("super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                  {(userToEdit.email === "itsus@tatt2away.com" ||
                    userToEdit.email === "parker@tatt2away.com") && (
                    <p className="input-help">
                      Admin role cannot be changed for system accounts
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={editForm.status}
                    onChange={handleEditFormChange}
                    className="form-select"
                    required
                    disabled={
                      userToEdit.email === "itsus@tatt2away.com" ||
                      userToEdit.email === "parker@tatt2away.com"
                    }
                  >
                    <option value="Active">Active </option>
                    <option value="Inactive">Inactive</option>
                    <option value="Banned">Banned</option>
                  </select>
                </div>

                <div className="modal-footer">
                  <button
                    type="submit"
                    className="save-button"
                    disabled={loading}
                  >
                    {loading ? (
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
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => {
                      setShowEditModal(false);
                      setUserToEdit(null);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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

              <div className="modal-footer">
                <button
                  className="delete-button"
                  onClick={handleDeleteUser}
                  disabled={
                    loading ||
                    userToDelete.email === "itsus@tatt2away.com" ||
                    userToDelete.email === "parker@tatt2away.com"
                  }
                >
                  {loading ? (
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
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Delete Selected Users</h3>
              <button
                className="modal-close"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{" "}
                <strong>{selectedUsers.length}</strong> selected users?
              </p>
              <p className="warning-text">This action cannot be undone.</p>

              <div className="bulk-delete-note">
                <AlertCircle size={16} />
                <p>
                  Note: Protected admin accounts will be skipped and not deleted
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="delete-button"
                onClick={handleBulkDelete}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader size={14} className="spinner" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete {selectedUsers.length} Users
                  </>
                )}
              </button>
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

              <div className="modal-footer">
                <button
                  className="send-button"
                  onClick={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
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
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowResetModal(false);
                    setUserToReset(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
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
                    <div className="toggle-track">
                      <div className="toggle-indicator"></div>
                    </div>
                  </button>
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
              <div className="modal-footer">
                <button
                  className="save-button"
                  onClick={handleSaveMfaSettings}
                  disabled={loading}
                >
                  {loading ? (
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
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowMfaModal(false);
                    setUserForMfa(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedUserManagement;
