import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../../shared/context/AuthContext";
import { toast } from "react-toastify";

export const PropertyList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.roles?.includes("admin");

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyForPhotos, setSelectedPropertyForPhotos] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // "all", "owner", "agent", "admin"
  const [userFilter, setUserFilter] = useState("all"); // Specific agent or admin username
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "live", "pending_review", "rejected"
  const [typeFilter, setTypeFilter] = useState("all"); // "all", "house", "apartment", "plot", "commercial"

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, userFilter, statusFilter, typeFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : data.results || []);
      } else {
        toast.error("Failed to load properties list.");
      }
    } catch (err) {
      toast.error("Network error fetching properties.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (mediaId) => {
    if (!window.confirm("Are you sure you want to remove this photo?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/media/${mediaId}/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Photo removed successfully!");
        setSelectedPropertyForPhotos(prev => {
          if (!prev) return null;
          return {
            ...prev,
            media: prev.media.filter(m => m.id !== mediaId)
          };
        });
        setProperties(prev => prev.map(p => {
          if (p.id === selectedPropertyForPhotos?.id) {
            return {
              ...p,
              media: p.media.filter(m => m.id !== mediaId)
            };
          }
          return p;
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || "Failed to remove photo.");
      }
    } catch (err) {
      toast.error("Network error removing photo.");
    }
  };

  const handleUpdateStatus = async (propertyId, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propertyId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Property status set to ${newStatus.replace("_", " ")}`);
        // Optimistic update — no fetchProperties() to avoid race condition overwriting the new status
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, status: newStatus } : p))
        );
      } else {
        toast.error("Failed to update property status.");
      }
    } catch (err) {
      toast.error("Network error updating property status.");
    }
  };

  // Get filtered usernames based on selected roleFilter (Cascading Dependent Dropdown)
  const availableUsers = Array.from(
    new Set(
      properties
        .filter((p) => {
          const role = p.creator_info?.role || "owner";
          if (roleFilter === "admin") return role === "admin";
          if (roleFilter === "agent") return role === "agent";
          if (roleFilter === "owner") return role === "owner" || role === "buyer";
          return true;
        })
        .map((p) => p.creator_info?.username)
        .filter((name) => name && name !== "Self")
    )
  );

  // Filter Properties Logic
  const filteredProperties = properties.filter((p) => {
    const creator = p.creator_info || {};
    const role = creator.role?.toLowerCase() || "owner";
    const username = creator.username || "";
    const title = `#${p.id} ${p.bedrooms ? `${p.bedrooms} BHK ` : ""}${p.property_type || "Property"}`.toLowerCase();
    const rawOwnerName = (p.owner_name_display || p.owner_name || "").toLowerCase();
    const ownerName = rawOwnerName.startsWith("owner_") ? "unknown owner" : rawOwnerName;
    const ownerPhone = (p.owner_phone_display || p.owner_phone || "").toLowerCase();
    const locality = (p.locality_details?.name || "").toLowerCase();
    const city = (p.locality_details?.city_name || "").toLowerCase();
    const search = searchQuery.toLowerCase().trim();

    // 1. Search Query
    if (
      search &&
      !title.includes(search) &&
      !ownerName.includes(search) &&
      !ownerPhone.includes(search) &&
      !username.toLowerCase().includes(search) &&
      !locality.includes(search) &&
      !city.includes(search)
    ) {
      return false;
    }

    // 2. Role Filter (Owner, Agent, Admin) - Admin Only
    if (isAdmin && roleFilter !== "all" && role !== roleFilter) {
      return false;
    }

    // 3. Specific User Filter - Admin Only
    if (isAdmin && userFilter !== "all" && username !== userFilter) {
      return false;
    }

    // 4. Status Filter (Hide rejected from 'all' view by default to keep active list clean)
    if (statusFilter === "all" && p.status === "rejected") {
      return false;
    }
    if (statusFilter !== "all" && p.status !== statusFilter) {
      return false;
    }

    // 5. Type Filter
    if (typeFilter !== "all" && p.property_type !== typeFilter) {
      return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate Metrics
  const totalCount = properties.length;
  const adminCount = properties.filter((p) => p.creator_info?.role === "admin").length;
  const agentCount = properties.filter((p) => p.creator_info?.role === "agent").length;
  const ownerCount = properties.filter(
    (p) => !p.creator_info?.role || p.creator_info?.role === "owner" || p.creator_info?.role === "buyer"
  ).length;
  const liveCount = properties.filter((p) => p.status === "live").length;
  const pendingCount = properties.filter(
    (p) => p.status === "pending" || p.status === "pending_review"
  ).length;
  const rejectedCount = properties.filter((p) => p.status === "rejected").length;

  return (
    <AdminLayout activeTab="properties">
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5" style={{ color: "var(--ink)" }}>
              <span className="material-symbols-outlined text-[28px]" style={{ color: "var(--accent)" }}>
                real_estate_agent
              </span>
              {isAdmin ? "Properties Management" : "My Onboarded Properties"}
            </h1>
            <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
              {isAdmin
                ? "View, search, and filter all listings registered across the platform by Owners, Agents, and Admins."
                : "View, search, and track all property listings onboarded by you."}
            </p>
          </div>
          <Link
            to="/admin/listings/new"
            className="h-12 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-md hover:-translate-y-0.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Onboard New Listing
          </Link>
        </div>

        {/* Metric Cards Summary - Role Dependent */}
        {isAdmin ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Total Listings</span>
              <span className="text-2xl font-extrabold mt-2" style={{ color: "var(--ink)" }}>{totalCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">shield</span> Admin Listed
              </span>
              <span className="text-2xl font-extrabold text-blue-500 mt-2">{adminCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-purple-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">badge</span> Agent Listed
              </span>
              <span className="text-2xl font-extrabold text-purple-500 mt-2">{agentCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">person</span> Owner Listed
              </span>
              <span className="text-2xl font-extrabold text-emerald-500 mt-2">{ownerCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Live Properties</span>
              <span className="text-2xl font-extrabold text-emerald-500 mt-2">{liveCount}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>My Listings</span>
              <span className="text-2xl font-extrabold mt-2" style={{ color: "var(--ink)" }}>{totalCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">check_circle</span> Live Properties
              </span>
              <span className="text-2xl font-extrabold text-emerald-500 mt-2">{liveCount}</span>
            </div>
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">pending</span> Pending Review
              </span>
              <span className="text-2xl font-extrabold text-amber-500 mt-2">{pendingCount}</span>
            </div>
            <div 
              onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
              className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
                statusFilter === "rejected" ? "ring-2 ring-red-500 bg-red-500/10" : ""
              }`} 
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              title="Click to view/hide rejected listings"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">cancel</span> Rejected Listings
              </span>
              <span className="text-2xl font-extrabold text-red-500 mt-2">{rejectedCount}</span>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="p-6 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px]" style={{ color: "var(--text-muted)" }}>
                search
              </span>
              <input
                type="text"
                placeholder={
                  isAdmin
                    ? "Search by Title, Owner Name, Phone, Locality, or Agent username..."
                    : "Search by Title, Owner Name, Phone, or Locality..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                className="w-full pl-12 pr-4 py-3 border rounded-xl outline-none focus:border-orange-500 text-[13px] font-medium transition-all placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={fetchProperties}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                className="px-4 py-3 border text-[12px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1 whitespace-nowrap hover:opacity-80"
                title="Refresh Table Data"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                  setUserFilter("all");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                className="px-4 py-3 border text-[12px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1 whitespace-nowrap hover:opacity-80"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                Reset Filters
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${
              isAdmin ? "md:grid-cols-4" : "md:grid-cols-2"
            } gap-4 pt-2 border-t`}
            style={{ borderColor: "var(--border)" }}
          >
            {isAdmin && (
              <>
                {/* Filter 1: Registered By Role */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[14px]">group</span>
                    Registered By
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setUserFilter("all");
                    }}
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    className="w-full h-11 px-3 border rounded-xl text-[13px] font-bold focus:border-orange-500 outline-none cursor-pointer"
                  >
                    <option value="all">All Registrars</option>
                    <option value="owner">Owner (Self-Listed)</option>
                    <option value="agent">Agent Registered</option>
                    <option value="admin">Admin Registered</option>
                  </select>
                </div>

                {/* Filter 2: Specific User */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[14px]">account_box</span>
                    {roleFilter === "admin"
                      ? "Specific Admin"
                      : roleFilter === "agent"
                        ? "Specific Agent"
                        : roleFilter === "owner"
                          ? "Specific Owner"
                          : "Specific Agent / Admin"}
                  </label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    className="w-full h-11 px-3 border rounded-xl text-[13px] font-bold focus:border-orange-500 outline-none cursor-pointer"
                  >
                    <option value="all">
                      {roleFilter === "admin"
                        ? "All Admins"
                        : roleFilter === "agent"
                          ? "All Agents"
                          : roleFilter === "owner"
                            ? "All Owners"
                            : "All Users"}
                    </option>
                    {availableUsers.map((user) => (
                      <option key={user} value={user}>
                        {roleFilter === "admin" ? `Admin: ${user}` : roleFilter === "agent" ? `Agent: ${user}` : user}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Filter 3: Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">flag</span>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                className="w-full h-11 px-3 border rounded-xl text-[13px] font-bold focus:border-orange-500 outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="live">Live</option>
                <option value="under_negotiation">Under Negotiation</option>
                <option value="rented">Rented</option>
                <option value="pending_review">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Filter 4: Property Type */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">home_work</span>
                Property Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                className="w-full h-11 px-3 border rounded-xl text-[13px] font-bold focus:border-orange-500 outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <optgroup label="Residential">
                  <option value="apartment">Apartment / Flat</option>
                  <option value="house">Independent House / Villa</option>
                  <option value="builder_floor">Builder Floor</option>
                  <option value="studio">1 RK / Studio Apartment</option>
                  <option value="pg">PG / Co-living</option>
                </optgroup>
                <optgroup label="Commercial">
                  <option value="office">Office Space</option>
                  <option value="retail">Retail Shop / Showroom</option>
                  <option value="warehouse">Warehouse / Godown</option>
                  <option value="coworking">Co-working Space</option>
                  <option value="industrial">Industrial Shed / Building</option>
                </optgroup>
                <optgroup label="Land">
                  <option value="residential_plot">Residential Plot</option>
                  <option value="commercial_plot">Commercial Plot</option>
                  <option value="agricultural_land">Agricultural Land</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* Properties Table */}
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
              <p className="text-[13px] font-bold" style={{ color: "var(--text-muted)" }}>Loading Properties List...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">
                search_off
              </span>
              <h3 className="text-[16px] font-extrabold" style={{ color: "var(--ink)" }}>No properties match your filters</h3>
              <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>Try resetting or broadening your search parameters above.</p>
            </div>
          ) : (
            <>
              {/* 🖥️ Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-extrabold uppercase tracking-widest" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <th className="py-4 px-6">Property Details</th>
                      <th className="py-4 px-6">Owner Information</th>
                      <th className="py-4 px-6">Registered By</th>
                      <th className="py-4 px-6">Rent Price</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Date Listed</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[13px] font-medium" style={{ borderColor: "var(--border)" }}>
                    {paginatedProperties.map((p) => {
                      const creator = p.creator_info || {};
                      const role = creator.role || "owner";
                      const mediaUrl = p.media && p.media.length > 0 ? p.media[0].thumbnail_url || p.media[0].image_url : null;

                      return (
                        <tr key={p.id} className="transition-colors hover:opacity-90">
                          {/* 1. Property Details */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3.5">
                              {mediaUrl ? (
                                <img
                                  src={mediaUrl}
                                  alt="Property Thumbnail"
                                  className="w-12 h-12 rounded-xl object-cover border shadow-sm flex-shrink-0"
                                  style={{ borderColor: "var(--border)" }}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="material-symbols-outlined text-[24px]">home</span>
                                </div>
                              )}
                              <div>
                                <div className="font-extrabold text-[14px]" style={{ color: "var(--ink)" }}>
                                  #{p.id} — {p.bedrooms ? `${p.bedrooms} BHK ` : ""}{p.property_type ? p.property_type.toUpperCase() : "PROPERTY"}
                                </div>
                                <div className="text-[12px] font-medium flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                                  {p.locality_details?.name || "Locality"}, {p.locality_details?.city_name || "City"}
                                </div>
                                {(p.property_category === 'pg' || p.property_type?.includes('pg')) && (
                                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                      Capacity: {p.total_beds || 0} Beds
                                    </span>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                      {Math.max(0, (p.total_beds || 0) - (p.available_beds || 0))} Persons Residing
                                    </span>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      {p.available_beds || 0} Beds Free
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Owner Information */}
                          <td className="py-4 px-6">
                            {(() => {
                              const rawName = p.owner_name_display || p.owner_name || "N/A";
                              const displayName = rawName.startsWith("owner_") ? "Unknown Owner" : rawName;
                              return <div className="font-bold" style={{ color: "var(--ink)" }}>{displayName}</div>;
                            })()}
                            <div className="text-[12px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{p.owner_phone_display || p.owner_phone || "N/A"}</div>
                          </td>

                          {/* 3. Registered By */}
                          <td className="py-4 px-6">
                            {role === "admin" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[11px] font-extrabold">
                                <span className="material-symbols-outlined text-[14px]">shield</span>
                                Admin: {creator.username || "Admin"}
                              </span>
                            )}
                            {role === "agent" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full text-[11px] font-extrabold">
                                <span className="material-symbols-outlined text-[14px]">badge</span>
                                Agent: {creator.username || "Agent"}
                              </span>
                            )}
                            {(role === "owner" || role === "buyer") && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full text-[11px] font-extrabold">
                                <span className="material-symbols-outlined text-[14px]">person</span>
                                Owner (Self)
                              </span>
                            )}
                          </td>

                          {/* 4. Rent Price */}
                          <td className="py-4 px-6 font-extrabold text-[14px]" style={{ color: "var(--ink)" }}>
                            ₹{Number(p.price || 0).toLocaleString("en-IN")}
                          </td>

                          {/* 5. Status */}
                          <td className="py-4 px-6">
                            {p.status === "live" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live
                              </span>
                            )}
                            {p.status === "under_negotiation" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                                Under Negotiation
                              </span>
                            )}
                            {p.status === "rented" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                Rented
                              </span>
                            )}
                            {p.status === "pending_review" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Pending Review
                              </span>
                            )}
                            {p.status === "rejected" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-500 border border-red-500/20">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Rejected
                              </span>
                            )}
                            {!["live", "under_negotiation", "rented", "pending_review", "rejected"].includes(p.status) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold" style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}>
                                {p.status ? p.status.toUpperCase() : "DRAFT"}
                              </span>
                            )}
                          </td>

                          {/* 6. Date Listed */}
                          <td className="py-4 px-6 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "N/A"}
                          </td>

                          {/* 7. Actions */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`/property/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                                className="p-2 rounded-lg border hover:opacity-80 transition-all flex items-center justify-center"
                                title="View Property Detail Page"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </a>
                              <button
                                onClick={() => setSelectedPropertyForPhotos(p)}
                                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                                className="p-2 rounded-lg border hover:opacity-80 transition-all flex items-center justify-center cursor-pointer"
                                title="Manage Photos"
                              >
                                <span className="material-symbols-outlined text-[18px]">photo_library</span>
                              </button>
                              {p.status === "under_negotiation" && (
                                <button
                                  onClick={() => handleUpdateStatus(p.id, "live")}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition-all"
                                  title="Release hold — re-open property for new buyers"
                                >
                                  ▶️ Release Hold
                                </button>
                              )}
                              {p.status !== "rented" && p.status !== "rejected" && (
                                <button
                                  onClick={() => handleUpdateStatus(p.id, "rented")}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-bold transition-all"
                                  title="Mark as rented"
                                >
                                  🏠 Rented
                                </button>
                              )}
                              {p.status === "rented" && (
                                <button
                                  onClick={() => handleUpdateStatus(p.id, "live")}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition-all"
                                  title="Relist — make available for rent again"
                                >
                                  🔄 Relist
                                </button>
                              )}
                              {p.status === "pending_review" && (
                                <Link
                                  to="/admin/moderation"
                                  className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[14px]">gavel</span>
                                  Review
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 📱 Mobile Card Stack View */}
              <div className="md:hidden divide-y divide-border" style={{ borderColor: "var(--border)" }}>
                {paginatedProperties.map((p) => {
                  const creator = p.creator_info || {};
                  const role = creator.role || "owner";
                  const mediaUrl = p.media && p.media.length > 0 ? p.media[0].thumbnail_url || p.media[0].image_url : null;
                  const rawName = p.owner_name_display || p.owner_name || "N/A";
                  const displayName = rawName.startsWith("owner_") ? "Unknown Owner" : rawName;

                  return (
                    <div key={p.id} className="p-4 space-y-3.5 transition-colors hover:opacity-95" style={{ backgroundColor: "var(--surface)" }}>
                      {/* Card Top: Thumbnail + Details */}
                      <div className="flex items-start gap-3">
                        {mediaUrl ? (
                          <img
                            src={mediaUrl}
                            alt="Property Thumbnail"
                            className="w-14 h-14 rounded-xl object-cover border shadow-sm flex-shrink-0"
                            style={{ borderColor: "var(--border)" }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-[26px]">home</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-[14px]" style={{ color: "var(--ink)" }}>
                            #{p.id} — {p.bedrooms ? `${p.bedrooms} BHK ` : ""}{p.property_type ? p.property_type.toUpperCase() : "PROPERTY"}
                          </div>
                          <div className="text-[11.5px] font-medium flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                            <span className="material-symbols-outlined text-[13px]">location_on</span>
                            <span className="truncate">{p.locality_details?.name || "Locality"}, {p.locality_details?.city_name || "City"}</span>
                          </div>
                          
                          {/* PG stats if PG */}
                          {(p.property_category === 'pg' || p.property_type?.includes('pg')) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                Capacity: {p.total_beds || 0} Beds
                              </span>
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                {Math.max(0, (p.total_beds || 0) - (p.available_beds || 0))} Occ
                              </span>
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                {p.available_beds || 0} Free
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Info Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] pt-3 border-t border-dashed" style={{ borderColor: "var(--border)" }}>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: "var(--text-muted)" }}>Owner</span>
                          <span className="font-bold block truncate" style={{ color: "var(--ink)" }}>{displayName}</span>
                          <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{p.owner_phone_display || p.owner_phone || "N/A"}</span>
                        </div>
                        
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: "var(--text-muted)" }}>Rent Price</span>
                          <span className="font-extrabold text-[13px] text-accent block">₹{Number(p.price || 0).toLocaleString("en-IN")}</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest block mb-0.5" style={{ color: "var(--text-muted)" }}>Registered By</span>
                          {role === "admin" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg text-[9.5px] font-extrabold">
                              Admin: {creator.username || "Admin"}
                            </span>
                          )}
                          {role === "agent" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-lg text-[9.5px] font-extrabold">
                              Agent: {creator.username || "Agent"}
                            </span>
                          )}
                          {(role === "owner" || role === "buyer") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-lg text-[9.5px] font-extrabold">
                              Owner (Self)
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest block mb-0.5" style={{ color: "var(--text-muted)" }}>Status</span>
                          {p.status === "live" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Live
                            </span>
                          )}
                          {p.status === "under_negotiation" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                              Negotiation
                            </span>
                          )}
                          {p.status === "rented" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              Rented
                            </span>
                          )}
                          {p.status === "pending_review" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Review
                            </span>
                          )}
                          {p.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-500 border border-red-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              Rejected
                            </span>
                          )}
                          {!["live", "under_negotiation", "rented", "pending_review", "rejected"].includes(p.status) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold" style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}>
                              {p.status ? p.status.toUpperCase() : "DRAFT"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Actions Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                          Listed: {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "N/A"}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <a
                            href={`/property/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                            className="px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-all flex items-center justify-center gap-1 text-[11px] font-bold"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            View Page
                          </a>
                          <button
                            onClick={() => setSelectedPropertyForPhotos(p)}
                            style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                            className="px-2.5 py-1.5 rounded-lg border hover:opacity-80 transition-all flex items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">photo_library</span>
                            Photos
                          </button>
                          
                          {p.status === "under_negotiation" && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, "live")}
                              className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer animate-pulse"
                            >
                              Release Hold
                            </button>
                          )}

                          {p.status !== "rented" && p.status !== "rejected" && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, "rented")}
                              className="px-2.5 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                            >
                              Rented
                            </button>
                          )}

                          {p.status === "rented" && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, "live")}
                              className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                            >
                              Relist
                            </button>
                          )}
                          
                          {p.status === "pending_review" && (
                            <Link
                              to="/admin/moderation"
                              className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">gavel</span>
                              Review
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination Bar */}
        {!loading && filteredProperties.length > 0 && (
          <div
            className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 p-4 rounded-2xl border shadow-sm"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredProperties.length)}{" "}
              of {filteredProperties.length} listings
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                className="flex items-center gap-1 px-4 py-2 border rounded-xl text-[12px] font-extrabold uppercase tracking-widest disabled:opacity-40 transition-all hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                Previous
              </button>
              
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-extrabold" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)" }}>
                Page {currentPage} of {totalPages || 1}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                className="flex items-center gap-1 px-4 py-2 border rounded-xl text-[12px] font-extrabold uppercase tracking-widest disabled:opacity-40 transition-all hover:opacity-90"
              >
                Next
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🖼️ Manage Photos Modal */}
      {selectedPropertyForPhotos && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b bg-slate-50">
              <div>
                <h3 className="font-extrabold text-[15px] text-slate-900">
                  Manage Photos: Property #{selectedPropertyForPhotos.id}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  {selectedPropertyForPhotos.property_type?.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedPropertyForPhotos(null)}
                className="w-8 h-8 rounded-lg bg-white border shadow-sm flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[350px] overflow-y-auto">
              {selectedPropertyForPhotos.media && selectedPropertyForPhotos.media.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {selectedPropertyForPhotos.media.map((m) => (
                    <div key={m.id} className="relative group overflow-hidden rounded-xl border border-slate-100 shadow-xs">
                      <img
                        src={m.image_url}
                        alt="Property"
                        className="w-full h-28 object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(m.id)}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center justify-center shadow-md transition-all hover:scale-110 opacity-100 sm:opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                        title="Delete Photo"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[36px]">image_not_supported</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest">No photos uploaded</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
              <button
                onClick={() => setSelectedPropertyForPhotos(null)}
                className="h-9 px-4 rounded-xl border bg-white hover:bg-slate-50 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 shadow-sm transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
