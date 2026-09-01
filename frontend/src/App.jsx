import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./shared/context/AuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Buyer & Owner Imports
import { Home } from "./buyer/pages/Home";
import { PropertyDetail } from "./buyer/pages/PropertyDetail";
import { MyUnlocks } from "./buyer/pages/MyUnlocks";
import { MySavedSearches } from "./buyer/pages/MySavedSearches";
import { BuyerLayout } from "./buyer/components/BuyerLayout";
import { LeaseAgreement } from "./buyer/pages/LeaseAgreement";
import { OwnerLayout } from "./buyer/components/owner/OwnerLayout";
import { OwnerDashboard } from "./buyer/pages/owner/OwnerDashboard";
import { OwnerLeads } from "./buyer/pages/owner/OwnerLeads";
import { OwnerVerification } from "./buyer/pages/owner/OwnerVerification";
import { OwnerNewListing } from "./buyer/pages/owner/OwnerNewListing";
import { OwnerChat } from "./buyer/pages/owner/OwnerChat";
import { OwnerVisits } from "./buyer/pages/owner/OwnerVisits";
import { OwnerPGManagement } from "./buyer/pages/owner/OwnerPGManagement";
import { OwnerMaintenance } from "./buyer/pages/owner/OwnerMaintenance";
import { BuyerChat } from "./buyer/pages/BuyerChat";
import { PricingPage } from "./buyer/pages/PricingPage";
import { BuyerLogin } from "./buyer/pages/BuyerLogin";
import { OwnerLogin } from "./buyer/pages/owner/OwnerLogin";
import { CitySeoLanding } from "./buyer/pages/CitySeoLanding";

// Admin Imports
import { ProtectedRoute } from "./admin/components/ProtectedRoute";
import { Login as AdminLogin } from "./admin/pages/Login";
import { Dashboard as AdminDashboard } from "./admin/pages/Dashboard";
import { NotAuthorized as AdminNotAuthorized } from "./admin/pages/NotAuthorized";
import { NewListing as AdminNewListing } from "./admin/pages/NewListing";
import { ModerationQueue } from "./admin/pages/ModerationQueue";
import { FraudFlags } from "./admin/pages/FraudFlags";
import { AdminAnalytics } from "./admin/pages/AdminAnalytics";
import { Earnings as AdminEarnings } from "./admin/pages/Earnings";
import { AgentPayouts } from "./admin/pages/AgentPayouts";
import { CommissionRules } from "./admin/pages/CommissionRules";
import { Settings as AdminSettings } from "./admin/pages/Settings";
import { PropertyList } from "./admin/pages/PropertyList";
import { UTRVerifications } from "./admin/pages/UTRVerifications";
import { AdminLocations } from "./admin/pages/AdminLocations";
import { SubAdminManagement } from "./admin/pages/SubAdminManagement";
import { AgentManagement } from "./admin/pages/AgentManagement";
import { AdminCRM } from "./admin/pages/AdminCRM";
import { NotFound } from "./shared/pages/NotFound";
import { NotificationPromptModal } from "./shared/components/NotificationPromptModal";
import { playNotificationSound } from "./shared/utils/pushNotificationService";

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
  const lastUpdatedRef = useRef(null);

  useEffect(() => {
    const isDashboardPath = window.location.pathname.startsWith('/admin') || (window.location.pathname.startsWith('/owner') && window.location.pathname !== '/owner/login');

    
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
      <ToastContainer 
        position="top-right" 
        autoClose={2500} 
        limit={1} 
        newestOnTop={true} 
        hideProgressBar={false}
        theme="light" 
      />
      <BrowserRouter>
        <NotificationPromptModal />
        <KeyboardDismissHandler />
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
          </Route>

          {/* Catch-all — show 404 page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
