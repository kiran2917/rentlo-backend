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
      // If permission is not granted (i.e. 'default' or 'denied'), show prompt
      if (state !== "granted") {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Small delay so user sees dashboard/page first
    const timer = setTimeout(checkPermissionAndPrompt, 500);

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
          navigator.vibrate([300, 150, 300]);
        } catch (_) {}
      }
      playNotificationSound();

      const result = await subscribeUserToPush();
      if (result?.success) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch (_) {}
        }
        toast.success("🔔 Instant Alerts & Notifications Enabled!");
        setIsOpen(false);
      } else if (result?.permission === "denied") {
        toast.warn("Notification permission was blocked. Please allow notifications in your browser address bar.");
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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-5 bg-slate-950/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-[430px] bg-white border border-slate-200/90 rounded-[32px] p-6 sm:p-8 shadow-[0_25px_60px_rgba(15,23,42,0.22)] text-slate-900 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Soft Ambient Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer hover:rotate-90 z-20"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Header with 3D Ringing Bell Aura */}
        <div className="flex flex-col items-center text-center mb-5 relative z-10">
          <div className="relative mb-3.5">
            <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-[22px] bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-[2px] shadow-xl shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-emerald-50 rounded-[20px] flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-emerald-600 animate-bounce" style={{ animationDuration: '2s' }}>
                  {isOwner ? "campaign" : "notifications_active"}
                </span>
              </div>
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400 border-2 border-white"></span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{isOwner ? "Instant Lead Alerts" : "Instant Property Alerts"}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {isOwner ? "Never Miss a Tenant Lead" : "Get Instant Property Alerts"}
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1.5 max-w-xs leading-relaxed">
            {isOwner
              ? "Get real-time mobile vibrations and sounds whenever a tenant unlocks your contact or sends a chat message."
              : "Be the first to know about verified new listings, instant price drops, and owner chat replies."}
          </p>
        </div>

        {/* Feature List Cards */}
        <div className="space-y-2 mb-6 relative z-10">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                {isOwner ? "bolt" : "home_pin"}
              </span>
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">
                {isOwner ? "Instant Buyer Contact Unlocks" : "Priority Fresh Listings"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                {isOwner ? "Get notified the second a buyer unlocks your number" : "Direct owner contacts posted within your preferred budget"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">vibration</span>
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">Vibration & Sound Alert</p>
              <p className="text-[11px] text-slate-500 font-medium truncate">Distinct vibration pulse so you never miss an urgent update</p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="relative z-10">
          <button
            type="button"
            disabled={isSubscribing}
            onClick={handleEnableNotifications}
            className="w-full h-13 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubscribing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enabling Alerts...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                <span>Turn On Alerts & Vibration</span>
              </>
            )}
          </button>
        </div>

        {/* Trust & Privacy Footnote */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium text-center">
          <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
          <span>Zero spam • You can disable alerts anytime in browser settings</span>
        </div>
      </div>
    </div>
  );
};

