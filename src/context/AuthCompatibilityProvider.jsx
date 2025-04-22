// src/context/AuthCompatibilityProvider.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Create a compatibility context
const AuthCompatibilityContext = createContext({});

// Custom hook to access the compatibility auth context
export const useSupabaseAuth = () => useContext(AuthCompatibilityContext);

// Provider that bridges between the main auth context and any legacy code
export function AuthCompatibilityProvider({ children }) {
  const auth = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Initialize compatibility layer
  useEffect(() => {
    if (auth.isInitialized) {
      setIsReady(true);
    }
  }, [auth.isInitialized]);

  // Map the auth context to the compatibility interface
  const compatibilityValue = {
    user: auth.currentUser,
    session: auth.session,
    isLoading: auth.loading,
    signIn: auth.login,
    signOut: auth.logout,
    isReady,
    // Add any other properties needed for compatibility
  };

  return (
    <AuthCompatibilityContext.Provider value={compatibilityValue}>
      {children}
    </AuthCompatibilityContext.Provider>
  );
}