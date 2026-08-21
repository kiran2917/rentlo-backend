import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { subscribeUserToPush, getNotificationPermissionState, playNotificationSound } from "../utils/pushNotificationService";
import { useAuth } from "../context/AuthContext";

export const NotificationPromptModal = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showAndroidTip, setShowAndroidTip] = useState(false);

  // Determine role: owner vs buyer
  const isOwner = 
    user?.roles?.includes("owner") || 
    user?.role === "owner" || 
    (typeof window !== "undefined" && window.location.pathname.startsWith("/owner"));

  useEffect(() => {
    // Only prompt if browser supports notifications and is not yet decided
    const state = getNotificationPermissionState();
    if (state !== "default") {
      return;
    }

    // Check if user dismissed it recently (snooze for 12 hours)
    const snoozeUntil = localStorage.getItem("rentlo_notif_snooze");
    if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
      return;
    }

    // Smooth entry delay
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 600);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    try {
      // Trigger haptic & chime immediately on user click
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([300, 150, 300]);
        } catch (_) {}
      }
      playNotificationSound();

      const result = await subscribeUserToPush();
      if (result?.success) {
        toast.success("🔔 Notifications & Vibration Enabled Successfully!");
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
    // Snooze for 12 hours
    localStorage.setItem("rentlo_notif_snooze", (Date.now() + 12 * 60 * 60 * 1000).toString());
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-white transform transition-all animate-scaleUp overflow-hidden">
        
        {/* Glowing aura effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-36 bg-emerald-500/25 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top Header & Role Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="material-symbols-outlined text-[28px] text-white animate-pulse">
                {isOwner ? "campaign" : "notifications_active"}
              </span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full"></span>
            </div>

            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                isOwner ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
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
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Dynamic Role Description */}
        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          {isOwner
            ? "Never miss a verified tenant lead, contact unlock, or visit booking. Enable instant notifications and tactile vibration so you can respond the second a buyer reaches out!"
            : "Never miss new property matches, price drops, direct owner chat replies, or visit confirmations. Enable notifications with instant vibration alerts!"}
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2.5 mb-5 text-xs text-slate-200">
          {isOwner ? (
            <>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">local_fire_department</span>
                <div>
                  <strong className="text-white block">Instant Tenant Leads & Unlocks</strong>
                  <span className="text-slate-400">Get buzzed immediately whenever a serious buyer unlocks your contact.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-teal-400 text-[20px]">calendar_month</span>
                <div>
                  <strong className="text-white block">Visit Bookings & Chat Inquiries</strong>
                  <span className="text-slate-400">Instant notification when a tenant requests a scheduled viewing slot.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">vibration</span>
                <div>
                  <strong className="text-white block">Haptic Phone Vibration & Sound</strong>
                  <span className="text-slate-400">Tactile vibration pulse and alert sound on every incoming lead.</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">home_pin</span>
                <div>
                  <strong className="text-white block">Matching Listings & Price Drops</strong>
                  <span className="text-slate-400">Be first in line when verified properties in your budget go live.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-teal-400 text-[20px]">chat</span>
                <div>
                  <strong className="text-white block">Direct Owner Replies & Approvals</strong>
                  <span className="text-slate-400">Real-time alerts when landlords respond to messages or confirm visits.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">vibration</span>
                <div>
                  <strong className="text-white block">Haptic Phone Vibration & Sound</strong>
                  <span className="text-slate-400">Tactile vibration and sound chime delivered straight to your device.</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile Setup Guide Collapsible */}
        <div className="mb-5 bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => setShowAndroidTip(!showAndroidTip)}
            className="w-full flex items-center justify-between text-left font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
              📱 Mobile Phone Vibration Setup Guide
            </span>
            <span className="material-symbols-outlined text-[16px]">
              {showAndroidTip ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showAndroidTip && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5 text-slate-300">
              <p>When you click <strong>"Turn On Notifications & Vibration"</strong>, tap <strong>"Allow"</strong> on your browser prompt.</p>
              <p><strong>To ensure vibration on Android:</strong></p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Open Chrome ➔ Settings ➔ Site Settings ➔ Notifications.</li>
                <li>Tap your site URL and ensure <strong>Vibrate is ON</strong>.</li>
                <li>Make sure your phone is not in Silent or Do Not Disturb mode.</li>
              </ol>
            </div>
          )}
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
            className="py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
