import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { OtpModal } from "./OtpModal";
import { AuthRoleModal } from "../../shared/components/AuthRoleModal";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "react-i18next";

export const BuyerLayout = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat/");
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
      const savedTheme = localStorage.getItem("rentlo_buyer_theme") || "emerald_minimal";
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

  const [legalModal, setLegalModal] = useState(null);

  const legalPolicies = {
    privacy: {
      title: "Privacy Policy (v1.0) & DPDP Act 2023 Compliance",
      content: `1. DATA FIDUCIARY IDENTIFICATION
Rentlo Technologies operates as the designated Data Fiduciary under India's Digital Personal Data Protection (DPDP) Act 2023. We collect Personally Identifiable Information (PII) including verified mobile numbers, email addresses, and location data exclusively for enabling zero-brokerage property transactions.

2. LAWFUL BASIS & AFFIRMATIVE CONSENT
Personal data processing occurs strictly upon explicit, affirmative consent granted during SMS OTP login or registration. Consent records are logged with timestamp and versioning (v1.0).

3. DATA ENCRYPTION & SECURITY CONTROLS
Session credentials are stored in HttpOnly, SameSite=Lax JWT cookies. All database PII fields are protected by TLS 1.3 in transit and AES-256 encryption at rest.

4. USER DATA RIGHTS & GRIEVANCE OFFICER
You possess statutory rights under the DPDP Act 2023:
• Right to Access summary of processed personal data.
• Right to Correction of inaccurate or outdated property details.
• Right to Erasure of personal data via automated atomic data erasure.
For grievances, contact our Data Protection Officer at privacy@rentlo.in.`
    },
    terms: {
      title: "Terms of Service & Fair Usage Policy",
      content: `1. PLATFORM SCOPE & ELIGIBILITY
Rentlo provides a direct peer-to-peer real estate discovery portal connecting verified property owners with buyers and tenants across India. Users must be at least 18 years of age to register or initiate contact unlocks.

2. LISTING VERIFICATION & OWNER ACCURACY MANDATE
Property owners warrant that submitted residential, apartment/PG, or commercial listings reflect genuine, currently available properties with accurate pricing and coordinates. Submitting false pricing or misleading images violates platform integrity.

3. PROHIBITED ACTIVITIES & ACCOUNT SUSPENSION
The following activities are strictly prohibited:
• Automated scraping or harvesting of owner contact numbers.
• Unauthorized commercial reselling of lead data to third-party brokers.
• Harassment or fraudulent payment solicitation.
Violations trigger immediate account termination and IP-address blacklisting.

4. CONTACT UNLOCK & PASS LICENSE
Purchasing a contact unlock or buyer credit pass grants a non-transferable, limited license to contact the designated property owner for personal rental inquiry purposes.`
    },
    dpdp: {
      title: "DPDP Act Data Retention & Erasure Boundaries",
      content: `1. DATA RETENTION SPECIFICATIONS
Rentlo retains user profile data and transaction logs only as long as necessary to fulfill real estate inquiry processing and financial reporting mandates under Indian tax laws.

2. ATOMIC DATA ERASURE PROTOCOL
You have the unconditional right to request total deletion of your personal data at any time. Invoking the Atomic Data Erasure endpoint (POST /api/v1/auth/data-erasure/) executes a single database transaction that:
• Anonymizes user phone, email, and profile credentials.
• Clears saved search criteria and alert preferences.
• Scrubs outgoing chat messages and inquiry history.

3. ZERO UNAUTHORIZED THIRD-PARTY DATA SHARING
Rentlo never sells, rents, or shares user PII with third-party telemarketers or external broker agencies.`
    },
    zero_brokerage: {
      title: "Zero Brokerage Protection Guarantee & Fraud Prevention",
      content: `1. 100% DIRECT OWNER GUARANTEE
Rentlo operates on a zero-brokerage business model. Buyers and tenants connect directly with verified property owners without paying traditional 1-2 month broker fees.

2. REPORTING EXTORTION OR THIRD-PARTY BROKER CLAIMS
If any individual posing as an owner demands a broker commission, security deposit prior to physical property inspection, or key delivery fee for a listing on Rentlo:
• Click 'Report Fraud' on the property listing page immediately.
• Do NOT transfer money outside the official Rentlo payment gateway.

3. INVALID LEAD REFUND POLICY
If an unlocked phone number belongs to an offline or unverified third party, submit an unlock feedback report within 48 hours for an instant credit pass refund.`
    }
  };

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
          backgroundColor: "var(--header-bg)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          background: scrolled ? "color-mix(in srgb, var(--header-bg) 80%, transparent)" : "var(--header-bg)",
        }}
      >
        <div className="flex justify-between items-center w-full px-4 md:px-10 h-16 max-w-[1600px] mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-4 group h-10">
            {platformSettings?.company_logo_url ? (
              <img src={platformSettings.company_logo_url} alt="Company Logo" className="h-8 max-w-[140px] object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFFFFF" }}>
                <span className="material-symbols-outlined text-lg text-white" data-weight="fill">real_estate_agent</span>
              </div>
            )}
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--header-ink)" }}>
              {platformSettings?.company_name || "Rentlo"}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold transition-colors duration-200 flex items-center gap-2 h-10"
                style={{ color: location.pathname === link.to ? "#FFFFFF" : "var(--header-ink)" }}
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
                {/* ⚠️ FLAG: Avatar button is potentially < 44px total hit area. Added h-10 to enforce minimum. */}
                <button
                  className="flex items-center gap-2 p-1 pl-1 pr-2 h-10 rounded-full border transition-all cursor-pointer"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(255,255,255,0.15)"
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white uppercase shadow-sm"
                    style={{ backgroundColor: "#FFFFFF" }}
                  >
                    {(user.first_name ? user.first_name.charAt(0) : (user.username && user.username.startsWith("buyer_") ? "B" : user.username?.charAt(0) || "U"))}
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--header-ink)" }}>
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
                      <span className="material-symbols-outlined text-lg" style={{ color: "#FFFFFF" }}>lock_open</span>
                      {t("nav.myUnlocks", "My Unlocks")}
                    </Link>

                    <Link
                      to="/saved-searches"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="material-symbols-outlined text-lg" style={{ color: "#FFFFFF" }}>bookmark</span>
                      {t("nav.savedSearches", "Saved Searches")}
                    </Link>

                    {(user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent")) && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                        style={{ color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-lg" style={{ color: "#FFFFFF" }}>admin_panel_settings</span>
                        Admin Console
                      </Link>
                    )}
                    {user.roles?.includes("owner") && (
                      <Link
                        to="/owner/dashboard"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                        style={{ color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-lg" style={{ color: "#FFFFFF" }}>dashboard</span>
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
                className="h-9 px-4 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all text-white shadow-md hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <span className="material-symbols-outlined text-base">login</span>
                {t("nav.signIn", "Sign In")}
              </button>
            )}
          </div>

          {/* Mobile: user avatar + hamburger */}
          <div className="md:hidden flex items-center gap-3">
            {user && (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold uppercase" style={{ color: "#FFFFFF" }}>
                {(user.first_name || "U").charAt(0)}
              </div>
            )}
            <LanguageToggle />
            <button type="button" aria-label="Open Mobile Menu" onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg" style={{ color: "var(--header-ink)" }}>
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed top-0 right-0 h-full w-[280px] z-[70] flex flex-col py-6 transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ backgroundColor: "var(--header-bg)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Close + Logo */}
        <div className="flex items-center justify-between px-5 mb-8">
          <div className="flex items-center gap-2">
            {platformSettings?.company_logo_url ? (
              <img src={platformSettings.company_logo_url} alt="Company Logo" className="h-7 max-w-[120px] object-contain" />
            ) : (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFFFFF" }}>
                <span className="material-symbols-outlined text-base text-white">real_estate_agent</span>
              </div>
            )}
            <span className="text-base font-bold" style={{ color: "var(--header-ink)" }}>
              {platformSettings?.company_name || "Rentlo"}
            </span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--header-ink)" }}>
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="mx-5 mb-6 p-4 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--header-ink)" }}>{user.username}</p>
            <p className="text-xs font-medium" style={{ color: "#FFFFFF" }}>{user.roles?.join(", ") || "Buyer"}</p>
          </div>
        )}

        {/* Nav Links */}
        <div className="flex-1 px-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                color: location.pathname === link.to ? "#FFFFFF" : "rgba(255,255,255,0.75)",
                backgroundColor: location.pathname === link.to ? "var(--nav-active-bg)" : "transparent",
              }}
            >
              <span className="material-symbols-outlined text-lg" style={{ color: location.pathname === link.to ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>{link.icon}</span>
              {link.label}
              {link.badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: "#FFFFFF" }}>{link.badge}</span>
              )}
            </Link>
          ))}
 
          {(user?.roles?.includes("admin") || user?.roles?.includes("moderator") || user?.roles?.includes("agent")) && (
            <Link
              to="/admin"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: "#FFFFFF", backgroundColor: "var(--nav-active-bg)" }}
            >
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              Admin Console
            </Link>
          )}
          {user?.roles?.includes("owner") && (
            <Link
              to="/owner/dashboard"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: "#FFFFFF", backgroundColor: "var(--nav-active-bg)" }}
            >
              <span className="material-symbols-outlined text-lg">dashboard</span>
              Owner Dashboard
            </Link>
          )}
        </div>

        {/* Bottom CTAs */}
        <div className="px-4 mt-4 space-y-3">

          {user && (
            <button
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className="w-full h-12 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors text-red-600 hover:bg-red-500/10"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-alt)" }}
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Sign Out
            </button>
          )}
        </div>
      </div>

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

      {legalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setLegalModal(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-all cursor-pointer"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-2xl text-emerald-500">gavel</span>
              <h3 className="text-lg font-extrabold text-slate-900">{legalModal.title}</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6 whitespace-pre-line">
              {legalModal.content}
            </p>
            <button
              onClick={() => setLegalModal(null)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all cursor-pointer"
            >
              Close &amp; Accept Policy
            </button>
          </div>
        </div>
      )}

      {/* Master Footer */}
      {!isChatRoute && (
        <footer className="border-t border-slate-800 py-12 pb-32 md:pb-12 mt-auto bg-black text-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b" style={{ borderColor: "var(--border)" }}>
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                {platformSettings?.company_logo_url ? (
                  <img src={platformSettings.company_logo_url} alt="Company Logo" className="h-8 max-w-[120px] object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: "#FFFFFF" }}>
                    <span className="material-symbols-outlined text-lg text-white">real_estate_agent</span>
                  </div>
                )}
                <span className="text-lg font-black tracking-tight" className="text-white">
                  {platformSettings?.company_name || "Rentlo"}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed" className="text-gray-300">
                {t("footer.desc", "Zero-Brokerage Real Estate Ecosystem. Directly connecting buyers, tenants, and property owners across India.")}
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                {t("footer.dpdpCompliant", "• DPDP Act 2023 Compliant Baseline")}
              </p>
            </div>

            {/* Col 2: Login Portals */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4" className="text-white">
                {t("footer.accessPortals", "Access Portals & Login")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold" className="text-gray-300">
                <li>
                  <Link to="/login" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">person</span>
                    {t("footer.tenantLogin", "Tenant & Buyer Login")}
                  </Link>
                </li>
                <li>
                  <Link to="/owner/login" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">add_home</span>
                    {t("footer.ownerLogin", "Landlord & Owner Login")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Platform Features */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4" className="text-white">
                {t("footer.platformServices", "Platform Services")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold" className="text-gray-300">
                <li>
                  <Link to="/" className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-base text-white">home_work</span>
                    {t("footer.exploreCatalog", "Explore Property Catalog")}
                  </Link>
                </li>
                {user && (
                  <>
                    <li>
                      <Link to="/my-unlocks" className="flex items-center gap-2 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-base text-white">lock_open</span>
                        {t("footer.myUnlocks", "My Contact Unlocks")}
                      </Link>
                    </li>
                    <li>
                      <Link to="/saved-searches" className="flex items-center gap-2 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-base text-white">bookmark</span>
                        {t("footer.savedSearches", "Saved Search Alerts")}
                      </Link>
                    </li>
                  </>
                )}
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
              <h4 className="text-xs font-extrabold uppercase tracking-wider mb-4" className="text-white">
                {t("footer.legalGovernance", "Legal & Governance")}
              </h4>
              <ul className="space-y-2.5 text-sm font-semibold" className="text-gray-300">
                <li>
                  <button
                    onClick={() => setLegalModal(legalPolicies.privacy)}
                    className="footer-plain-btn hover:text-white font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">privacy_tip</span>
                    {t("footer.privacyPolicy", "Privacy Policy (v1.0)")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setLegalModal(legalPolicies.terms)}
                    className="footer-plain-btn hover:text-white font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">gavel</span>
                    {t("footer.termsOfService", "Terms of Service & Fair Usage")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setLegalModal(legalPolicies.dpdp)}
                    className="footer-plain-btn hover:text-white font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">shield</span>
                    {t("footer.dpdpRetention", "DPDP Act Data Retention Boundary")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setLegalModal(legalPolicies.zero_brokerage)}
                    className="footer-plain-btn hover:text-white font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-white shrink-0">verified_user</span>
                    {t("footer.zeroBrokerage", "Zero Brokerage Protection")}
                  </button>
                </li>
              </ul>
            </div>
          </div>


          <div className="pt-6 pb-16 md:pb-0 text-center text-xs font-medium" className="text-gray-300">
            <p>{t("footer.copyright", `${platformSettings?.company_name || "Rentlo Technologies"} © 2026. All rights reserved.`)}</p>
          </div>
        </div>
      </footer>
      )}

      {/* 📱 NATIVE APP MOBILE BOTTOM NAVIGATION BAR FOR BUYERS / TENANTS */}
      {!isChatRoute && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 border-t border-slate-800 flex items-center justify-around px-1 pb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-black transition-all duration-300">
        {/* Tab 1: Home / Explore */}
        <Link
          to="/"
          className="flex flex-col items-center justify-center w-14 h-full transition-all"
          style={{
            color: location.pathname === "/" ? "#FFFFFF" : "#9CA3AF",
            fontWeight: location.pathname === "/" ? "800" : "600",
          }}
        >
          <span className="material-symbols-outlined text-lg">storefront</span>
          <span className="text-[10px] font-bold mt-0.5">Explore</span>
        </Link>

        {/* Tab 2: Passes / Pricing */}
        <Link
          to="/pricing"
          className="flex flex-col items-center justify-center w-14 h-full transition-all"
          style={{
            color: location.pathname.startsWith("/pricing") ? "#FFFFFF" : "#9CA3AF",
            fontWeight: location.pathname.startsWith("/pricing") ? "800" : "600",
          }}
        >
          <span className="material-symbols-outlined text-lg">confirmation_number</span>
          <span className="text-[10px] font-bold mt-0.5">Passes</span>
        </Link>

        {/* Tab 3: CENTER HERO (+) ACTION BUTTON - Post New Listing */}
        <Link
          to={user?.roles?.includes("owner") || user?.roles?.includes("agent") ? "/owner/new-listing" : "/owner/login"}
          className="flex flex-col items-center justify-center relative -mt-6 group"
        >
          <div
            className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.2)] transition-transform active:scale-95 group-hover:scale-105 border-[4px]"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#000000", color: "#000000" }}
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80" style={{ color: "#9CA3AF" }}>
            Post Ad
          </span>
        </Link>

        {/* Tab 4: My Unlocks */}
        <Link
          to="/my-unlocks"
          className="flex flex-col items-center justify-center w-14 h-full transition-all"
          style={{
            color: location.pathname.startsWith("/my-unlocks") ? "#FFFFFF" : "#9CA3AF",
            fontWeight: location.pathname.startsWith("/my-unlocks") ? "800" : "600",
          }}
        >
          <span className="material-symbols-outlined text-lg">lock_open</span>
          <span className="text-[10px] font-bold mt-0.5">Unlocks</span>
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
          className="flex flex-col items-center justify-center w-14 h-full transition-all bg-transparent border-none outline-none cursor-pointer"
          style={{
            color: (location.pathname.startsWith("/owner") || location.pathname.startsWith("/admin")) ? "#FFFFFF" : "#9CA3AF",
            fontWeight: (location.pathname.startsWith("/owner") || location.pathname.startsWith("/admin")) ? "800" : "600",
          }}
        >
          {(() => {
            if (!user) {
              return (
                <>
                  <span className="material-symbols-outlined text-lg">person</span>
                  <span className="text-[10px] font-bold mt-0.5">Login</span>
                </>
              );
            } else if (user.roles?.includes("admin") || user.roles?.includes("moderator") || user.roles?.includes("agent") || user.roles?.includes("owner")) {
              return (
                <>
                  <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                  <span className="text-[10px] font-bold mt-0.5">Console</span>
                </>
              );
            } else {
              // Pure buyer - sign out
              return (
                <>
                  <span className="material-symbols-outlined text-lg text-red-500">logout</span>
                  <span className="text-[10px] font-bold mt-0.5 text-red-500">Sign Out</span>
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
