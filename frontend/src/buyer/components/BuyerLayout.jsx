import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { OtpModal } from "./OtpModal";
import { AuthRoleModal } from "../../shared/components/AuthRoleModal";
import { PrivacyPolicyModal } from "../../shared/components/PrivacyPolicyModal";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "react-i18next";

export const BuyerLayout = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat/");
  const isPropertyDetailRoute = location.pathname.startsWith("/property/") && location.pathname !== "/property/lease";
  const navigate = useNavigate();
  const { user, logout, checkAuth } = useAuth();
  
  const [showOtp, setShowOtp] = useState(false);
  const [intendedRole, setIntendedRole] = useState(null);
  const [showAuthRoleModal, setShowAuthRoleModal] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [bannerType, setBannerType] = useState(""); // 'request' | 'blocked' | 'ios'
  
  const [platformSettings, setPlatformSettings] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if(data) setPlatformSettings(data);
      })
      .catch(err => console.error("Failed to fetch platform settings", err));
  }, []);

  const { t } = useTranslation();

  useEffect(() => {
    if (!user) {
      setShowNotificationBanner(false);
      return;
    }

    const checkPermissionState = () => {
      if (!('Notification' in window)) return;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS && !isStandalone) {
        setBannerType("ios");
        setShowNotificationBanner(true);
      } else if (Notification.permission === "denied") {
        setBannerType("blocked");
        setShowNotificationBanner(true);
      } else if (Notification.permission === "default") {
        setBannerType("request");
        setShowNotificationBanner(true);
      } else {
        setShowNotificationBanner(false);
      }
    };

    checkPermissionState();
    window.addEventListener("focus", checkPermissionState);

    // Request Native Web Push permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(checkPermissionState).catch(() => {});
    }

    let lastKnownIds = new Set();
    let isFirstFetch = true;

    const checkNotifications = () => {
      fetch(`${import.meta.env.VITE_API_URL}/notifications/`, { credentials: "include" })
        .then((res) => {
          if (res.status === 401) return [];
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            const unread = data.filter((n) => !n.is_read);
            setUnreadCount(unread.length);

            // Seed initial notifications so old ones don't trigger alerts on load/login
            if (isFirstFetch) {
              data.forEach((n) => lastKnownIds.add(n.id));
              isFirstFetch = false;
              return;
            }

            // Trigger OS System Tray Web Push Notification for newly detected unread items
            if ("Notification" in window && Notification.permission === "granted") {
              unread.forEach((n) => {
                if (!lastKnownIds.has(n.id)) {
                  lastKnownIds.add(n.id);
                  try {
                    new Notification("Rentlo Alert 🔔", {
                      body: n.message,
                      icon: "/favicon.svg",
                    });
                  } catch (err) {
                    console.error(err);
                  }
                }
              });
            }
          }
        })
        .catch(() => {});
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 8000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkPermissionState);
    };
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Apply Buyer Theme & handle window themeChange event
  useEffect(() => {
    const applyBuyerTheme = (themeName) => {
      const formatted = `theme-${themeName.replace(/_/g, '-')}`;
      document.body.className = formatted;
      document.body.style.backgroundColor = "var(--bg)";
      document.body.style.color = "var(--ink)";
    };

    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem("rentlo_buyer_theme") || "monochrome_noir";
      applyBuyerTheme(savedTheme);
    };

    handleThemeChange();

    window.addEventListener("themeChange", handleThemeChange);
    return () => window.removeEventListener("themeChange", handleThemeChange);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const [legalModalTab, setLegalModalTab] = useState(null);

  const navLinks = [
    { to: "/", label: t("nav.properties", "Properties"), icon: "home_work" },
    { to: "/pricing", label: t("nav.passes", "Passes & Pricing"), icon: "confirmation_number" },
    ...(user
      ? [
          { to: "/saved-searches", label: t("nav.savedSearches", "Saved Searches"), icon: "bookmark" },
          { to: "/my-unlocks", label: t("nav.myUnlocks", "My Unlocks"), icon: "lock_open" },
        ]
      : []),
  ];

  return (
    <div style={{ backgroundColor: "var(--bg)" }} className={`${isChatRoute ? "h-[100dvh] overflow-hidden" : "min-h-screen"} flex flex-col text-ink font-sans`}>
      {/* Notification Banner Warning */}
      {showNotificationBanner && (
        <div 
          className="w-full px-4 py-2 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 border-b transition-all duration-300 animate-slide-down"
          style={{
            backgroundColor: bannerType === 'blocked' ? '#fef2f2' : '#fffbeb',
            borderColor: bannerType === 'blocked' ? '#fecaca' : '#fef3c7',
            color: bannerType === 'blocked' ? '#b91c1c' : '#b45309',
          }}
        >
          <span className="material-symbols-outlined text-lg">
            {bannerType === 'blocked' ? 'notifications_off' : bannerType === 'ios' ? 'phone_iphone' : 'notifications_active'}
          </span>
          <span>
            {bannerType === 'blocked' && (
              <>🔔 Notifications are blocked! Please click the lock icon in your browser URL bar and change Notifications to "Allow" to receive alerts.</>
            )}
            {bannerType === 'request' && (
              <>
                🔔 Enable notifications to receive instant updates. 
                <button 
                  onClick={async () => {
                    const res = await Notification.requestPermission();
                    if (res === 'granted') {
                      setShowNotificationBanner(false);
                      window.location.reload();
                    } else if (res === 'denied') {
                      setBannerType('blocked');
                    }
                  }}
                  className="ml-2 px-4 h-10 flex items-center justify-center rounded-lg text-white font-extrabold text-xs hover:opacity-90 transition-all cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  Enable Now
                </button>
              </>
            )}
            {bannerType === 'ios' && (
              <>📱 iPhone/iOS: Add this site to your Home Screen (Share and select "Add to Home Screen") to enable notifications.</>
            )}
          </span>
        </div>
      )}
      {/* Navbar */}
      <nav
        className="w-full top-0 sticky z-50 h-14 md:h-16 flex items-center transition-all duration-300 border-b shadow-sm"
        style={{
          backgroundColor: scrolled ? "rgba(10, 14, 23, 0.94)" : "rgba(10, 14, 23, 0.88)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex justify-between items-center w-full px-4 md:px-10 h-16 max-w-[1600px] mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group h-10">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.35)",
              }}
            >
              <span className="material-symbols-outlined text-[20px] text-white" data-weight="fill">real_estate_agent</span>
            </div>
            <span className="text-[21px] font-black tracking-tight text-white">
              Rentlo
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold transition-colors duration-200 flex items-center gap-2 h-10"
                style={{ color: location.pathname === link.to ? "#FFFFFF" : "rgba(255,255,255,0.75)" }}
              >
                {link.label}
                {link.badge > 0 && (
                  <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: "#FFFFFF" }}>
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}

            <div className="w-px h-5" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />

            {/* Owner Portal Quick Pill (If Owner) */}
            {user?.roles?.includes("owner") && (
              <Link
                to="/owner/dashboard"
                className="h-10 px-4 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all hover:opacity-90 shadow-sm"
                style={{
                  backgroundColor: "color-mix(in srgb, #FFFFFF 15%, transparent)",
                  borderColor: "color-mix(in srgb, #FFFFFF 35%, transparent)",
                  color: "#FFFFFF"
                }}
              >
                <span className="material-symbols-outlined text-base">real_estate_agent</span>
                {t("nav.ownerPortal", "Owner Portal")}
              </Link>
            )}

            {/* Language Translator Dropdown */}
            <LanguageToggle />

            {/* User Profile Avatar Dropdown */}
            {user ? (
              <div className="relative group">
                <button
                  className="flex items-center gap-2 p-1 pl-1 pr-2 h-10 rounded-full border transition-all cursor-pointer"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(255,255,255,0.15)"
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 text-white shadow-md border border-slate-800/40"
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>
                    {user.first_name ? user.first_name.split(" ")[0] : "Account"}
                  </span>
                  <span className="material-symbols-outlined text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
                    expand_more
                  </span>
                </button>

                {/* Dropdown Menu */}
                <div
                  className="absolute top-full right-0 mt-2 w-56 rounded-2xl border shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm font-extrabold truncate capitalize" style={{ color: "var(--ink)" }}>
                      {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username}
                    </p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "#9CA3AF" }}>
                      {user.phone || "Verified User"}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/my-unlocks"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="material-symbols-outlined text-lg" style={{ color: "var(--accent)" }}>lock_open</span>
                      {t("nav.myUnlocks", "My Unlocks")}
                    </Link>

                    <Link
                      to="/saved-searches"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="material-symbols-outlined text-lg" style={{ color: "var(--accent)" }}>bookmark</span>
                      {t("nav.savedSearches", "Saved Searches")}
                    </Link>

                    {(user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent")) && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                        style={{ color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-lg" style={{ color: "var(--accent)" }}>admin_panel_settings</span>
                        Admin Console
                      </Link>
                    )}
                    {user.roles?.includes("owner") && (
                      <Link
                        to="/owner/dashboard"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                        style={{ color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-lg" style={{ color: "var(--accent)" }}>dashboard</span>
                        {t("nav.ownerDashboard", "Owner Dashboard")}
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 border-t text-left" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-extrabold transition-colors cursor-pointer text-red-600 hover:bg-red-500/10"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      {t("nav.signOut", "Sign Out")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthRoleModal(true)}
                className="h-9 px-4 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all text-black shadow-md hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <span className="material-symbols-outlined text-base">login</span>
                {t("nav.signIn", "Sign In")}
              </button>
            )}
          </div>

          {/* Mobile Right Controls: User Avatar & Language Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  if (user.roles?.includes("owner")) {
                    navigate("/owner/dashboard");
                  } else if (user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent")) {
                    navigate("/admin");
                  } else {
                    navigate("/my-unlocks");
                  }
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-xs font-black uppercase text-white transition-all active:scale-95"
              >
                {(user.first_name || user.username || "U").charAt(0)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthRoleModal(true)}
                className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">login</span>
                <span>Sign In</span>
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </nav>


      {/* Content */}
      <main className={`flex-grow w-full flex flex-col ${isChatRoute ? "overflow-hidden" : ""}`}>
        <Outlet />
      </main>

      {showOtp && (
        <OtpModal
          intendedRole={intendedRole}
          onSuccess={() => {
            setShowOtp(false);
            checkAuth();
            if (intendedRole === "owner") {
              navigate("/owner/dashboard");
            } else {
              window.location.reload();
            }
          }}
          onClose={() => setShowOtp(false)}
        />
      )}

      <PrivacyPolicyModal 
        isOpen={Boolean(legalModalTab)} 
        initialTab={legalModalTab || "privacy"} 
        onClose={() => setLegalModalTab(null)} 
      />

      {/* Master Footer */}
      {!isChatRoute && (
        <footer className="border-t border-slate-800 py-12 pb-32 md:pb-12 mt-auto bg-black text-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b" style={{ borderColor: "var(--border)" }}>
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-black text-sm">
                  R
                </div>
                <span className="font-display font-black text-xl tracking-tight text-white">Rentlo</span>
              </div>
              <p className="text-xs text-gray-300 font-medium leading-relaxed max-w-xs">
                {t("footer.brandDescription", "India's premier 0% brokerage direct real estate discovery portal. Direct owner contacts, instant unlocks, transparent rentals.")}
              </p>
            </div>

            {/* Col 2: Quick Navigation */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4 text-white">
                {t("footer.navigation", "Navigation")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold text-gray-300">
                <li>
                  <Link to="/" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">storefront</span>
                    {t("footer.exploreProperties", "Explore Properties")}
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">confirmation_number</span>
                    {t("footer.creditPasses", "Passes & Pricing")}
                  </Link>
                </li>
                <li>
                  <Link to="/my-unlocks" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">lock_open</span>
                    {t("footer.myUnlocks", "My Unlocked Contacts")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Owner & Partner Access */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4 text-white">
                {t("footer.forPropertyOwners", "For Property Owners")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold text-gray-300">
                <li>
                  <Link to="/owner/login" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">real_estate_agent</span>
                    {t("footer.ownerPortalLogin", "Owner Portal Login")}
                  </Link>
                </li>
                <li>
                  <Link to="/owner/login?tab=signup" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">add_home</span>
                    {t("footer.postFreeListing", "Post Free Property Listing")}
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">confirmation_number</span>
                    {t("footer.buyerPasses", "Buyer Credit Passes & Pricing")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Trust & Legal */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4 text-white">
                {t("footer.legalGovernance", "Legal & Governance")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold text-gray-300">
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModalTab("privacy")}
                    className="footer-plain-btn hover:text-white font-semibold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">privacy_tip</span>
                    {t("footer.privacyPolicy", "Privacy Policy (v1.0)")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModalTab("terms")}
                    className="footer-plain-btn hover:text-white font-semibold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">gavel</span>
                    {t("footer.termsOfService", "Terms of Service & Fair Usage")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModalTab("dpdp")}
                    className="footer-plain-btn hover:text-white font-semibold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">shield</span>
                    {t("footer.dpdpRetention", "DPDP Act Data Retention Boundary")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModalTab("zero_brokerage")}
                    className="footer-plain-btn hover:text-white font-semibold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">verified_user</span>
                    {t("footer.zeroBrokerage", "Zero Brokerage Protection")}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 pb-16 md:pb-0 text-center text-xs font-medium text-gray-300">
            <p>{t("footer.copyright", `${platformSettings?.company_name || "Rentlo Technologies"} © 2026. All rights reserved.`)}</p>
          </div>
        </div>
      </footer>
      )}

      {/* 📱 NATIVE APP MOBILE BOTTOM NAVIGATION BAR FOR BUYERS / TENANTS */}
      {!isChatRoute && !isPropertyDetailRoute && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[68px] sm:h-[72px] flex items-center justify-around px-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgba(0,0,0,0.5)] transition-all duration-300 border-t"
        style={{
          backgroundColor: "rgba(10,14,23,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        {/* Tab 1: Home / Explore */}
        <Link
          to="/"
          className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 active:scale-95 py-1"
          style={{
            color: location.pathname === "/" ? "#FFFFFF" : "#94A3B8",
          }}
        >
          <span className="material-symbols-outlined text-[22px]" data-weight={location.pathname === "/" ? "fill" : "regular"}>storefront</span>
          <span className="text-[11px] font-extrabold mt-1 tracking-tight" style={{ fontWeight: location.pathname === "/" ? "800" : "600" }}>Explore</span>
        </Link>

        {/* Tab 2: Passes / Pricing */}
        <Link
          to="/pricing"
          className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 active:scale-95 py-1"
          style={{
            color: location.pathname.startsWith("/pricing") ? "#FFFFFF" : "#94A3B8",
          }}
        >
          <span className="material-symbols-outlined text-[22px]" data-weight={location.pathname.startsWith("/pricing") ? "fill" : "regular"}>confirmation_number</span>
          <span className="text-[11px] font-extrabold mt-1 tracking-tight" style={{ fontWeight: location.pathname.startsWith("/pricing") ? "800" : "600" }}>Passes</span>
        </Link>

        {/* Tab 3: CENTER HERO (+) ACTION BUTTON - Post New Listing */}
        <Link
          to={user?.roles?.includes("owner") || user?.roles?.includes("agent") ? "/owner/new-listing" : "/owner/login"}
          className="flex flex-col items-center justify-center relative -mt-7 group px-2"
        >
          <div
            className="w-[50px] h-[50px] rounded-full text-white flex items-center justify-center shadow-[0_10px_25px_rgba(99,102,241,0.5)] transition-all active:scale-90 group-hover:scale-105 border-[4px]"
            style={{ backgroundColor: "var(--accent)", borderColor: "#0A0E17", color: "#FFFFFF" }}
          >
            <span className="material-symbols-outlined text-[26px]" data-weight="fill">add</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-slate-400 group-hover:text-white transition-colors">
            Post Ad
          </span>
        </Link>

        {/* Tab 4: My Unlocks */}
        <Link
          to="/my-unlocks"
          className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 active:scale-95 py-1"
          style={{
            color: location.pathname.startsWith("/my-unlocks") ? "#FFFFFF" : "#94A3B8",
          }}
        >
          <span className="material-symbols-outlined text-[22px]" data-weight={location.pathname.startsWith("/my-unlocks") ? "fill" : "regular"}>lock_open</span>
          <span className="text-[11px] font-extrabold mt-1 tracking-tight" style={{ fontWeight: location.pathname.startsWith("/my-unlocks") ? "800" : "600" }}>Unlocks</span>
        </Link>

        {/* Tab 5: Owner / Agent Portal or Sign Out */}
        <button
          type="button"
          onClick={() => {
            if (user) {
              if (user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent")) {
                navigate("/admin");
              } else if (user.roles?.includes("owner")) {
                navigate("/owner/dashboard");
              } else {
                logout();
                navigate("/");
              }
            } else {
              setShowAuthRoleModal(true);
            }
          }}
          className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 active:scale-95 py-1 bg-transparent border-none outline-none cursor-pointer"
          style={{
            color: (location.pathname.startsWith("/owner") || location.pathname.startsWith("/admin")) ? "#FFFFFF" : "#94A3B8",
          }}
        >
          {(() => {
            if (!user) {
              return (
                <>
                  <span className="material-symbols-outlined text-[22px]" data-weight={(location.pathname.startsWith("/owner") || location.pathname.startsWith("/admin")) ? "fill" : "regular"}>person</span>
                  <span className="text-[11px] font-extrabold mt-1 tracking-tight" style={{ fontWeight: (location.pathname.startsWith("/owner") || location.pathname.startsWith("/admin")) ? "800" : "600" }}>Login</span>
                </>
              );
            } else if (user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent") || user.roles?.includes("owner")) {
              return (
                <>
                  <span className="material-symbols-outlined text-[22px]" data-weight="fill">admin_panel_settings</span>
                  <span className="text-[11px] font-extrabold mt-1 tracking-tight" style={{ fontWeight: "800" }}>Console</span>
                </>
              );
            } else {
              // Pure buyer - sign out
              return (
                <>
                  <span className="material-symbols-outlined text-[22px] text-red-400" data-weight="fill">logout</span>
                  <span className="text-[11px] font-extrabold mt-1 tracking-tight text-red-400" style={{ fontWeight: "800" }}>Sign Out</span>
                </>
              );
            }
          })()}
        </button>
      </nav>
      )}

      <AuthRoleModal isOpen={showAuthRoleModal} onClose={() => setShowAuthRoleModal(false)} />
    </div>
  );
};
