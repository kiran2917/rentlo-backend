import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./shared/context/AuthContext";
import { PlatformSettingsProvider } from "./shared/context/PlatformSettingsContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Layout Imports (kept eager for instantaneous header/nav frame rendering)
import { BuyerLayout } from "./buyer/components/BuyerLayout";
import { OwnerLayout } from "./buyer/components/owner/OwnerLayout";
import { ProtectedRoute } from "./admin/components/ProtectedRoute";
import { NotificationPromptModal } from "./shared/components/NotificationPromptModal";
import { ImpersonationBanner } from "./shared/components/ImpersonationBanner";
import { playNotificationSound } from "./shared/utils/pushNotificationService";

// Auto-Retrying Lazy Loader for seamless zero-error Vercel version updates
function lazyRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn("Chunk load error detected. Refreshing assets...", error);
      if (!sessionStorage.getItem("rentlo_chunk_reloaded")) {
        sessionStorage.setItem("rentlo_chunk_reloaded", "1");
        window.location.reload();
      }
      throw error;
    }
  });
}

// Lazy-Loaded Buyer & Owner Pages
const Home = lazyRetry(() => import("./buyer/pages/Home").then(m => ({ default: m.Home })));
const PropertyDetail = lazyRetry(() => import("./buyer/pages/PropertyDetail").then(m => ({ default: m.PropertyDetail })));
const MyUnlocks = lazyRetry(() => import("./buyer/pages/MyUnlocks").then(m => ({ default: m.MyUnlocks })));
const MySavedSearches = lazyRetry(() => import("./buyer/pages/MySavedSearches").then(m => ({ default: m.MySavedSearches })));
const LeaseAgreement = lazyRetry(() => import("./buyer/pages/LeaseAgreement").then(m => ({ default: m.LeaseAgreement })));
const BuyerChat = lazyRetry(() => import("./buyer/pages/BuyerChat").then(m => ({ default: m.BuyerChat })));
const PricingPage = lazyRetry(() => import("./buyer/pages/PricingPage").then(m => ({ default: m.PricingPage })));
const BuyerLogin = lazyRetry(() => import("./buyer/pages/BuyerLogin").then(m => ({ default: m.BuyerLogin })));
const CitySeoLanding = lazyRetry(() => import("./buyer/pages/CitySeoLanding").then(m => ({ default: m.CitySeoLanding })));

const OwnerLogin = lazyRetry(() => import("./buyer/pages/owner/OwnerLogin").then(m => ({ default: m.OwnerLogin })));
const OwnerDashboard = lazyRetry(() => import("./buyer/pages/owner/OwnerDashboard").then(m => ({ default: m.OwnerDashboard })));
const OwnerLeads = lazyRetry(() => import("./buyer/pages/owner/OwnerLeads").then(m => ({ default: m.OwnerLeads })));
const OwnerVerification = lazyRetry(() => import("./buyer/pages/owner/OwnerVerification").then(m => ({ default: m.OwnerVerification })));
const OwnerNewListing = lazyRetry(() => import("./buyer/pages/owner/OwnerNewListing").then(m => ({ default: m.OwnerNewListing })));
const OwnerChat = lazyRetry(() => import("./buyer/pages/owner/OwnerChat").then(m => ({ default: m.OwnerChat })));
const OwnerVisits = lazyRetry(() => import("./buyer/pages/owner/OwnerVisits").then(m => ({ default: m.OwnerVisits })));
const OwnerPGManagement = lazyRetry(() => import("./buyer/pages/owner/OwnerPGManagement").then(m => ({ default: m.OwnerPGManagement })));
const OwnerMaintenance = lazyRetry(() => import("./buyer/pages/owner/OwnerMaintenance").then(m => ({ default: m.OwnerMaintenance })));

