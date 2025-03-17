// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./Routes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function App() {
  // Check for URL parameters that might indicate admin login needed
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("admin") === "true") {
      // Redirect to admin login
      window.location.href = "/login";
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
