// src/components/EmployeeRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const EmployeeRoute = () => {
  const { currentUser, loading, hasRole } = useAuth();

  // Show loading state while checking roles
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Allow access for employees, admins, and super_admins
  if (
    currentUser &&
    (hasRole("employee") || hasRole("admin") || hasRole("super_admin"))
  ) {
    return <Outlet />;
  }

  // Redirect to dashboard if not an employee or admin
  return <Navigate to="/" replace />;
};

export default EmployeeRoute;
