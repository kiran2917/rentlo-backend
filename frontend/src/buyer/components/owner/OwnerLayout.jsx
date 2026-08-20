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
  
  const { t } = useTranslation();

  useEffect(() => {
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
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
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
    return () => clearInterval(interval);
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
      <div className="px-4 mb-2 pb-2 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm" style={{ backgroundColor: "var(--accent)" }}>
            <span className="material-symbols-outlined text-[16px]">real_estate_agent</span>
          </div>
          <div>
            <span className="text-[16px] font-bold tracking-tight" style={{ color: "var(--sidebar-ink)" }}>
              Rentlo
            </span>
            <p className="text-[9px] font-extrabold uppercase tracking-widest leading-none mt-0.5" style={{ color: "var(--accent)" }}>
              {isAgent ? t("owner.agentConsole", "Agent Console") : t("owner.ownerConsole", "Owner Console")}
            </p>
          </div>
        </Link>
      </div>

      {/* Top Action Button: Post New Listing - Compact Height */}
      <div className="px-3 mb-2 flex-shrink-0">
        <Link
          to="/owner/new-listing"
          onClick={onNavClick}
          className="w-full h-9 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white flex items-center justify-center gap-2 text-[12px] font-extrabold shadow-md transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
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
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                color: active ? "var(--accent)" : "var(--sidebar-ink)",
                backgroundColor: active ? "var(--surface-alt)" : "transparent",
                borderLeft: active ? "4px solid var(--accent)" : "4px solid transparent",
                fontWeight: active ? "800" : "600",
                opacity: active ? 1 : 0.8,
              }}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ color: active ? "var(--accent)" : "var(--sidebar-ink)" }}
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

  return (
    <div className="min-h-screen flex font-sans transition-colors duration-300" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r flex-col py-2.5 z-30 transition-colors duration-300"
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
        className={`md:hidden fixed left-0 top-0 h-full w-[270px] z-50 flex flex-col py-3 border-r transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-80 hover:opacity-100"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)" }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <SidebarContent onNavClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0 min-h-screen transition-colors duration-300" style={{ backgroundColor: "var(--bg)" }}>
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
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px] hidden sm:inline-block" style={{ color: "var(--accent)" }}>grid_view</span>
              <h1 className="text-[14px] sm:text-[16px] font-black truncate whitespace-nowrap" style={{ color: "var(--ink)" }} title={
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
                <div className="w-7 h-7 rounded-full font-extrabold text-[12px] flex items-center justify-center border shadow-xs text-emerald-600 bg-white shrink-0" style={{ borderColor: "var(--border)" }}>
                  {ownerInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-[12px] font-extrabold block leading-none" style={{ color: "var(--ink)" }}>
                    {user.first_name || user.username || (isAgent ? t("owner.agentRole", "Agent") : t("owner.ownerRole", "Owner"))}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest block mt-0.5" style={{ color: "var(--accent-soft)" }}>
                    {user.phone || (isAgent ? t("owner.agentRole", "Agent") : t("owner.ownerRole", "Owner"))}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-slate-400 select-none">
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
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">storefront</span>
                    <span>Explore Marketplace</span>
                  </Link>

                  <div className="border-t my-1" style={{ borderColor: "var(--border)" }}></div>

                  {/* Sign Out Button */}
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-extrabold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </div>

        {/* 📱 NATIVE APP MOBILE BOTTOM NAVIGATION BAR (Mobile App UX) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t flex items-center justify-around px-2 shadow-2xl backdrop-blur-xl transition-colors duration-300"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Tab 1: Properties / Dashboard */}
          <Link
            to="/owner/dashboard"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname === "/owner/dashboard" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: location.pathname === "/owner/dashboard" ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">grid_view</span>
            <span className="text-[9.5px] font-bold mt-0.5">Dashboard</span>
          </Link>

          {/* Tab 2: Leads */}
          <Link
            to="/owner/leads"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname.startsWith("/owner/leads") ? "var(--accent)" : "var(--text-muted)",
              fontWeight: location.pathname.startsWith("/owner/leads") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">contacts</span>
            <span className="text-[9.5px] font-bold mt-0.5">Leads</span>
          </Link>

          {/* Tab 3: CENTER HERO (+) ACTION BUTTON - Post New Listing */}
          <Link
            to="/owner/new-listing"
            className="flex flex-col items-center justify-center relative -mt-6 group"
          >
            <div
              className="w-13 h-13 rounded-full text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 group-hover:scale-105 border-4"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-soft))",
                borderColor: "var(--bg)",
              }}
            >
              <span className="material-symbols-outlined text-[26px]">add</span>
            </div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
              Add New
            </span>
          </Link>

          {/* Tab 4: Messages / Chat */}
          <Link
            to="/owner/chat"
            className="flex flex-col items-center justify-center w-14 h-full relative transition-all"
            style={{
              color: location.pathname.startsWith("/owner/chat") ? "var(--accent)" : "var(--text-muted)",
              fontWeight: location.pathname.startsWith("/owner/chat") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">forum</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="text-[9.5px] font-bold mt-0.5">Chat</span>
          </Link>

          {/* Tab 5: Visits */}
          <Link
            to="/owner/visits"
            className="flex flex-col items-center justify-center w-14 h-full transition-all"
            style={{
              color: location.pathname.startsWith("/owner/visits") ? "var(--accent)" : "var(--text-muted)",
              fontWeight: location.pathname.startsWith("/owner/visits") ? "800" : "600",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            <span className="text-[9.5px] font-bold mt-0.5">Visits</span>
          </Link>
        </nav>
      </main>
    </div>
  );
};
