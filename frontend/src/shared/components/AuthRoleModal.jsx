import React from "react";
import { useNavigate } from "react-router-dom";

export const AuthRoleModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelectRole = (portalPath, mode = "login") => {
    onClose();
    navigate(`${portalPath}?tab=${mode}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl relative border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-none"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--ink)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 w-9 h-9 rounded-full opacity-70 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)" }}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Modal Header */}
        <div className="text-center mb-8">
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest mb-3 shadow-xs border"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "var(--accent)",
              borderColor: "var(--border)",
            }}
          >
            <span className="material-symbols-outlined text-[15px]">lock_open</span>
            AUTHENTICATION PORTAL
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: "var(--ink)" }}>
            How do you want to continue?
          </h2>
          <p className="text-xs sm:text-sm font-medium mt-1 opacity-70" style={{ color: "var(--ink)" }}>
            Choose your account type below to Sign In or Register.
          </p>
        </div>

        {/* Role Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Owner / Agent Option */}
          <div
            className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
            style={{
              backgroundColor: "var(--surface-alt)",
              borderColor: "var(--border)",
            }}
          >
            <div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xs"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-[28px]">real_estate_agent</span>
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                style={{ backgroundColor: "var(--surface)", color: "var(--accent)", borderColor: "var(--border)" }}
              >
                OWNER &amp; AGENT
              </span>
              <h3 className="text-lg font-black mt-2 mb-1" style={{ color: "var(--ink)" }}>
                Property Owner
              </h3>
              <p className="text-xs font-medium leading-relaxed opacity-75" style={{ color: "var(--ink)" }}>
                Post property listings, manage buyer leads, track visit slots &amp; active passes.
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => handleSelectRole("/owner/login", "login")}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-98"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--btn-text, #ffffff)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                Sign In as Owner
              </button>
              <button
                type="button"
                onClick={() => handleSelectRole("/owner/login", "signup")}
                className="w-full py-2 rounded-xl font-bold text-xs transition-all cursor-pointer text-center border hover:opacity-90"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
              >
                Register New Owner
              </button>
            </div>
          </div>

          {/* Tenant / Buyer Option */}
          <div
            className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
            style={{
              backgroundColor: "var(--surface-alt)",
              borderColor: "var(--border)",
            }}
          >
            <div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xs"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-[28px]">home_pin</span>
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                style={{ backgroundColor: "var(--surface)", color: "var(--accent)", borderColor: "var(--border)" }}
              >
                TENANT &amp; BUYER
              </span>
              <h3 className="text-lg font-black mt-2 mb-1" style={{ color: "var(--ink)" }}>
                Tenant / Hunter
              </h3>
              <p className="text-xs font-medium leading-relaxed opacity-75" style={{ color: "var(--ink)" }}>
                Find 0% brokerage verified properties, unlock owner contacts &amp; save searches.
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => handleSelectRole("/login", "login")}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-98"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--btn-text, #ffffff)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                Sign In as Tenant
              </button>
              <button
                type="button"
                onClick={() => handleSelectRole("/login", "signup")}
                className="w-full py-2 rounded-xl font-bold text-xs transition-all cursor-pointer text-center border hover:opacity-90"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
              >
                Create Tenant Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
