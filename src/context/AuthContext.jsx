// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Check if user is logged in on mount
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Set authorization header for all requests
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        // Fetch current user data
        const response = await api.get("/api/auth/me");

        if (response.data.success) {
          setCurrentUser(response.data.user);
          setError("");
        } else {
          // Handle error, clear invalid token
          logout();
          setError("Session expired. Please login again.");
        }
      } catch (error) {
        console.error("Error loading user:", error);
        logout();
        setError("Session expired. Please login again.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  // Login function
  const login = async (email, password) => {
    try {
      setError("");

      // Validate email domain
      if (!email.endsWith("@tatt2away.com")) {
        setError("Only @tatt2away.com email addresses are allowed");
        return false;
      }

      const response = await api.post("/api/auth/login", { email, password });

      if (response.data.success) {
        // Save token to localStorage and state
        localStorage.setItem("authToken", response.data.token);
        setToken(response.data.token);
        setCurrentUser(response.data.user);

        // Set default auth header for future requests
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        return true;
      } else {
        setError(response.data.error || "Login failed");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error.response?.data?.error || "Login failed. Please try again."
      );
      return false;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setCurrentUser(null);
    delete api.defaults.headers.common["Authorization"];
  };

  // Register function (admin only)
  const register = async (userData) => {
    try {
      setError("");

      // Validate email domain
      if (!userData.email.endsWith("@tatt2away.com")) {
        setError("Only @tatt2away.com email addresses are allowed");
        return false;
      }

      const response = await api.post("/api/auth/register", userData);

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.error || "Registration failed");
        return false;
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error.response?.data?.error || "Registration failed. Please try again."
      );
      return false;
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    register,
    isAdmin: currentUser?.roles?.includes("admin") || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
