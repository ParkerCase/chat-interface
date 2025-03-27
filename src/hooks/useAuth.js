// Frontend useAuth hook (React)
import { useState, useEffect, createContext, useContext } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Initialize auth state
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        try {
          // Set default auth header
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          // Validate the token by making a request
          const response = await axios.get("/api/auth/me");
          if (response.data.success) {
            setCurrentUser(response.data.user);
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
          localStorage.removeItem("authToken");
          delete axios.defaults.headers.common["Authorization"];
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setError("");
      setLoading(true);

      const response = await axios.post("/api/auth/login", { email, password });

      if (response.data.success) {
        const { token, user } = response.data;

        localStorage.setItem("authToken", token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        setCurrentUser(user);
        return true;
      }

      return false;
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await axios.post("/api/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("authToken");
      delete axios.defaults.headers.common["Authorization"];
      setCurrentUser(null);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setError("");
      setLoading(true);

      const response = await axios.post("/api/auth/register", userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        error,
        setError,
        login,
        logout,
        register,
        isAdmin: currentUser?.roles?.includes("admin") || false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
