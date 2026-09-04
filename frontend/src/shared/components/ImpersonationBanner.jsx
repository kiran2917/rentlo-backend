import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export const ImpersonationBanner = () => {
  const { impersonation, exitImpersonation } = useAuth();
  const [exiting, setExiting] = useState(false);

  if (!impersonation || !impersonation.isImpersonating) {
    return null;
  }

  const handleExit = async () => {
    setExiting(true);
    try {
      await exitImpersonation();
    } finally {
      setExiting(false);
    }
  };

  const targetName =
    impersonation.targetUser?.first_name ||
    impersonation.targetUser?.username ||
    "User";
  const targetPhone = impersonation.targetUser?.phone
    ? `+91 ${impersonation.targetUser.phone}`
    : "";
  const targetRole = (impersonation.targetUser?.role || "user").toUpperCase();
  const adminName = impersonation.originalAdmin?.username || "Admin";

  return (
    <aside
      aria-label="Support Assist Mode notification"
      className="sticky top-0 left-0 right-0 z-[99999] bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-xl px-4 py-2.5 transition-all duration-300 border-b border-amber-400/40"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left Side Info */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
          </span>

          <span className="px-2.5 py-0.5 rounded-full bg-black/30 font-black text-[10px] tracking-wider uppercase border border-white/20">
            🎭 SUPPORT ASSIST MODE
          </span>

          <span className="font-medium text-amber-50">
            Viewing as <strong className="font-extrabold text-white underline decoration-amber-300">{targetName}</strong>{" "}
            {targetPhone && <span className="opacity-90">({targetPhone})</span>}{" "}
            <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold text-[10px] ml-1">{targetRole}</span>
          </span>

          <span className="hidden md:inline-block text-amber-200/80 text-xs">
            • Session started by <strong>{adminName}</strong>
          </span>
        </div>

        {/* Right Side Action Button */}
        <button
          onClick={handleExit}
          disabled={exiting}
          className="h-8 px-4 bg-slate-950 hover:bg-black text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
        >
          {exiting ? (
            <span className="material-symbols-outlined text-[16px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[16px]">
              logout
            </span>
          )}
          <span>{exiting ? "Restoring Admin..." : "Exit Support Mode & Return"}</span>
        </button>
      </div>
    </aside>
  );
};
