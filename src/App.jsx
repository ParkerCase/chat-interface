// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FeatureFlagsProvider } from "./utils/featureFlags";
import Login from "./components/Login";
import MainApp from "./components/MainApp";
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";
import PasscodeLogin from "./components/PasscodeLogin";
import MfaSetup from "./components/MfaSetup";
import MfaVerify from "./components/MfaVerify";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import SecuritySettings from "./components/SecuritySettings";
import AccountSettings from "./components/account/AccountSettings";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import "./App.css";

// Load environment variables with fallbacks
const ENV = {
  API_URL: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  TEAM_PASSCODE: process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$",
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <FeatureFlagsProvider>
          <Router>
            <div className="app-container">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/passcode" element={<PasscodeLogin />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/mfa/verify" element={<MfaVerify />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<MainApp />} />
                  <Route path="/security" element={<SecuritySettings />} />
                  <Route path="/profile" element={<AccountSettings />} />
                  <Route path="/mfa/setup" element={<MfaSetup />} />

                  {/* Admin routes */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/register" element={<Register />} />
                  </Route>
                </Route>

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </Router>
        </FeatureFlagsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Export environment variables for use in other components
export { ENV };
export default App;
