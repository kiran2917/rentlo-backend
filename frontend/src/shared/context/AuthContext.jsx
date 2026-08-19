import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Poll for ban/status changes if user is logged in
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return; // Only poll if we think we are logged in

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, {
          credentials: "include",
        });
        if (response.status === 401 || response.status === 403) {
          // Only invalidate session on explicit auth rejection, not on network blips
          setUser(null);
        }
      } catch (error) {
        // Log network blip silently without forcing page reload
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(intervalId);
  }, [userId]);

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout/`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error(error);
    }
    setUser(null);
    window.location.reload();
  };

  const authValue = React.useMemo(
    () => ({ user, setUser, loading, checkAuth, logout }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
