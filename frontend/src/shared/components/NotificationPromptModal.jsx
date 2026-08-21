import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { subscribeUserToPush, getNotificationPermissionState, playNotificationSound } from "../utils/pushNotificationService";
import { useAuth } from "../context/AuthContext";

export const NotificationPromptModal = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testedVibration, setTestedVibration] = useState(false);

  // Determine role: owner vs buyer
  const isOwner = 
    user?.roles?.includes("owner") || 
    user?.role === "owner" || 
    (typeof window !== "undefined" && window.location.pathname.startsWith("/owner"));

  useEffect(() => {
    // Check permission state on every screen load
    const state = getNotificationPermissionState();
    
    // If not yet granted, show popup immediately on every screen visit
    if (state !== "granted") {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleTestVibration = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([500, 200, 500, 200, 500]);
        setTestedVibration(true);
      } catch (_) {}
    }
    playNotificationSound();
    toast.info("📳 Sent vibration pulse & chime to your phone!");
  };

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    try {
      // Trigger haptic pulse and chime on user click
      handleTestVibration();

      const result = await subscribeUserToPush();
      if (result?.success) {
        toast.success("🔔 Notifications & Vibration Registered Successfully!");
        setIsOpen(false);
      } else if (result?.permission === "denied") {
        toast.warn("Notification permission was blocked in browser settings. Please enable it in site settings.");
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-white transform transition-all animate-scaleUp overflow-hidden">
        
        {/* Top glowing ambient effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header & Role Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/40">
              <span className="material-symbols-outlined text-[28px] text-white animate-pulse">
                {isOwner ? "campaign" : "notifications_active"}
              </span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full"></span>
            </div>

            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                isOwner ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}>
                {isOwner ? "Owner Portal Alert" : "Instant Tenant Alerts"}
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {isOwner ? "Turn On Lead & Booking Alerts 🔔" : "Turn On Property & Chat Alerts 🔔"}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Dynamic Role Description */}
        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          {isOwner
            ? "Never miss a verified tenant lead, contact unlock, or visit booking. Enable instant notifications and tactile vibration so you can respond the second a buyer reaches out!"
            : "Never miss new property matches, price drops, direct owner chat replies, or visit confirmations. Enable notifications with instant vibration alerts!"}
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2 mb-4 text-xs text-slate-200">
          {isOwner ? (
            <>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/70">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">local_fire_department</span>
                <div>
                  <strong className="text-white block">Instant Tenant Leads & Unlocks</strong>
                  <span className="text-slate-400">Get buzzed immediately whenever a serious buyer unlocks your contact.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/70">
                <span className="material-symbols-outlined text-teal-400 text-[20px]">calendar_month</span>
                <div>
                  <strong className="text-white block">Visit Bookings & Chat Inquiries</strong>
                  <span className="text-slate-400">Instant notification when a tenant requests a scheduled viewing slot.</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/70">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">home_pin</span>
                <div>
                  <strong className="text-white block">Matching Listings & Price Drops</strong>
                  <span className="text-slate-400">Be first in line when verified properties in your budget go live.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/70">
                <span className="material-symbols-outlined text-teal-400 text-[20px]">chat</span>
                <div>
                  <strong className="text-white block">Direct Owner Replies & Approvals</strong>
                  <span className="text-slate-400">Real-time alerts when landlords respond to messages or confirm visits.</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Prominent Android Chrome Vibration Setup Guide */}
        <div className="mb-5 bg-gradient-to-br from-slate-950 to-slate-900 rounded-2xl p-3.5 border border-emerald-500/30 text-xs text-slate-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <span className="material-symbols-outlined text-[18px]">vibration</span>
              <span>📱 Mandatory Android Vibration Setup</span>
            </div>
            <button
              type="button"
              onClick={handleTestVibration}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">sensors</span>
              <span>Test Vibration</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-2">
            To ensure your phone vibrates on every incoming lead or message, complete these 3 quick steps:
          </p>

          <ol className="space-y-1.5 text-[11px] text-slate-300">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
              <span>Click <strong>"Turn On Notifications & Vibration"</strong> below and tap <strong>"Allow"</strong> on the popup.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
              <span>In Chrome on phone: Tap <strong>3 dots ⋮ ➔ Settings ➔ Notifications ➔ Notification categories ➔ Sites</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
              <span>Tap your site domain and ensure <strong>"Vibrate" is toggled ON ✅</strong>.</span>
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isSubscribing}
            onClick={handleEnableNotifications}
            className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-98"
          >
            {isSubscribing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Enabling Vibration & Alerts...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                <span>Turn On Notifications & Vibration</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Remind Me Next Time
          </button>
        </div>
      </div>
    </div>
  );
};
