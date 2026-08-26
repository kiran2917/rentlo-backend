import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { subscribeUserToPush, getNotificationPermissionState, playNotificationSound } from "../utils/pushNotificationService";
import { useAuth } from "../context/AuthContext";

export const NotificationPromptModal = () => {
  const { user } = useAuth();
  const location = useLocation();
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

    const checkPermissionAndPrompt = () => {
      const state = getNotificationPermissionState();
      // If permission is not granted (i.e. 'default' or 'denied'), show prompt every time user opens dashboard/portal
      if (state !== "granted") {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Small delay so user sees dashboard first
    const timer = setTimeout(checkPermissionAndPrompt, 400);

    window.addEventListener("focus", checkPermissionAndPrompt);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkPermissionAndPrompt);
    };
  }, [user, location.pathname]);

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
        toast.warn("Notification permission was blocked. Please enable it in browser settings.");
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
      <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white transform transition-all overflow-hidden">
        
        {/* Soft background glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3.5 mb-3.5 pr-8">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <span className="material-symbols-outlined text-2xl text-white">
              {isOwner ? "campaign" : "notifications_active"}
            </span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-slate-950 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-slate-950 rounded-full"></span>
          </div>

          <div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isOwner ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            }`}>
              {isOwner ? "Owner Portal Alert" : "Instant Property Alert"}
            </span>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
              {isOwner ? "Turn On Lead Alerts 🔔" : "Turn On Property Alerts 🔔"}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed font-medium">
          {isOwner
            ? "Get instant vibration & lead alerts whenever a verified buyer unlocks your contact or sends you a direct message."
            : "Get instant vibration alerts for new matching homes, price drops, and direct landlord chat replies."}
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="material-symbols-outlined text-amber-400 text-lg shrink-0">
              {isOwner ? "bolt" : "home_pin"}
            </span>
            <span className="text-slate-200 font-bold leading-tight text-[11px] sm:text-xs">
              {isOwner ? "Instant Lead Alerts" : "Matching Listings"}
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0">vibration</span>
            <span className="text-slate-200 font-bold leading-tight text-[11px] sm:text-xs">Vibration & Sound</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={isSubscribing}
          onClick={handleEnableNotifications}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-98"
        >
          {isSubscribing ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              <span>Enabling Alerts...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">notifications_active</span>
              <span>Turn On Notifications & Vibration</span>
            </>
          )}
        </button>

        {/* Subtle tip */}
        <p className="text-[11px] text-slate-400 text-center mt-3.5 border-t border-slate-800/80 pt-3 leading-tight font-medium">
          💡 Tap <strong>"Allow"</strong> on the browser prompt. (Ensure phone is not on Silent mode).
        </p>
      </div>
    </div>
  );
};
