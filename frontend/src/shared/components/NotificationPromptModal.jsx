import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { subscribeUserToPush, getNotificationPermissionState } from "../utils/pushNotificationService";
import { useAuth } from "../context/AuthContext";

export const NotificationPromptModal = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Only prompt if browser supports notifications
    const state = getNotificationPermissionState();
    if (state !== "default") {
      return;
    }

    // Check if user dismissed it recently (snoozed for 24 hours)
    const snoozeUntil = localStorage.getItem("rentlo_notif_snooze");
    if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
      return;
    }

    // Show after a slight initial delay (800ms) for smooth page load experience
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    try {
      const result = await subscribeUserToPush();
      if (result?.success) {
        toast.success("🔔 Notifications enabled! You'll receive real-time updates.");
        setIsOpen(false);
        localStorage.removeItem("rentlo_notif_snooze");
      } else if (result?.permission === "denied") {
        toast.warn("Notification permission was blocked in browser settings.");
        setIsOpen(false);
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to enable notifications:", err);
      toast.error(err.message || "Failed to turn on notifications.");
      setIsOpen(false);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    // Snooze for 24 hours so we don't spam if they decline for now
    localStorage.setItem("rentlo_notif_snooze", (Date.now() + 24 * 60 * 60 * 1000).toString());
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 md:p-8 shadow-2xl text-white transform transition-all animate-scaleUp">
        {/* Glowing badge background effect */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-emerald-500/20 rounded-full blur-xl pointer-events-none"></div>

        {/* Icon & Close */}
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-[30px] text-white animate-bounce">
              notifications_active
            </span>
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full"></span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Header */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          Turn On Push Notifications
        </h3>
        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          Stay on top of instant property alerts, owner responses, tenant inquiries, and scheduled visit updates.
        </p>

        {/* Value Points */}
        <div className="space-y-2.5 mb-6 text-xs text-slate-200">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">bolt</span>
            <span>Instant alerts for new matching listings & verified leads</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <span className="material-symbols-outlined text-teal-400 text-[18px]">chat</span>
            <span>Real-time messages from owners & prospective tenants</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified_user</span>
            <span>100% spam-free & customizable anytime in browser settings</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isSubscribing}
            onClick={handleEnableNotifications}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubscribing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Enabling...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                <span>Turn On Notifications</span>
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleDismiss}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
