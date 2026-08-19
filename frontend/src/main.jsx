import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import "./buyer/i18n";
class GlobalErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled Global UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white font-sans">
          <div className="max-w-md w-full p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h2 className="text-xl font-extrabold mb-2 text-white">Something Went Wrong</h2>
            <p className="text-sm text-slate-400 mb-4">
              An unexpected user interface error occurred. Please refresh to continue.
            </p>
            {this.state.error && (
              <div className="p-3 mb-6 bg-red-950/50 border border-red-500/30 rounded-xl text-left text-xs font-mono text-red-200 overflow-auto max-h-40">
                <div className="font-bold mb-1">{this.state.error.toString()}</div>
                <div className="text-[10px] text-red-300/80 whitespace-pre-wrap">{this.state.error.stack}</div>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-extrabold text-sm transition-all shadow-md"
            >
              Reload Rentlo Platform
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

