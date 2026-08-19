import React from "react";

/**
 * ConfirmDialog — reusable confirmation modal for destructive or critical actions.
 *
 * Usage:
 *   const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
 *
 *   <ConfirmDialog
 *     open={confirm.open}
 *     title={confirm.title}
 *     message={confirm.message}
 *     onConfirm={confirm.onConfirm}
 *     onCancel={() => setConfirm(p => ({ ...p, open: false }))}
 *     danger={true}  // red confirm button for destructive actions
 *   />
 */
export const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
  icon = "warning",
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 fade-in duration-150"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{
            backgroundColor: danger
              ? "rgba(220,38,38,0.1)"
              : "rgba(5,150,105,0.1)",
          }}
        >
          <span
            className="material-symbols-outlined text-[28px]"
            style={{ color: danger ? "#DC2626" : "var(--accent)" }}
          >
            {icon}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-lg font-black tracking-tight mb-1.5"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h3>

        {/* Message */}
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all hover:opacity-80"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
              backgroundColor: "var(--surface-alt)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 shadow-md"
            style={{
              backgroundColor: danger ? "#DC2626" : "var(--accent)",
              boxShadow: danger
                ? "0 4px 12px rgba(220,38,38,0.3)"
                : "0 4px 12px rgba(5,150,105,0.3)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
