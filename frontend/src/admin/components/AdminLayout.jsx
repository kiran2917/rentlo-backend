import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { AgentKYCModal } from "./AgentKYCModal";

export const AdminLayout = ({ children, activeTab }) => {
  const { user, logout, checkAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);

  React.useEffect(() => {
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

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard", path: "/admin", roles: ["admin", "moderator", "agent"] },
    { id: "properties", label: "Properties", icon: "real_estate_agent", path: "/admin/properties", roles: ["admin", "moderator", "agent"] },
    { id: "moderation", label: "Moderation", icon: "gavel", path: "/admin/moderation", roles: ["admin", "moderator"] },
    { id: "fraud", label: "Fraud Flags", icon: "shield", path: "/admin/fraud-flags", roles: ["admin", "moderator"] },
    { id: "users", label: "Users & CRM", icon: "people", path: "/admin/users", roles: ["admin", "moderator"] },
    { id: "analytics", label: "Analytics", icon: "analytics", path: "/admin/analytics", roles: ["admin"] },
    { id: "payments", label: "Payments", icon: "receipt", path: "/admin/payments", roles: ["admin", "moderator"] },
    { id: "earnings", label: "Earnings", icon: "payments", path: "/admin/earnings", roles: ["admin"] },
    { id: "team", label: "Sub-Admins", icon: "manage_accounts", path: "/admin/team", roles: ["admin"] },
    { id: "agents", label: "Field Agents & KYC", icon: "badge", path: "/admin/agents", roles: ["admin"] },
    { id: "rules", label: "Rules", icon: "rule", path: "/admin/commission-rules", roles: ["admin"] },
    { id: "settings", label: "Settings", icon: "settings", path: "/admin/settings", roles: ["admin"] },
  ];

  const activeNavItem = navItems.find((item) => item.id === activeTab);
  const currentHeaderTitle = activeNavItem ? activeNavItem.label : (activeTab ? activeTab.replace(/_/g, ' ') : "Dashboard");

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isSubAdmin = userRoles.includes("sub_admin") || userRoles.includes("subadmin") || (user?.sub_admin_permissions && Object.keys(user.sub_admin_permissions).length > 0);
  const isAgent = userRoles.includes("agent");
  const subPerms = user?.sub_admin_permissions || {};

  const filteredNav = navItems.filter((item) => {
    if (userRoles.includes("admin")) return true;
    if (isSubAdmin) {
      if (item.id === "dashboard") return true;
      if (item.id === "properties" && subPerms.can_manage_properties) return true;
      if (item.id === "moderation" && subPerms.can_review_moderation) return true;
      if (item.id === "users" && subPerms.can_review_moderation) return true;
      if (item.id === "analytics" && subPerms.can_view_analytics) return true;
      if (item.id === "earnings" && subPerms.can_view_earnings) return true;
      if (item.id === "payments" && subPerms.can_view_earnings) return true;
      if (item.id === "rules" && subPerms.can_edit_settings) return true;
      if (item.id === "settings" && subPerms.can_edit_settings) return true;
      return false;
    }
    if (isAgent) {
      return ["dashboard", "properties"].includes(item.id);
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const SidebarContent = ({ onNavClick }) => (
    <>
      {/* Brand Header - Compact Height */}
      <div className="px-4 mb-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm" style={{ backgroundColor: "var(--accent)" }}>
            <span className="material-symbols-outlined text-[16px]">real_estate_agent</span>
          </div>
          <div>
            <span className="text-[16px] font-extrabold tracking-tight" style={{ color: "var(--sidebar-ink)" }}>
              Rentlo
            </span>
            <p className="text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5" style={{ color: "var(--accent-soft)" }}>
              {user?.role?.toUpperCase() || "ADMIN"} CONSOLE
            </p>
          </div>
        </Link>
      </div>

      {/* Action Button: Post New Listing - Compact Height */}
      {userRoles.some(r => ["admin", "agent"].includes(r)) && (
        <div className="px-3 mb-2">
          <Link
            to="/admin/listings/new"
            onClick={onNavClick}
            className="w-full h-9 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white flex items-center justify-center gap-2 text-[12px] font-extrabold shadow-md transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Post New Listing
          </Link>
        </div>
      )}

      {/* Navigation Links - Full Vertical Flow */}
      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                backgroundColor: isActive ? "var(--surface-alt)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--sidebar-ink)",
                borderLeft: isActive ? "4px solid var(--accent)" : "4px solid transparent",
                fontWeight: isActive ? "800" : "600",
                opacity: isActive ? 1 : 0.8,
              }}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ color: isActive ? "var(--accent)" : "var(--sidebar-ink)" }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Sign Out Button in Sidebar (Visible in Mobile Drawer too) */}
      <div className="px-3 py-2.5 mt-auto border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex font-sans antialiased transition-colors duration-300" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      {/* Desktop Sidebar */}
      <nav
        className="hidden md:flex fixed left-0 top-0 h-screen w-[240px] flex-col py-2.5 z-40 border-r transition-colors duration-300"
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        <SidebarContent onNavClick={() => {}} />
      </nav>

      {/* Mobile Overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <nav
        className={`md:hidden fixed left-0 top-0 h-full w-[280px] flex flex-col py-3 z-50 border-r transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)" }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <SidebarContent onNavClick={() => setDrawerOpen(false)} />
      </nav>

      {/* Mobile Top Bar */}
      <nav
        className="md:hidden fixed top-0 w-full flex justify-between items-center px-4 h-14 z-30 border-b"
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)", color: "var(--sidebar-ink)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: "var(--accent)" }}>
            <span className="material-symbols-outlined text-[15px]">real_estate_agent</span>
          </div>
          <span className="text-[16px] font-bold" style={{ color: "var(--sidebar-ink)" }}>Rentlo</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full font-extrabold text-[11px] flex items-center justify-center border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
            {user?.username?.charAt(0).toUpperCase() || "A"}
          </div>
          <button onClick={() => setDrawerOpen(true)} className="p-1 rounded-lg" style={{ color: "var(--sidebar-ink)" }}>
            <span className="material-symbols-outlined text-[26px]">menu</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-[240px] pt-14 md:pt-0 min-h-screen w-full max-w-full overflow-x-hidden flex flex-col transition-colors duration-300" style={{ backgroundColor: "var(--bg)" }}>
        {/* Top Navbar Header with Title and User Profile Pill on Right */}
        <header
          className="hidden md:flex h-14 items-center justify-between px-8 sticky top-0 z-30 border-b shadow-sm transition-colors duration-300"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--accent)" }}>grid_view</span>
            <h1 className="text-[15px] font-extrabold capitalize tracking-tight" style={{ color: "var(--ink)" }}>
              {currentHeaderTitle}
            </h1>
          </div>

          {/* Right Corner Navbar User Profile & Actions */}
          <div className="flex items-center gap-3">
            {isAgent && (
              user.kyc_status === 'verified' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-extrabold text-[11px] uppercase tracking-widest shadow-sm">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                  Verified Partner
                </div>
              ) : (
                <button
                  onClick={() => setShowKycModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 font-extrabold text-[11px] uppercase tracking-widest transition-all cursor-pointer shadow-sm animate-pulse hover:bg-amber-500/20"
                >
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  Complete Verification
                </button>
              )
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <div className="w-7 h-7 rounded-full font-extrabold text-[12px] flex items-center justify-center border shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--accent)", borderColor: "var(--border)" }}>
                {user?.username?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="text-left">
                <span className="text-[12px] font-extrabold block leading-none" style={{ color: "var(--ink)" }}>
                  {user?.username}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest block mt-0.5" style={{ color: "var(--accent-soft)" }}>
                  {userRoles[0] || "Admin"}
                </span>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Agent Warning Banner if KYC Pending */}
        {isAgent && user?.kyc_status !== 'verified' && (
          <div className="mx-6 md:mx-8 mt-4 p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-500 text-[22px]">warning</span>
              <div>
                <h4 className="text-[13px] font-bold text-amber-500">Karnataka Field Verification &amp; Bank Details Pending</h4>
                <p className="text-[11.5px] text-amber-400/90">
                  Please upload your Aadhaar, PAN, Selfie, and Payout UPI ID to receive instant commission payouts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowKycModal(true)}
              className="px-4 py-2 bg-amber-500 text-slate-950 text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md hover:bg-amber-400 cursor-pointer"
            >
              Complete KYC Now
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 md:p-8 flex-1">
          {children}
        </div>
      </main>

      {/* Agent KYC & Password Modal */}
      {showKycModal && (
        <AgentKYCModal
          user={user}
          onClose={() => setShowKycModal(false)}
          onRefreshUser={checkAuth}
        />
      )}
    </div>
  );
};
