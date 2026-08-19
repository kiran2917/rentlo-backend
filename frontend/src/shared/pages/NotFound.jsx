import React from "react";
import { Link } from "react-router-dom";

export const NotFound = () => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* Animated 404 */}
      <div className="relative mb-6">
        <span
          className="text-[120px] sm:text-[160px] font-black leading-none select-none"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-soft))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: 0.15,
          }}
        >
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "72px", color: "var(--accent)" }}
          >
            home_work
          </span>
        </div>
      </div>

      <h1
        className="text-2xl sm:text-3xl font-black tracking-tight mb-3"
        style={{ color: "var(--ink)" }}
      >
        Page Not Found
      </h1>
      <p
        className="text-sm sm:text-base max-w-sm mb-8"
        style={{ color: "var(--text-muted)" }}
      >
        The page you're looking for doesn't exist or has been moved. Let's get
        you back on track.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/"
          className="px-6 py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-lg"
          style={{ backgroundColor: "var(--accent)", boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Back to Home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 rounded-2xl text-sm font-bold border flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-muted)",
            backgroundColor: "var(--surface)",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Go Back
        </button>
      </div>
    </div>
  );
};
