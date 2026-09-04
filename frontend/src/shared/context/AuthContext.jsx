import React, { createContext, useContext, useState, useEffect } from "react";
import { subscribeUserToPush, unsubscribeUserFromPush } from "../utils/pushNotificationService";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState(() => {
    try {
      const saved = localStorage.getItem("rentlo_impersonation");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const checkAuth = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return data;
      } else {
        if (response.status === 401) {
          localStorage.removeItem("rentlo_access_token");
          localStorage.removeItem("rentlo_refresh_token");
          localStorage.removeItem("rentlo_impersonation");
          setImpersonation(null);
        }
        setUser(null);
        return null;
      }
    } catch (error) {
      setUser(null);
      return null;
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

  // Sync Web Push subscription quietly if user is logged in and permission is already granted
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      subscribeUserToPush().catch((err) => {
        console.error("Silent push sync error:", err);
      });
    }
  }, [userId]);

  const startImpersonation = async (targetUserId, reason = "") => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/impersonate/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: targetUserId, reason }),
    });
    const data = await res.json();
    if (res.ok) {
      const impState = {
        isImpersonating: true,
        sessionId: data.session_id,
        originalAdmin: data.impersonator,
        targetUser: data.target_user,
        startedAt: data.started_at,
      };
      localStorage.setItem("rentlo_impersonation", JSON.stringify(impState));
      setImpersonation(impState);
      await checkAuth();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
      return { success: true, data };
    } else {
      return { success: false, error: data.detail || "Failed to start support session." };
    }
  };

  const exitImpersonation = async () => {
    try {
      const impState = impersonation || JSON.parse(localStorage.getItem("rentlo_impersonation") || "{}");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/impersonate/exit/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impersonator_id: impState?.originalAdmin?.id }),
      });
      const data = await res.json();
      localStorage.removeItem("rentlo_impersonation");
      setImpersonation(null);
      await checkAuth();
      window.location.href = data.redirect_url || "/admin/crm";
      return { success: true };
    } catch (e) {
      localStorage.removeItem("rentlo_impersonation");
      setImpersonation(null);
      window.location.href = "/admin/crm";
      return { success: false };
    }
  };

  const logout = async (redirectPath = "/") => {
    try {
      // 1. Disconnect device push notifications for this user
      await unsubscribeUserFromPush();
    } catch (_) {}

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout/`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error(error);
    }
    // Clear user state immediately
    setUser(null);
    setImpersonation(null);
    // Clear any stored session data
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  };

  const authValue = React.useMemo(
    () => ({
      user,
      setUser,
      loading,
      checkAuth,
      logout,
      impersonation,
      startImpersonation,
      exitImpersonation,
    }),
    [user, loading, impersonation]
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
