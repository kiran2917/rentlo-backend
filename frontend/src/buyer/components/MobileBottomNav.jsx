import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";

const BUYER_TABS = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/pricing", icon: "confirmation_number", label: "Passes" },
  { to: "/my-unlocks", icon: "lock_open", label: "Unlocks" },
  { to: "/saved-searches", icon: "bookmark", label: "Saved" },
];

const OWNER_TABS = [
  { to: "/owner/dashboard", icon: "dashboard", label: "Dashboard" },
  { to: "/owner/leads", icon: "group", label: "Leads" },
  { to: "/owner/new-listing", icon: "add_circle", label: "Add" },
  { to: "/owner/chat", icon: "chat", label: "Chat" },
];

/**
 * MobileBottomNav — shown only on mobile (md:hidden).
 * Automatically detects buyer vs owner context by pathname.
 */
export const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isOwner = location.pathname.startsWith("/owner");
  const tabs = isOwner ? OWNER_TABS : BUYER_TABS;

  // Don't show on login pages or admin
  const hidePaths = ["/login", "/buyer/login", "/owner/login", "/admin"];
  if (hidePaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around h-[68px] pb-safe"
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.to);

        return (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-bold transition-all"
            style={{
              color: isActive ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {/* Active indicator dot */}
            <span
              className="material-symbols-outlined transition-all"
              style={{
                fontSize: isActive ? "24px" : "22px",
                fontVariationSettings: isActive
                  ? "'FILL' 1, 'wght' 600"
                  : "'FILL' 0, 'wght' 400",
              }}
            >
              {tab.icon}
            </span>
            <span className="leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
