import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";

export const NotAuthorized = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
          <span className="material-symbols-outlined text-[32px] text-red-500">
            block
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Access Denied
        </h1>
        <p className="text-[13px] text-slate-500 font-medium mb-8">
          You do not have the necessary permissions to view this page. This area
          is restricted to administrators and moderators.
          <br />
          <br />
          Current Role:{" "}
          <span className="font-bold text-slate-900 uppercase tracking-wide">
            {user?.role || "Unknown"}
          </span>
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full h-10 px-4 bg-slate-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors shadow-sm"
          >
            Go Back
          </button>
          <button
            onClick={handleLogout}
            className="w-full h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[13px] font-medium rounded-lg transition-colors shadow-sm"
          >
            Sign out and switch account
          </button>
        </div>
      </div>
    </div>
  );
};
