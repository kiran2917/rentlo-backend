import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { subscribeUserToPush, getNotificationPermissionState, playNotificationSound } from "../utils/pushNotificationService";
import { useAuth } from "../context/AuthContext";

export const NotificationPromptModal = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Determine role: owner vs buyer
  const isOwner = 
    user?.roles?.includes("owner") || 
    user?.role === "owner" || 
    (typeof window !== "undefined" && window.location.pathname.startsWith("/owner"));

  useEffect(() => {
    // ONLY prompt if the user is registered/logged in
    if (!user) {
      setIsOpen(false);
      return;
    }

    // Check permission state on screen load
    const state = getNotificationPermissionState();
    
    // If not yet granted, show popup
    if (state !== "granted") {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    try {
      // Trigger instant vibration pulse & audio chime
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([500, 200, 500, 200, 500]);
        } catch (_) {}
      }
      playNotificationSound();

      const result = await subscribeUserToPush();
      if (result?.success) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([500, 200, 500, 200, 500]);
          } catch (_) {}
        }
        toast.success("🔔 Notifications & Vibration Enabled!");
        setIsOpen(false);
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
    setIsOpen(false);
  };

  // Only render for logged-in users who haven't enabled notifications yet
  if (!user || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl text-white transform transition-all animate-scaleUp overflow-hidden">
        
        {/* Soft background glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3.5 mb-3 pr-8">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
            <span className="material-symbols-outlined text-[26px] text-white">
              {isOwner ? "campaign" : "notifications_active"}
            </span>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full"></span>
          </div>

          <div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isOwner ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            }`}>
              {isOwner ? "Owner Portal Alert" : "Instant Property Alert"}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
              {isOwner ? "Turn On Lead Alerts 🔔" : "Turn On Property Alerts 🔔"}
            </h3>
          </div>
        </div>

        {/* Simple Description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
          {isOwner
            ? "Get instant vibration & lead alerts whenever a verified buyer unlocks your contact or sends you a direct message."
            : "Get instant vibration alerts for new matching homes, price drops, and direct landlord chat replies."}
        </p>

        {/* 2 Simple Feature Cards */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="material-symbols-outlined text-amber-400 text-[18px] shrink-0">
              {isOwner ? "bolt" : "home_pin"}
            </span>
            <span className="text-slate-200 font-medium leading-tight">
              {isOwner ? "Instant Lead Alerts" : "Matching Listings"}
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">vibration</span>
            <span className="text-slate-200 font-medium leading-tight">Vibration & Sound</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={isSubscribing}
          onClick={handleEnableNotifications}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-98"
        >
          {isSubscribing ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              <span>Enabling Alerts...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              <span>Turn On Notifications & Vibration</span>
            </>
          )}
        </button>

        {/* Secondary Dismiss Button */}
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer py-1"
          >
            Maybe Later
          </button>
        </div>

        {/* Subtle tip */}
        <p className="text-[10px] text-slate-400 text-center mt-2.5 border-t border-slate-800 pt-2.5 leading-tight">
          💡 Tap <strong>"Allow"</strong> on the popup prompt. (Ensure phone is not on Silent mode).
        </p>
      </div>
    </div>
  );
};
