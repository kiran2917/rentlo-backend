import React from "react";

export const ConfirmModal = ({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // "danger" | "warning" | "info"
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl border animate-in zoom-in-95 duration-200"
        style={{ backgroundColor: "var(--surface, #FFFFFF)", borderColor: "var(--border, #E2E8F0)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              type === "danger"
                ? "bg-red-500/10 text-red-600 border border-red-500/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {type === "danger" ? "warning" : "help"}
            </span>
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-black tracking-tight" style={{ color: "var(--ink, #0F172A)" }}>
              {title}
            </h3>
            <p className="text-xs font-semibold mt-1 leading-relaxed" style={{ color: "var(--text-muted, #64748B)" }}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t" style={{ borderColor: "var(--border, #E2E8F0)" }}>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border hover:bg-black/5 transition-all cursor-pointer"
            style={{ borderColor: "var(--border, #E2E8F0)", color: "var(--ink, #0F172A)" }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-md active:scale-95 cursor-pointer ${
              type === "danger"
                ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                : "bg-slate-950 hover:bg-slate-900 shadow-slate-900/20"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
