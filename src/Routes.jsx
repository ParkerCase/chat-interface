// src/Routes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import MainApp from "./components/MainApp";
import Login from "./components/Login";
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";
import PasscodeLogin from "./components/PasscodeLogin";

function AppRoutes() {
  const { currentUser, isAdmin } = useAuth();
  const isBasicAuth = localStorage.getItem("isAuthenticated") === "true";

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={!currentUser ? <Login /> : <Navigate to="/admin" />}
      />
      <Route
        path="/passcode"
        element={!isBasicAuth ? <PasscodeLogin /> : <Navigate to="/" />}
      />

      {/* Basic authenticated routes (passcode access) */}
      <Route
        path="/"
        element={isBasicAuth ? <MainApp /> : <Navigate to="/passcode" />}
      />

      {/* Admin routes (JWT authentication) */}
      <Route
        path="/admin"
        element={currentUser ? <AdminPanel /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin/register"
        element={
          currentUser && isAdmin ? <Register /> : <Navigate to="/login" />
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;
