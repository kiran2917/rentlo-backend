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

  // Subscribe to Web Push notifications when user logs in
  useEffect(() => {
    if (!userId) return;

    const subscribeToPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log("Web Push is not supported in this browser.");
        return;
      }

      try {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") {
          console.log("Notification permission not granted.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        const keyRes = await fetch(`${import.meta.env.VITE_API_URL}/notifications/vapid-public-key/`, {
          credentials: "include"
        });
        if (!keyRes.ok) throw new Error("Failed to fetch VAPID public key");
        const keyData = await keyRes.json();
        const public_key = keyData.public_key;
        if (!public_key) return;

        const padding = '='.repeat((4 - public_key.length % 4) % 4);
        const base64 = (public_key + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        const applicationServerKey = outputArray;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
        }

        await fetch(`${import.meta.env.VITE_API_URL}/notifications/subscribe-web-push/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(subscription.toJSON())
        });
        console.log("Successfully registered Web Push subscription on backend!");
      } catch (err) {
        console.error("Failed to subscribe to Web Push:", err);
      }
    };

    const timer = setTimeout(subscribeToPush, 2000);
    return () => clearTimeout(timer);
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
    // Clear user state immediately
    setUser(null);
    // Clear any stored session data
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    // Hard redirect to home — do NOT reload() as that re-runs checkAuth with stale cookies
    window.location.href = "/";
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
