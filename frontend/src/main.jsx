import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import "./buyer/i18n";
import { initTelemetry, captureException } from "./telemetry";

// Initialize distributed telemetry across Vercel and multi-cloud hosts
initTelemetry();

// Global Fetch Interceptor: Attach Bearer token for seamless cross-origin auth in Incognito & Safari
const originalFetch = window.fetch;
window.fetch = async (input, init = {}) => {
  const token = localStorage.getItem("rentlo_access_token");
  if (token) {
    init = init || {};
    if (init.headers instanceof Headers) {
      if (!init.headers.has("Authorization")) {
        init.headers.set("Authorization", `Bearer ${token}`);
      }
    } else if (Array.isArray(init.headers)) {
      if (!init.headers.some(([k]) => k.toLowerCase() === "authorization")) {
        init.headers.push(["Authorization", `Bearer ${token}`]);
      }
    } else {
      init.headers = {
        ...init.headers,
        Authorization: init.headers?.Authorization || init.headers?.authorization || `Bearer ${token}`,
      };
    }
  }

  let response = await originalFetch(input, init);

  // If request failed with 401 Unauthorized, attempt silent token refresh and retry!
  const urlStr = typeof input === "string" ? input : (input?.url || "");
  if (response.status === 401 && !urlStr.includes("/auth/refresh/") && !urlStr.includes("/auth/login/")) {
    const refreshToken = localStorage.getItem("rentlo_refresh_token");
    if (refreshToken) {
      try {
        const refreshRes = await originalFetch(`${import.meta.env.VITE_API_URL}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.access) {
            localStorage.setItem("rentlo_access_token", refreshData.access);
            if (refreshData.refresh) {
              localStorage.setItem("rentlo_refresh_token", refreshData.refresh);
            }
            // Retry the original failed request with the new access token
            const retryHeaders = {
              ...init.headers,
              Authorization: `Bearer ${refreshData.access}`,
            };
            return originalFetch(input, { ...init, headers: retryHeaders });
          }
        }
      } catch (e) {
        // Refresh failed, continue with original 401 response
      }
    }
  }

  return response;
};

// Auto-recover seamlessly when a new Vercel deployment updates chunk hashes
window.addEventListener("vite:preloadError", (event) => {
  console.warn("New deployment version detected. Refreshing assets...", event);
  window.location.reload();
});

class GlobalErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled Global UI Error:", error, errorInfo);
    // If it's a stale deployment chunk error, reload automatically
    const isChunkError = 
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed") ||
      error?.name === "ChunkLoadError";

    if (isChunkError && !sessionStorage.getItem("rentlo_chunk_reloaded")) {
      sessionStorage.setItem("rentlo_chunk_reloaded", "1");
      window.location.reload();
      return;
    }

    // Transmit crash report to Telemetry collector (Sentry / OTel)
    captureException(error, { componentStack: errorInfo?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Importing a module script failed");

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white font-sans">
          <div className="max-w-md w-full p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-[32px]">{isChunkError ? "update" : "warning"}</span>
            </div>
            <h2 className="text-xl font-extrabold mb-2 text-white">
              {isChunkError ? "New Version Deployed" : "Something Went Wrong"}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {isChunkError 
                ? "A new version of the platform was deployed. Please click reload to get the latest updates." 
                : "An unexpected user interface error occurred. Our live telemetry system has been notified."}
            </p>
            {this.state.error && !isChunkError && (
              <div className="p-3 mb-6 bg-slate-900/50 border border-slate-700 rounded-xl text-left text-xs font-mono text-slate-300 overflow-auto max-h-40">
                <div className="font-bold mb-1">{this.state.error.toString()}</div>
                <div className="text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.error.stack}</div>
              </div>
            )}
            <button
              onClick={() => {
                sessionStorage.removeItem("rentlo_chunk_reloaded");
                window.location.reload();
              }}
              className="w-full py-3 bg-white hover:bg-slate-200 text-black rounded-xl font-extrabold text-sm transition-all shadow-md cursor-pointer"
            >
              Reload &amp; Update App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);


