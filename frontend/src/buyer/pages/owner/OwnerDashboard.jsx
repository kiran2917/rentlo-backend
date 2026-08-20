import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/context/AuthContext";
import { toast } from "react-toastify";
import { loadRazorpayScript } from "../../../shared/utils/razorpayLoader";
import { PropertyImageSlideshow } from "../../../shared/components/PropertyImageSlideshow";
import { Translate } from "../../../shared/components/Translate";

export const OwnerDashboard = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [ownerCredits, setOwnerCredits] = useState({ has_active_credits: false, total_credits_remaining: 0, active_passes: [] });
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [buyingPassLoading, setBuyingPassLoading] = useState(false);
  const [selectedPassCategory, setSelectedPassCategory] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);

  const [editingBedProp, setEditingBedProp] = useState(null);
  const [bedForm, setBedForm] = useState({ total_beds: 0, available_beds: 0 });
  const [updatingBeds, setUpdatingBeds] = useState(false);

  const fetchProperties = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    fetch(`${import.meta.env.VITE_API_URL}/properties/owner-credits/`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOwnerCredits(data);
      })
      .catch((err) => console.error("Could not fetch owner credits:", err));

    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPlatformSettings(data);
      })
      .catch((err) => console.error("Could not fetch platform settings:", err));
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleStatusUpdate = async (propertyId, newStatus) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/${propertyId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        const messages = {
          under_negotiation: "⏸️ Property put Under Negotiation. New unlocks paused.",
          rented: "🏠 Property marked as Rented!",
          live: "✅ Property is now Live & open for new buyers!",
        };
        toast.success(messages[newStatus] || `Status updated to ${newStatus}`);
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propertyId ? { ...p, status: newStatus } : p
          )
        );
      } else {
        toast.error("Failed to update property status.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const handlePGOccupancy = async (propId, action, customPayload = {}) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propId}/update-occupancy/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...customPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`PG bed status updated! Free beds: ${data.available_beds}`);
        setProperties((prev) =>
          prev.map((p) => (p.id === propId ? {
            ...p,
            available_beds: data.available_beds ?? p.available_beds,
            total_beds: data.total_beds ?? p.total_beds,
            pg_rules: data.pg_rules || p.pg_rules,
          } : p))
        );
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to update PG occupancy");
        return false;
      }
    } catch (e) {
      toast.error("Error updating PG occupancy: " + e.message);
      return false;
    }
  };

  const CATEGORY_PLANS = {
    residential: {
      label: "Residential House / Villa / Flat",
      shortLabel: "Residential",
      icon: "home",
      badge: "Ind. House, Villa, Plots",
      description: "For independent houses, villas, builder floors, family apartments & plots",
      plans: [
        {
          id: "single",
          name: "Single Listing Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_residential_fee) : 99,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Residential Listing Credit", "Direct Owner WhatsApp Contact", "Exact Map Pin Navigation", "Instant Buyer Inquiries"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_residential_3pack_price) : 259,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 3) : 297,
          badge: "MOST POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_3pack_price) / (Number(platformSettings.owner_residential_fee) * 3))) * 100)}%` : "Save 13%",
          highlight: true,
          features: ["3 Residential Listing Credits", "WhatsApp Tenant Broadcast", "Verified Owner Ribbon", "Credits Never Expire"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_residential_6pack_price) : 499,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 6) : 594,
          badge: "BEST VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_6pack_price) / (Number(platformSettings.owner_residential_fee) * 6))) * 100)}%` : "Save 16%",
          features: ["6 Residential Listing Credits", "Top Search Placement Badge", "Free Rental Agreement Drafts", "High-Priority Verification"],
        },
        {
          id: "10pack",
          name: "10-Pack Builder Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_residential_10pack_price) : 859,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 10) : 990,
          badge: "PRO BUILDER",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_10pack_price) / (Number(platformSettings.owner_residential_fee) * 10))) * 100)}%` : "Save 14%",
          features: ["10 Residential Listing Credits", "Featured Property Ribbon", "Dedicated Account Manager", "Bulk Multi-Unit Import"],
        },
      ],
    },
    apartment: {
      label: "Apartment & PG / Co-Living",
      shortLabel: "Apartment & PG",
      icon: "apartment",
      badge: "Flats, PG, Hostels",
      description: "For gated apartments, PG rooms, hostels & shared co-living spaces",
      plans: [
        {
          id: "single",
          name: "Single Listing Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_fee) : 149,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Apartment/PG Listing Credit", "Room & Bed Capacity Tracker", "Direct Student/Working Lead Chat", "Instant Contact Access"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_3pack_price) : 349,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 3) : 447,
          badge: "MOST POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_3pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 3))) * 100)}%` : "Save 22%",
          highlight: true,
          features: ["3 Apartment/PG Credits", "Realtime Bed Occupancy Sync", "WhatsApp Buyer Broadcast", "Zero Commission Tag"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_6pack_price) : 649,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 6) : 894,
          badge: "VIP VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_6pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 6))) * 100)}%` : "Save 27%",
          features: ["6 Apartment/PG Credits", "Top Search Placement Badge", "Free Rental Agreement Drafts", "High-Priority Verification"],
        },
        {
          id: "10pack",
          name: "10-Pack Hostel Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_10pack_price) : 999,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 10) : 1490,
          badge: "HOSTEL OWNER",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_10pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 10))) * 100)}%` : "Save 33%",
          features: ["10 Apartment/PG Credits", "Full Hostel Inventory Management", "Unlimited Bed Status Edits", "Dedicated Support"],
        },
      ],
    },
    commercial: {
      label: "Commercial Space & Shop",
      shortLabel: "Commercial",
      icon: "store",
      badge: "Shop, Office, Warehouse",
      description: "For retail shops, office spaces, warehouses, showrooms & industrial spaces",
      plans: [
        {
          id: "single",
          name: "Single Commercial Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_commercial_fee) : 199,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Commercial Property Submission", "Office/Seating Details Tag", "Direct Corporate Business Leads", "Full Search Indexing"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_commercial_3pack_price) : 449,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 3) : 597,
          badge: "POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_3pack_price) / (Number(platformSettings.owner_commercial_fee) * 3))) * 100)}%` : "Save 25%",
          highlight: true,
          features: ["3 Commercial Property Credits", "Corporate Buyer Push Notification", "Commercial Lease Agreement Draft", "Zero Commission Tag"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_commercial_6pack_price) : 799,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 6) : 1194,
          badge: "VIP VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_6pack_price) / (Number(platformSettings.owner_commercial_fee) * 6))) * 100)}%` : "Save 33%",
          features: ["6 Commercial Property Credits", "Top Banner Featured Badge", "Legal Commercial Lease Agreement", "Priority Verification"],
        },
        {
          id: "10pack",
          name: "10-Pack Retail Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_commercial_10pack_price) : 1199,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 10) : 1990,
          badge: "REALTY AGENCY",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_10pack_price) / (Number(platformSettings.owner_commercial_fee) * 10))) * 100)}%` : "Save 40%",
          features: ["10 Commercial Property Credits", "Commercial Realty Portfolio Page", "Dedicated Account Manager", "High-Volume Lead Alerts"],
        },
      ],
    },
  };

  const handleBuyPass = async (planId, passCategory = selectedPassCategory) => {
    setBuyingPassLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-passes/initiate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: planId, category: passCategory }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to initiate pass order.");
      }

      const data = await res.json();

      if (data.bypassed) {
        toast.success(`🎉 Pass activated! ${data.detail || "Credits added."}`);
        fetchProperties();
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Razorpay SDK failed to load. Check your internet connection.");
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Rentlo Owner Listing Pass",
        description: `Listing Pass Refill (${data.credits_count} Credits - ${passCategory.toUpperCase()})`,
        order_id: data.order_id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-passes/verify/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan_id: planId,
                category: passCategory,
                credits_count: data.credits_count,
              }),
            });

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              toast.success(`🎉 ${verifyData.detail}`);
              fetchProperties();
            } else {
              toast.error("Payment verification failed. If money was deducted, credits will be added automatically.");
            }
          } catch (e) {
            toast.error("Verification error: " + e.message);
          }
        },
        prefill: {
          name: user?.first_name || user?.username,
          email: user?.email,
          contact: user?.phone,
        },
        theme: { color: "#10b981" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast.error(err.message || "Failed to purchase pass");
    } finally {
      setBuyingPassLoading(false);
    }
  };

  const statusConfig = {
    live: {
      label: "🟢 Live",
      color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
    },
    under_negotiation: {
      label: "⏸ Under Negotiation",
      color: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30",
    },
    rented: {
      label: "🏠 Rented",
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30",
    },
    pending_review: {
      label: "⏳ Pending Review",
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    },
    rejected: {
      label: "❌ Rejected",
      color: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30",
    },
    draft: {
      label: "📝 Draft",
      color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30",
    },
  };

  // KPI Calculations
  const totalProperties = properties.length;
  const liveCount = properties.filter((p) => p.status === "live").length;
  const totalUnlocks = properties.reduce(
    (acc, p) => acc + (p.unlock_count || 0),
    0
  );
  const inTalksCount = properties.filter(
    (p) => p.status === "under_negotiation" || p.status === "rented"
  ).length;

  // Filtered properties
  const filteredProperties = properties.filter((prop) => {
    if (selectedStatusFilter === "all" && prop.status === "rejected") {
      return false;
    }
    if (selectedStatusFilter !== "all" && prop.status !== selectedStatusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = `${prop.bedrooms ? prop.bedrooms + " BHK " : ""}${prop.property_type}`.toLowerCase();
      const locality = (prop.locality_details?.name || "").toLowerCase();
      const city = (prop.locality_details?.city_name || "").toLowerCase();
      return (
        title.includes(q) ||
        locality.includes(q) ||
        city.includes(q) ||
        String(prop.id).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner & Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-emerald-900/10 via-surface to-surface border border-emerald-500/20 p-6 md:p-7 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold tracking-wide uppercase mb-1">
            <span className="material-symbols-outlined text-[14px]">real_estate_agent</span>
            <Translate>Owner Console</Translate>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            <Translate>Welcome back,</Translate> {user?.first_name || user?.username || "Owner"} 👋
          </h2>
          <p className="text-[13.5px] text-text-muted max-w-xl">
            <Translate>Manage your rental listings, monitor buyer unlock inquiries, track visit slots, and update negotiation statuses in real-time.</Translate>
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={() => setShowCreditsModal(true)}
            className="px-4 py-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-800 rounded-2xl text-[13px] font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-600">stars</span>
            {ownerCredits?.total_credits_remaining > 0 ? (
              <>
                {ownerCredits.total_credits_remaining} <Translate>Listing Credit</Translate>
                {ownerCredits.total_credits_remaining === 1 ? "" : "s"}
              </>
            ) : (
              <Translate>Buy Listing Pass</Translate>
            )}
          </button>

          <Link
            to="/owner/new-listing"
            className="px-5 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white rounded-2xl text-[13.5px] font-extrabold shadow-md transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <Translate>Post New Property</Translate>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Properties",
            value: totalProperties,
            icon: "home_work",
            color: "text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10",
          },
          {
            label: "Live Listings",
            value: liveCount,
            icon: "verified",
            color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10",
          },
          {
            label: "Buyer Unlocks",
            value: totalUnlocks,
            icon: "contacts",
            color: "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10",
          },
          {
            label: "In Talks / Rented",
            value: inTalksCount,
            icon: "handshake",
            color: "text-purple-500 bg-purple-500/10 border-purple-500/20 shadow-purple-500/10",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between hover-lift shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                <Translate>{kpi.label}</Translate>
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-ink group-hover:text-emerald-600 transition-colors">
                {kpi.value}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-md transition-transform duration-300 group-hover:scale-110 ${kpi.color}`}>
              <span className="material-symbols-outlined text-[24px]">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar">
          {[
            { id: "all", label: "All Properties" },
            { id: "live", label: "🟢 Live" },
            { id: "under_negotiation", label: "⏸ Under Negotiation" },
            { id: "rented", label: "🏠 Rented" },
            { id: "pending_review", label: "⏳ Pending Review" },
            { id: "rejected", label: "🔴 Rejected Listings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex-shrink-0 ${
                selectedStatusFilter === tab.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-surface border border-border text-text-muted hover:text-ink hover:bg-surface-alt"
              }`}
            >
              <Translate>{tab.label}</Translate>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search properties or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 h-10 rounded-xl bg-surface border border-border text-[12.5px] font-medium outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-[13px] font-medium text-text-muted">Fetching your listings...</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-surface border border-border rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px]">real_estate_agent</span>
          </div>
          <h3 className="text-xl font-bold text-ink mb-1.5">No properties found</h3>
          <p className="text-sm text-text-muted max-w-md mb-6">
            {selectedStatusFilter !== "all" || searchQuery
              ? "No properties match your active filter criteria."
              : "You haven't listed any properties yet. Post your first listing to start connecting with buyers."}
          </p>
          <Link
            to="/owner/new-listing"
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg transition-all"
          >
            List Your First Property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((prop) => {
            const sc =
              statusConfig[prop.status] || {
                label: prop.status,
                color: "bg-slate-500/15 text-slate-500 border border-slate-500/30",
              };
            const unlockCount = prop.unlock_count || 0;

            return (
              <div
                key={prop.id}
                className="group bg-surface border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Image Header Container */}
                <div className="h-52 bg-surface-alt relative overflow-hidden">
                  <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                  {/* Status Badge */}
                  <div
                    className={`absolute top-3.5 left-3.5 px-3 py-1 rounded-xl text-[10.5px] font-bold tracking-wide backdrop-blur-md shadow-md ${sc.color}`}
                  >
                    <Translate>{sc.label}</Translate>
                  </div>

                  {/* Contact Unlocks Badge */}
                  {unlockCount > 0 && (
                    <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 backdrop-blur-md text-white rounded-xl text-[10.5px] font-extrabold shadow-lg">
                      <span className="material-symbols-outlined text-[13px]">contacts</span>
                      {unlockCount} <Translate>{unlockCount === 1 ? "buyer" : "buyers"} contacted</Translate>
                    </div>
                  )}

                  {/* Bottom Image Overlay Details */}
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-white flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black drop-shadow-md">
                        ₹{parseFloat(prop.price).toLocaleString("en-IN")}
                        <span className="text-[12px] font-normal text-white/80">/mo</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-black/50 backdrop-blur text-white/90 border border-white/20">
                      ID #{prop.id}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[15px] font-bold text-ink capitalize line-clamp-1">
                        <Translate>{prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}{prop.property_type}</Translate>
                      </h4>
                      {prop.status === "live" && prop.expires_at && (() => {
                        const diffTime = new Date(prop.expires_at) - new Date();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          return (
                            <span 
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wide whitespace-nowrap shrink-0 ${
                                diffDays <= 10 
                                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse" 
                                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              }`}
                            >
                              ⏳ {diffDays} {diffDays === 1 ? "Day" : "Days"} Left
                            </span>
                          );
                        } else {
                          return (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wide bg-rose-500/15 text-rose-500 border border-rose-500/30 whitespace-nowrap shrink-0">
                              Expired ⚠️
                            </span>
                          );
                        }
                      })()}
                    </div>
                    <p className="text-[12px] text-text-muted flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-emerald-500">location_on</span>
                      <Translate>{prop.locality_details?.name || "Locality"}</Translate>, <Translate>{prop.locality_details?.city_name || "City"}</Translate>
                    </p>
                  </div>

                  {/* Contextual Status Info Alert Cards */}
                  {(prop.property_category === "pg" ||
                    prop.property_type === "pg" ||
                    prop.property_type === "pg_hostel" ||
                    (prop.property_type && prop.property_type.startsWith("pg"))) && (
                    <div className="p-4 rounded-2xl bg-slate-950 text-white shadow-md border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">hotel</span>
                          PG / Hostel Room Tracker
                        </span>
                      </div>

                      {/* Visual Bed Occupancy & Resident Tracker */}
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[11px] font-extrabold text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px] text-emerald-400">group</span>
                          Occupied: <strong className="text-white">{Math.max(0, (prop.total_beds || 0) - (prop.available_beds || 0))} Persons</strong>
                        </span>
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {prop.available_beds || 0} / {prop.total_beds || 0} Beds Available
                        </span>
                      </div>

                      {/* Visual Occupancy Progress Bar */}
                      {prop.total_beds > 0 && (
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
                          <div
                            className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  Math.round(
                                    ((prop.total_beds - (prop.available_beds || 0)) / prop.total_beds) * 100
                                  )
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Room Sharing Specific Quick Bed Controls */}
                      {(() => {
                        const inv = prop.pg_rules?.room_inventory;
                        const types = [
                          { key: "single", label: "Single Private Room", icon: "bed", beds: 1 },
                          { key: "double", label: "Double Sharing", icon: "king_bed", beds: 2 },
                          { key: "triple", label: "Triple Sharing", icon: "hotel", beds: 3 },
                          { key: "four_plus", label: "4+ Bed Sharing", icon: "single_bed", beds: 4 },
                        ];

                        const enabledTypes = inv && typeof inv === 'object'
                          ? types.filter(t => inv[t.key] && inv[t.key].enabled)
                          : [];

                        if (enabledTypes.length > 0) {
                          return (
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Mark Bed Check-In / Check-Out
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBedProp(prop);
                                    const existingInv = prop.pg_rules?.room_inventory || {};
                                    const defaultPrice = Number(prop.price) || 5000;
                                    const defaultAvail = Number(prop.available_beds) || 0;
                                    const defaultTotal = Number(prop.total_beds) || 1;

                                    setBedForm({
                                      total_beds: defaultTotal,
                                      available_beds: defaultAvail,
                                      room_inventory: {
                                        single: existingInv.single || { enabled: true, rooms: Math.max(1, defaultTotal), beds_per_room: 1, available_beds: defaultAvail, rent: defaultPrice },
                                        double: existingInv.double || { enabled: false, rooms: 0, beds_per_room: 2, available_beds: 0, rent: Math.round(defaultPrice * 0.8) },
                                        triple: existingInv.triple || { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: Math.round(defaultPrice * 0.7) },
                                        four_plus: existingInv.four_plus || { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: Math.round(defaultPrice * 0.6) },
                                      }
                                    });
                                  }}
                                  className="text-[10px] font-extrabold text-orange-400 hover:text-orange-300 flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[13px]">edit_note</span>
                                  Configure Inventory
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {enabledTypes.map((t) => {
                                  const item = inv[t.key];
                                  const openBeds = Number(item.available_beds) || 0;
                                  const totBeds = (Number(item.rooms) || 0) * (Number(item.beds_per_room) || t.beds);
                                  return (
                                    <div key={t.key} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition-all">
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[17px] text-orange-400">{t.icon}</span>
                                        <div>
                                          <div className="text-[11px] font-black text-white">{t.label}</div>
                                          <div className="text-[9.5px] font-extrabold text-slate-400">
                                            <span className={openBeds > 0 ? "text-emerald-400 font-black" : "text-red-400 font-black"}>{openBeds} Open</span> / {totBeds} Total Beds
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handlePGOccupancy(prop.id, "rent_bed", { room_type: t.key })}
                                          disabled={openBeds <= 0}
                                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] font-black flex items-center gap-0.5 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                                          title={`Mark 1 bed rented under ${t.label}`}
                                        >
                                          <span className="material-symbols-outlined text-[13px]">person_add</span>
                                          + Rent
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handlePGOccupancy(prop.id, "vacate_bed", { room_type: t.key })}
                                          disabled={openBeds >= totBeds}
                                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[9.5px] font-black flex items-center gap-0.5 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                                          title={`Mark 1 bed vacated under ${t.label}`}
                                        >
                                          <span className="material-symbols-outlined text-[13px]">person_remove</span>
                                          - Vacate
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Fallback controls if no custom room_inventory setup yet
                        return (
                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => handlePGOccupancy(prop.id, "rent_bed")}
                              disabled={prop.available_beds <= 0}
                              className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                              title="Record 1 resident check-in (marks 1 bed rented)"
                            >
                              <span className="material-symbols-outlined text-[14px]">person_add</span>
                              + Resident Came
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePGOccupancy(prop.id, "vacate_bed")}
                              className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Record 1 resident check-out (marks 1 bed free)"
                            >
                              <span className="material-symbols-outlined text-[14px]">person_remove</span>
                              - Resident Left
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBedProp(prop);
                                const existingInv = prop.pg_rules?.room_inventory || {};
                                const defaultPrice = Number(prop.price) || 5000;
                                const defaultAvail = Number(prop.available_beds) || 0;
                                const defaultTotal = Number(prop.total_beds) || 1;

                                setBedForm({
                                  total_beds: defaultTotal,
                                  available_beds: defaultAvail,
                                  room_inventory: {
                                    single: existingInv.single || { enabled: true, rooms: Math.max(1, defaultTotal), beds_per_room: 1, available_beds: defaultAvail, rent: defaultPrice },
                                    double: existingInv.double || { enabled: false, rooms: 0, beds_per_room: 2, available_beds: 0, rent: Math.round(defaultPrice * 0.8) },
                                    triple: existingInv.triple || { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: Math.round(defaultPrice * 0.7) },
                                    four_plus: existingInv.four_plus || { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: Math.round(defaultPrice * 0.6) },
                                  }
                                });
                              }}
                              className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 border border-orange-500/30 text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Edit total & available bed capacity"
                            >
                              <span className="material-symbols-outlined text-[13px]">edit_note</span>
                              Edit Beds
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {prop.status === "live" && unlockCount > 0 && (
                    <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5 text-orange-500">notifications_active</span>
                        <span>
                          <strong>{unlockCount} {unlockCount === 1 ? "buyer has" : "buyers have"} unlocked your contact details.</strong> Click <em>"I'm In Talks"</em> when negotiating to pause new unlocks.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "under_negotiation" && (
                    <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5 text-purple-500">pause_circle</span>
                        <span>
                          Unlocks are currently <strong>paused</strong> for negotiation. Mark it <strong>Rented</strong> when finalized, or <strong>Reopen</strong> if talks fall through.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "rented" && (
                    <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5 text-blue-500">check_circle</span>
                        <span>
                          Property is marked as rented. Click <strong>Relist</strong> whenever it becomes available again.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "rejected" && (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5 text-rose-500">cancel</span>
                        <span>
                          <strong>Listing Rejected by Moderation:</strong> {prop.rejection_reason || "Admin requested corrections to listing details."}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Action Buttons Section */}
                  <div className="mt-auto pt-3 border-t border-border space-y-2">
                    <div className="flex flex-col gap-2">
                      {/* Live → Under Negotiation */}
                      {prop.status === "live" && (
                        <button
                          onClick={() => handleStatusUpdate(prop.id, "under_negotiation")}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-[12px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">handshake</span>
                          I'm In Talks — Pause Unlocks
                        </button>
                      )}

                      {/* Under Negotiation → Mark Rented OR Reopen */}
                      {prop.status === "under_negotiation" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStatusUpdate(prop.id, "rented")}
                            className="flex-1 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[15px]">home</span>
                            Deal Done — Rented
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(prop.id, "live")}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-500/30 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[15px]">replay</span>
                            Deal Fell Through
                          </button>
                        </div>
                      )}

                      {/* Live → Mark Rented directly */}
                      {prop.status === "live" && (
                        <button
                          onClick={() => handleStatusUpdate(prop.id, "rented")}
                          className="w-full px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-[11.5px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">key</span>
                          Mark as Rented
                        </button>
                      )}

                      {/* Rented → Relist */}
                      {prop.status === "rented" && (
                        <button
                          onClick={() => handleStatusUpdate(prop.id, "live")}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[12px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                          Relist — Available Again
                        </button>
                      )}

                      {/* Lease Agreement Shortcut (ONLY shown AFTER property is rented) */}
                      {prop.status === "rented" && (
                        <Link
                          to={`/property/${prop.id}/lease`}
                          className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[12px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <span className="material-symbols-outlined text-[16px]">description</span>
                          Draft Official Lease Agreement
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-medium text-text-muted">Status: {sc.label}</span>
                      <Link
                        to={`/property/${prop.id}`}
                        className="text-[12px] font-extrabold text-emerald-500 hover:underline flex items-center gap-1"
                      >
                        View listing
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Owner Passes & Credits Management Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto pt-14 pb-20 sm:items-center sm:py-8" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-3xl max-w-5xl w-full p-4 sm:p-8 shadow-2xl relative max-h-[85vh] sm:max-h-[90vh] overflow-y-auto scrollbar-none animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25">
                  <span className="material-symbols-outlined text-[28px] font-black">workspace_premium</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    Owner Listing Passes & Refills
                  </h3>
                  <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Choose property category and select refill credit passes with zero brokerage.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditsModal(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Current Balance & Active Credits Banner */}
            <div className="my-6 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)", boxShadow: "0 4px 24px rgba(5,150,105,0.25)" }}>
              <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  Active Balance
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white">
                    {ownerCredits?.total_credits_remaining || 0}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
                    Listing Credit{(ownerCredits?.total_credits_remaining || 0) === 1 ? "" : "s"} Remaining
                  </span>
                </div>

                {/* Category Pass Breakdown Badges */}
                {ownerCredits?.active_passes && ownerCredits.active_passes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ownerCredits.active_passes.map((pass) => {
                      const cat = (pass.category || "all").toLowerCase();
                      const catLabel =
                        cat === "residential"
                          ? "Residential Pass"
                          : cat === "apartment" || cat === "pg"
                          ? "Apartment & PG Pass"
                          : cat === "commercial"
                          ? "Commercial Pass"
                          : "All-Category Pass";
                      const icon =
                        cat === "residential"
                          ? "home"
                          : cat === "commercial"
                          ? "store"
                          : cat === "apartment" || cat === "pg"
                          ? "apartment"
                          : "stars";
                      return (
                        <div
                          key={pass.id}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
                        >
                          <span className="material-symbols-outlined text-[16px] text-white">{icon}</span>
                          <span>{catLabel}:</span>
                          <span className="font-black text-white">
                            {pass.credits_remaining} / {pass.credits_total} Credits
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                    No active pass credits available. Select a category below to refill listing credits!
                  </p>
                )}
              </div>

              <Link
                to="/owner/new-listing"
                onClick={() => setShowCreditsModal(false)}
                className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-emerald-300/40"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Publish Listing Now
              </Link>
            </div>

            {/* Category Selector Tabs */}
            {!selectedPassCategory && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: "#0F172A" }}>
                    <span className="material-symbols-outlined text-emerald-400 text-[20px]">category</span>
                    Select Property Category For Refill Plans:
                  </h4>
                  <span className="text-[11px] font-bold" style={{ color: "#64748B" }}>
                    Prices dynamically customized per property category
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.keys(CATEGORY_PLANS).map((catKey) => {
                    const catObj = CATEGORY_PLANS[catKey];
                    const isSelected = selectedPassCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setSelectedPassCategory(catKey)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? "border-2 shadow-md ring-2"
                            : "hover:border-emerald-300"
                        }`}
                        style={isSelected ? { backgroundColor: "#f0fdf4", borderColor: "#059669", boxShadow: "0 4px 16px rgba(5,150,105,0.15)", ringColor: "rgba(5,150,105,0.3)" } : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`material-symbols-outlined text-[22px] ${
                                isSelected ? "text-emerald-600" : "text-slate-400"
                              }`}
                            >
                              {catObj.icon}
                            </span>
                            <span className="font-black text-sm" style={{ color: isSelected ? "#059669" : "#0F172A" }}>{catObj.shortLabel}</span>
                          </div>
                          {isSelected && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400"></span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-2 opacity-80">{catObj.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Refill Passes Store */}
            {selectedPassCategory && (
              <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <div className="flex flex-col items-start gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedPassCategory(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[11px] font-extrabold uppercase tracking-widest text-slate-700 transition-all cursor-pointer shadow-sm hover:scale-102 w-fit"
                    >
                      <span className="material-symbols-outlined text-[15px] font-black">arrow_back</span>
                      Back
                    </button>
                    <div className="flex items-start gap-2 pt-1">
                      <span className="material-symbols-outlined text-orange-400 text-[20px] shrink-0 mt-0.5">shopping_bag</span>
                      <h4 className="text-sm font-black uppercase tracking-wider leading-snug" style={{ color: "#0F172A" }}>
                        {CATEGORY_PLANS[selectedPassCategory]?.label} Listing Passes
                      </h4>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 w-fit self-end sm:self-auto">
                    ⚡ Instant Activation
                  </span>
                </div>

                {/* 4 Plan Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {CATEGORY_PLANS[selectedPassCategory]?.plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between relative ${
                        plan.highlight
                          ? "border-2"
                          : "hover:border-emerald-300"
                      }`}
                      style={plan.highlight ? { background: "linear-gradient(160deg,#f0fdf4 0%,#ffffff 100%)", borderColor: "#059669", boxShadow: "0 8px 32px rgba(5,150,105,0.18)" } : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
                    >
                      {plan.badge && (
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                            {plan.badge}
                          </span>
                          {plan.saveBadge && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#dcfce7", color: "#059669", border: "1px solid #bbf7d0" }}>
                              {plan.saveBadge}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        <h5 className="text-base font-black" style={{ color: "#0F172A" }}>{plan.name}</h5>

                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black" style={{ color: "#0F172A" }}>₹{plan.price}</span>
                          {plan.originalPrice && (
                            <span className="text-xs line-through font-bold" style={{ color: "#94a3b8" }}>
                              ₹{plan.originalPrice}
                            </span>
                          )}
                          <span className="text-[11px] font-medium ml-auto" style={{ color: "#64748b" }}>
                            ({plan.credits} {plan.credits === 1 ? "Credit" : "Credits"})
                          </span>
                        </div>

                        <ul className="space-y-2 pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
                          {plan.features.map((feat, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] font-medium leading-tight" style={{ color: "#475569" }}>
                              <span className="material-symbols-outlined text-[14px] text-emerald-400 shrink-0 mt-0.5">
                                check_circle
                              </span>
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={buyingPassLoading}
                        onClick={() => handleBuyPass(plan.id, selectedPassCategory)}
                        className={`w-full mt-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          plan.highlight
                            ? "shadow-md"
                            : ""
                        } disabled:opacity-50`}
                        style={plan.highlight ? { background: "linear-gradient(135deg, #059669, #0d9488)", color: "#fff", border: "none", boxShadow: "0 4px 16px rgba(5,150,105,0.3)" } : { backgroundColor: "#f1f5f9", color: "#0F172A", border: "1px solid #e2e8f0" }}
                      >
                        {buyingPassLoading ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                            Processing...
                          </>
                        ) : (
                          `Buy ${plan.credits} ${plan.credits === 1 ? "Credit" : "Credits"}`
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Trust Badges */}
            <div className="mt-8 pt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold" style={{ borderTop: "1px solid #e2e8f0", color: "#64748b" }}>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">bolt</span> Instant Credit Activation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">all_inclusive</span> Credits Never Expire
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">verified_user</span> 100% Secure Razorpay Checkout
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bed Capacity & Room Inventory Configurator Modal */}
      {editingBedProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto scrollbar-thin border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[26px]">hotel</span>
                <div>
                  <h3 className="font-extrabold text-lg" style={{ color: "var(--ink)" }}>Configure Room Sharing & Bed Tracker</h3>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Listing #{editingBedProp.id} • Customize room types, room counts, and per-bed rents.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBedProp(null)}
                className="transition-colors border w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUpdatingBeds(true);
                const inv = bedForm.room_inventory || {};

                // Calculate summary totals across enabled room types
                let calcTotal = 0;
                let calcAvail = 0;
                const roomTypes = ["single", "double", "triple", "four_plus"];
                const bedsMap = { single: 1, double: 2, triple: 3, four_plus: 4 };

                roomTypes.forEach((key) => {
                  if (inv[key]?.enabled) {
                    const rms = Number(inv[key].rooms) || 0;
                    const bpr = Number(inv[key].beds_per_room) || bedsMap[key];
                    const openBeds = Number(inv[key].available_beds) || 0;
                    calcTotal += rms * bpr;
                    calcAvail += openBeds;
                  }
                });

                // Fallback to manual form values if no room type enabled
                const finalTotal = calcTotal > 0 ? calcTotal : Number(bedForm.total_beds) || 0;
                const finalAvail = calcTotal > 0 ? calcAvail : Number(bedForm.available_beds) || 0;

                const ok = await handlePGOccupancy(editingBedProp.id, "update_inventory", {
                  room_inventory: inv,
                  total_beds: finalTotal,
                  available_beds: finalAvail,
                });

                setUpdatingBeds(false);
                if (ok) setEditingBedProp(null);
              }}
              className="space-y-5"
            >
              {/* Room Categories Configurator */}
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-orange-500 uppercase tracking-wider">
                  Room Types Available in this Property
                </label>

                {[
                  { key: "single", label: "Single Private Room", defaultBeds: 1, icon: "bed" },
                  { key: "double", label: "Double Sharing", defaultBeds: 2, icon: "king_bed" },
                  { key: "triple", label: "Triple Sharing", defaultBeds: 3, icon: "hotel" },
                  { key: "four_plus", label: "4+ Bed Sharing", defaultBeds: 4, icon: "single_bed" },
                ].map((type) => {
                  const item = bedForm.room_inventory?.[type.key] || {
                    enabled: false,
                    rooms: 0,
                    beds_per_room: type.defaultBeds,
                    available_beds: 0,
                    rent: 0,
                  };

                  return (
                    <div
                      key={type.key}
                      className="p-4 rounded-2xl border transition-all"
                      style={{
                        backgroundColor: item.enabled ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : "var(--surface-alt)",
                        borderColor: item.enabled ? "var(--accent)" : "var(--border)",
                        opacity: item.enabled ? 1 : 0.75
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => {
                              const updated = { ...item, enabled: e.target.checked };
                              if (e.target.checked && updated.rooms === 0) updated.rooms = 1;
                              if (e.target.checked && updated.available_beds === 0) updated.available_beds = updated.rooms * type.defaultBeds;
                              if (e.target.checked && updated.rent === 0) updated.rent = Number(editingBedProp?.price) || 5000;

                              setBedForm((prev) => ({
                                ...prev,
                                room_inventory: { ...prev.room_inventory, [type.key]: updated },
                              }));
                            }}
                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                            style={{ accentColor: "var(--accent)" }}
                          />
                          <span className="material-symbols-outlined text-[20px] text-orange-500">{type.icon}</span>
                          <span className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>{type.label}</span>
                        </label>

                        {item.enabled && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-orange-500 border border-orange-500/30" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                            {item.rooms * (item.beds_per_room || type.defaultBeds)} Beds Total
                          </span>
                        )}
                      </div>

                      {item.enabled && (
                        <div className="grid grid-cols-3 gap-3 pt-3.5 mt-3 border-t" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <label className="block text-[10px] font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Number of Rooms
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.rooms}
                              onChange={(e) => {
                                const rooms = Math.max(1, parseInt(e.target.value) || 1);
                                const tot = rooms * (item.beds_per_room || type.defaultBeds);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: {
                                      ...item,
                                      rooms,
                                      available_beds: Math.min(item.available_beds, tot),
                                    },
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Available Free Beds
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.rooms * (item.beds_per_room || type.defaultBeds)}
                              value={item.available_beds}
                              onChange={(e) => {
                                const avail = Math.max(0, parseInt(e.target.value) || 0);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: { ...item, available_beds: avail },
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Rent per Bed (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.rent}
                              onChange={(e) => {
                                const rent = Math.max(0, parseInt(e.target.value) || 0);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: { ...item, rent },
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation Summary Banner */}
              {(() => {
                const inv = bedForm.room_inventory || {};
                let totBeds = 0;
                let openBeds = 0;
                Object.keys(inv).forEach((k) => {
                  if (inv[k]?.enabled) {
                    totBeds += (Number(inv[k].rooms) || 0) * (Number(inv[k].beds_per_room) || 1);
                    openBeds += Number(inv[k].available_beds) || 0;
                  }
                });

                const occupied = Math.max(0, totBeds - openBeds);

                return (
                  <div className="p-4 rounded-2xl border flex items-center justify-between text-xs font-extrabold flex-wrap gap-2 shadow-md" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="material-symbols-outlined text-[20px]">equalizer</span>
                      <span>Inventory Calculation:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                        {totBeds} Total Beds
                      </span>
                      <span className="px-2.5 py-1 rounded-lg border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                        {occupied} Occupied
                      </span>
                      <span className="px-2.5 py-1 rounded-lg border text-emerald-600" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                        {openBeds} Free
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBedProp(null)}
                  className="px-4 py-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingBeds}
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {updatingBeds ? (
                    <>Saving Configuration...</>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save Room Inventory
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
