import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";

export const NotAuthorized = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    localStorage.removeItem("rentlo_access_token");
    localStorage.removeItem("rentlo_refresh_token");
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
          <span className="material-symbols-outlined text-[32px] text-red-500">
            block
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
          Admin Sign-In Required
        </h1>
        <p className="text-[13px] text-slate-600 font-medium mb-6 leading-relaxed">
          You are currently signed in as a <span className="font-bold text-slate-900 uppercase">Tenant / Buyer</span> ({user?.phone || user?.username || "Guest"}).
          <br />
          This area is strictly restricted to platform administrators, moderators, and verification agents.
        </p>

        <div className="space-y-2.5">
          <button
            onClick={() => logout("/admin/login")}
            className="w-full h-11 px-4 bg-slate-950 hover:bg-black text-white text-[13px] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            Sign in with Admin / Staff Account
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full h-10 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[13px] font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    </div>
  );
};
