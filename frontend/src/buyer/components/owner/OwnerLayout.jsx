import React, { useState, useEffect } from "react";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../shared/context/AuthContext";
import { LanguageToggle } from "../LanguageToggle";
import { useTranslation } from "react-i18next";

export const OwnerLayout = () => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [bannerType, setBannerType] = useState(""); // 'request' | 'blocked' | 'ios'
  const [platformSettings, setPlatformSettings] = useState(null);
  
  const { t } = useTranslation();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((res) => res.json())
      .then((data) => setPlatformSettings(data))
      .catch((err) => console.error("Error fetching settings", err));

    const applyDashTheme = (themeName) => {
      const formatted = `theme-${themeName.replace(/_/g, '-')}`;
      document.body.className = formatted;
      document.body.style.backgroundColor = "var(--bg)";
      document.body.style.color = "var(--ink)";
    };

    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem("rentlo_dashboard_theme") || "emerald_minimal";
      applyDashTheme(savedTheme);
    };

    handleThemeChange();

    window.addEventListener("themeChange", handleThemeChange);
    return () => window.removeEventListener("themeChange", handleThemeChange);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeMenu = () => setProfileMenuOpen(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [profileMenuOpen]);

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

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(checkPermissionState).catch(() => {});
    }

    let lastKnownIds = new Set();
    let isFirstFetch = true;

    const checkNotifications = () => {
      fetch(`${import.meta.env.VITE_API_URL}/notifications/`, { credentials: "include" })
        .then((res) => res.json())
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

            if ("Notification" in window && Notification.permission === "granted") {
              unread.forEach((n) => {
                if (!lastKnownIds.has(n.id)) {
                  lastKnownIds.add(n.id);
                  try {
                    new Notification("Rentlo Owner Alert 🔔", {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user || (!user.roles?.includes("owner") && !user.roles?.includes("agent") && user.role !== "owner" && user.role !== "agent")) {
    return <Navigate to="/" replace />;
  }

  const isAgent = user.roles?.includes("agent") || user.role === "agent";

  const navItems = [
    { to: "/owner/dashboard", label: t("owner.myProperties", "My Properties"), icon: "home_work" },
    { to: "/owner/leads", label: t("owner.leads", "Leads"), icon: "contacts" },
    { to: "/owner/visits", label: t("owner.visitSlots", "Visit Slots"), icon: "calendar_month" },
    { to: "/owner/chat", label: t("owner.messages", "Messages"), icon: "forum" },
    { to: "/owner/verification", label: t("owner.verification", "Verification"), icon: "verified" },
  ];

  const ownerInitials = (user.first_name || user.username || user.phone || "O")
    .substring(0, 2)
    .toUpperCase();

  const SidebarContent = ({ onNavClick }) => (
    <>
      {/* Brand Header - Compact Height */}
      <div className="px-4 mb-3 pb-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <Link to="/" className="flex items-center gap-3">
          {platformSettings?.company_logo_url ? (
            <img src={platformSettings.company_logo_url} alt="Company Logo" className="h-8 max-w-[120px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
              <span className="material-symbols-outlined text-base">real_estate_agent</span>
            </div>
          )}
          <div>
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--sidebar-ink)" }}>
              {platformSettings?.company_name || "Rentlo"}
            </span>
            <p className="text-xs font-extrabold uppercase tracking-widest leading-none mt-1" style={{ color: "#FFFFFF" }}>
              {isAgent ? t("owner.agentConsole", "Agent Console") : t("owner.ownerConsole", "Owner Console")}
            </p>
          </div>
        </Link>
      </div>

      {/* Top Action Button: Post New Listing - Compact Height */}
      <div className="px-4 mb-2 flex-shrink-0">
        <Link
          to="/owner/new-listing"
          onClick={onNavClick}
          className="w-full h-10 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white flex items-center justify-center gap-2 text-xs font-extrabold shadow-md transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          {t("owner.postNewListing", "Post New Listing")}
        </Link>
      </div>

      {/* Navigation Links - Full Vertical Flow */}
      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to === "/owner/dashboard" && location.pathname.startsWith("/owner/dashboard"));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavClick}
              className="flex items-center gap-4 px-4 h-10 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                color: active ? "#FFFFFF" : "var(--sidebar-ink)",
                backgroundColor: active ? "var(--surface-alt)" : "transparent",
                borderLeft: active ? "4px solid #FFFFFF" : "4px solid transparent",
                fontWeight: active ? "800" : "600",
                opacity: active ? 1 : 0.8,
              }}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: active ? "#FFFFFF" : "var(--sidebar-ink)" }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );

  const isChatRoute = location.pathname.startsWith("/owner/chat");

  return (
    <div className={`${isChatRoute ? "h-[100dvh] overflow-hidden" : "min-h-screen"} flex font-sans transition-colors duration-300`} style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r flex-col py-2 z-30 transition-colors duration-300"
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        <SidebarContent onNavClick={() => {}} />
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-[270px] z-50 flex flex-col py-4 border-r transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        {/* Close Button: 44px tap area to meet accessibility minimums */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 w-[44px] h-[44px] rounded-full flex items-center justify-center opacity-80 hover:opacity-100"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)" }}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
        <SidebarContent onNavClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 md:ml-64 flex flex-col min-w-0 transition-colors duration-300 ${isChatRoute ? "h-full overflow-hidden" : "min-h-screen"}`} style={{ backgroundColor: "var(--bg)" }}>
        {/* Notification Banner Warning */}
        {showNotificationBanner && (
          <div 
            className="w-full px-4 py-2.5 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 border-b transition-all duration-300 animate-slide-down"
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
                    className="ml-2 px-3 py-1 rounded-lg text-white font-extrabold text-xs hover:opacity-90 transition-all cursor-pointer"
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
        {/* Top Header Navbar with User Profile Pill in Right Corner */}
        <header
          className="h-14 border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm transition-colors duration-300"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg opacity-80 hover:opacity-100 transition-colors"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-xl hidden sm:inline-block" style={{ color: "#FFFFFF" }}>grid_view</span>
              <h1 className="text-sm sm:text-base font-black truncate whitespace-nowrap" style={{ color: "var(--ink)" }} title={
                location.pathname.startsWith("/owner/leads")
                  ? "Leads & Contacts"
                  : location.pathname.startsWith("/owner/visits")
                  ? "Visit Slots"
                  : location.pathname.startsWith("/owner/chat")
                  ? "Messages"
                  : location.pathname.startsWith("/owner/verification")
                  ? "Verification"
                  : location.pathname.startsWith("/owner/new-listing")
                  ? "Post New Listing"
                  : isAgent ? "Agent Console" : "Owner Dashboard"
              }>
                {location.pathname.startsWith("/owner/leads")
                  ? "Leads & Contacts"
                  : location.pathname.startsWith("/owner/visits")
                  ? "Visit Slots"
                  : location.pathname.startsWith("/owner/chat")
                  ? "Messages"
                  : location.pathname.startsWith("/owner/verification")
                  ? "Verification"
                  : location.pathname.startsWith("/owner/new-listing")
                  ? "Post New Listing"
                  : isAgent ? "Agent Console" : "Owner Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Language Translator Dropdown */}
            <LanguageToggle />

            {/* Owner Profile Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileMenuOpen(!profileMenuOpen);
                }}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl border bg-surface-alt hover:bg-surface-alt/80 border-border transition-all cursor-pointer select-none active:scale-95 shadow-sm"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
              >
                <div className="w-7 h-7 rounded-full font-extrabold text-xs flex items-center justify-center border shadow-xs text-emerald-600 bg-white shrink-0" style={{ borderColor: "var(--border)" }}>
                  {ownerInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-extrabold block leading-none" style={{ color: "var(--ink)" }}>
                    {user.first_name || user.username || (isAgent ? t("owner.agentRole", "Agent") : t("owner.ownerRole", "Owner"))}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest block mt-0.5" style={{ color: "var(--accent-soft)" }}>
                    {user.phone || (isAgent ? t("owner.agentRole", "Agent") : t("owner.ownerRole", "Owner"))}
                  </span>
                </div>
                <span className="material-symbols-outlined text-base text-slate-400 select-none">
                  {profileMenuOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                </span>
              </button>

              {profileMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Explore Marketplace Link */}
                  <Link
                    to="/"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-emerald-600">storefront</span>
                    <span>Explore Marketplace</span>
                  </Link>

                  <div className="border-t my-1" style={{ borderColor: "var(--border)" }}></div>

                  {/* Sign Out Button */}
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-extrabold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-auto ${isChatRoute ? "p-0" : "p-4 md:p-8 pb-24 md:pb-8"}`}>
          <Outlet />
        </div>

        {/* 📱 NATIVE APP MOBILE BOTTOM NAVIGATION BAR (Mobile App UX) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 border-t border-slate-800 flex items-center justify-around px-1 pb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-black transition-all duration-300">
          {/* Tab 1: Properties / Dashboard */}
          <Link
            to="/owner/dashboard"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname === "/owner/dashboard" ? "#FFFFFF" : "#9CA3AF",
              fontWeight: location.pathname === "/owner/dashboard" ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-xl">grid_view</span>
            <span className="text-xs font-bold mt-0.5">Dashboard</span>
          </Link>

          {/* Tab 2: Leads */}
          <Link
            to="/owner/leads"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname.startsWith("/owner/leads") ? "#FFFFFF" : "#9CA3AF",
              fontWeight: location.pathname.startsWith("/owner/leads") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-xl">contacts</span>
            <span className="text-xs font-bold mt-0.5">Leads</span>
          </Link>

          {/* Tab 3: CENTER HERO (+) ACTION BUTTON - Post New Listing */}
          <Link
            to="/owner/new-listing"
            className="flex flex-col items-center justify-center relative -mt-6 group"
          >
            <div
              className="w-13 h-13 rounded-full text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 group-hover:scale-105 border-4"
              style={{
                background: "linear-gradient(135deg, #FFFFFF, var(--accent-soft))",
                borderColor: "var(--bg)",
              }}
            >
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
              Add New
            </span>
          </Link>

          {/* Tab 4: Messages / Chat */}
          <Link
            to="/owner/chat"
            className="flex flex-col items-center justify-center w-14 h-full relative transition-all"
            style={{
              color: location.pathname.startsWith("/owner/chat") ? "#FFFFFF" : "#9CA3AF",
              fontWeight: location.pathname.startsWith("/owner/chat") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-xl">forum</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="text-xs font-bold mt-0.5">Chat</span>
          </Link>

          {/* Tab 5: Visits */}
          <Link
            to="/owner/visits"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname.startsWith("/owner/visits") ? "#FFFFFF" : "#9CA3AF",
              fontWeight: location.pathname.startsWith("/owner/visits") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-xl">calendar_month</span>
            <span className="text-xs font-bold mt-0.5">Visits</span>
          </Link>
        </nav>
      </main>
    </div>
  );
};
