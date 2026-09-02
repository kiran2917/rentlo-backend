import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const PlatformSettingsContext = createContext(null);

const STORAGE_KEY = "rentlo_platform_settings";

const getInitialSettings = () => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Preload the logo image into browser cache immediately
      if (parsed?.company_logo_url) {
        const img = new Image();
        img.src = parsed.company_logo_url;
      }
      return parsed;
    }
  } catch (err) {
    console.error("Error reading cached platform settings:", err);
  }
  return null;
};

export const PlatformSettingsProvider = ({ children }) => {
  const [platformSettings, setPlatformSettings] = useState(getInitialSettings);
  const [loading, setLoading] = useState(!platformSettings);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`);
      if (res.ok) {
        const data = await res.json();
        setPlatformSettings(data);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (_) {}
        // Preload logo image
        if (data?.company_logo_url) {
          const img = new Image();
          img.src = data.company_logo_url;
        }
      }
    } catch (err) {
      console.error("Failed to fetch platform settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    const handleSettingsChange = () => {
      fetchSettings();
    };

    window.addEventListener("settingsChange", handleSettingsChange);
    return () => {
      window.removeEventListener("settingsChange", handleSettingsChange);
    };
  }, [fetchSettings]);

  return (
    <PlatformSettingsContext.Provider
      value={{
        platformSettings,
        setPlatformSettings,
        loading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export const usePlatformSettings = () => {
  const context = useContext(PlatformSettingsContext);
  if (!context) {
    // Return safe fallback if used outside provider
    return {
      platformSettings: getInitialSettings(),
      loading: false,
      refreshSettings: () => {},
    };
  }
  return context;
};