// Lazy-Loaded Admin Pages
const AdminLogin = lazyRetry(() => import("./admin/pages/Login").then(m => ({ default: m.Login })));
const AdminDashboard = lazyRetry(() => import("./admin/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminNotAuthorized = lazyRetry(() => import("./admin/pages/NotAuthorized").then(m => ({ default: m.NotAuthorized })));
const AdminNewListing = lazyRetry(() => import("./admin/pages/NewListing").then(m => ({ default: m.NewListing })));
const ModerationQueue = lazyRetry(() => import("./admin/pages/ModerationQueue").then(m => ({ default: m.ModerationQueue })));
const FraudFlags = lazyRetry(() => import("./admin/pages/FraudFlags").then(m => ({ default: m.FraudFlags })));
const AdminAnalytics = lazyRetry(() => import("./admin/pages/AdminAnalytics").then(m => ({ default: m.AdminAnalytics })));
const AdminEarnings = lazyRetry(() => import("./admin/pages/Earnings").then(m => ({ default: m.Earnings })));
const AgentPayouts = lazyRetry(() => import("./admin/pages/AgentPayouts").then(m => ({ default: m.AgentPayouts })));
const CommissionRules = lazyRetry(() => import("./admin/pages/CommissionRules").then(m => ({ default: m.CommissionRules })));
const AdminSettings = lazyRetry(() => import("./admin/pages/Settings").then(m => ({ default: m.Settings })));
const PropertyList = lazyRetry(() => import("./admin/pages/PropertyList").then(m => ({ default: m.PropertyList })));
const UTRVerifications = lazyRetry(() => import("./admin/pages/UTRVerifications").then(m => ({ default: m.UTRVerifications })));
const AdminLocations = lazyRetry(() => import("./admin/pages/AdminLocations").then(m => ({ default: m.AdminLocations })));
const SubAdminManagement = lazyRetry(() => import("./admin/pages/SubAdminManagement").then(m => ({ default: m.SubAdminManagement })));
const AgentManagement = lazyRetry(() => import("./admin/pages/AgentManagement").then(m => ({ default: m.AgentManagement })));
const AdminCRM = lazyRetry(() => import("./admin/pages/AdminCRM").then(m => ({ default: m.AdminCRM })));
const AdminTelemetry = lazyRetry(() => import("./admin/pages/AdminTelemetry").then(m => ({ default: m.AdminTelemetry })));
const NotFound = lazyRetry(() => import("./shared/pages/NotFound").then(m => ({ default: m.NotFound })));


// Sleek Route Loading Fallback
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Rentlo...</span>
      </div>
    </div>
  );
}

function KeyboardDismissHandler() {
  const location = useLocation();

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Automatically reset scroll position to top on route change
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return null;
}

function App() {
  useEffect(() => {
    // Listen for Service Worker push events to trigger vibration and chime sound
    const handleMessage = (event) => {
      if (event.data?.type === "NOTIFICATION_PUSH_RECEIVED") {
        playNotificationSound();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([500, 200, 500, 200, 500]);
          } catch (e) {
            // vibration not permitted or ignored
          }
        }
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <PlatformSettingsProvider>
        <ToastContainer 
          position="top-right" 
          autoClose={2500} 
          limit={1} 
          newestOnTop={true} 
          hideProgressBar={false}
          theme="light" 
        />
        <BrowserRouter>
          <ImpersonationBanner />
          <NotificationPromptModal />
          <KeyboardDismissHandler />
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* BUYER / OWNER AUTHENTICATION ROUTES */}
              <Route path="/login" element={<BuyerLogin />} />
              <Route path="/buyer/login" element={<BuyerLogin />} />
              <Route path="/owner/login" element={<OwnerLogin />} />

              {/* BUYER / OWNER ROUTES */}
              <Route element={<BuyerLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/my-unlocks" element={<MyUnlocks />} />
                <Route path="/saved-searches" element={<MySavedSearches />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/property/:id/lease" element={<LeaseAgreement />} />
                <Route path="/rent-in-:cityName" element={<CitySeoLanding />} />
                <Route path="/chat/:propertyId" element={<BuyerChat />} />
              </Route>
              
              <Route element={<OwnerLayout />}>
                <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                <Route path="/owner/leads" element={<OwnerLeads />} />
                <Route path="/owner/verification" element={<OwnerVerification />} />
                <Route path="/owner/pg-residents" element={<OwnerPGManagement />} />
                <Route path="/owner/maintenance" element={<OwnerMaintenance />} />
                <Route path="/owner/new-listing" element={<OwnerNewListing />} />
                <Route path="/owner/chat" element={<OwnerChat />} />
                <Route path="/owner/visits" element={<OwnerVisits />} />
              </Route>

              {/* ADMIN PORTAL ROUTES */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/unauthorized" element={<AdminNotAuthorized />} />

              <Route
                element={
                  <ProtectedRoute allowedRoles={["admin", "moderator", "agent"]} />
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/properties" element={<PropertyList />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["admin", "agent"]} />}>
                <Route path="/admin/listings/new" element={<AdminNewListing />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>

              <Route
                element={<ProtectedRoute allowedRoles={["admin", "moderator"]} />}
              >
                <Route path="/admin/moderation" element={<ModerationQueue />} />
                <Route path="/admin/fraud-flags" element={<FraudFlags />} />
                <Route path="/admin/users" element={<AdminCRM />} />
                <Route path="/admin/payments" element={<UTRVerifications />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/earnings" element={<AdminEarnings />} />
                <Route path="/admin/payouts" element={<AgentPayouts />} />
                <Route path="/admin/team" element={<SubAdminManagement />} />
                <Route path="/admin/agents" element={<AgentManagement />} />
                <Route path="/admin/commission-rules" element={<CommissionRules />} />
                <Route path="/admin/locations" element={<AdminLocations />} />
                <Route path="/admin/telemetry" element={<AdminTelemetry />} />
              </Route>

              {/* CATCH-ALL 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PlatformSettingsProvider>
    </AuthProvider>
  );
}

export default App;
