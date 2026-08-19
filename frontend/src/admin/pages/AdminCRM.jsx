import React, { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const AdminCRM = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [passFilter, setPassFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [inspectUser, setInspectUser] = useState(null);

  useEffect(() => {
    fetchCrmUsers();
  }, [selectedRole, accountStatus, passFilter, listingFilter, sortBy]);

  const fetchCrmUsers = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL}/accounts/admin/crm/`;
      const params = new URLSearchParams();
      if (selectedRole !== "all") params.append("role", selectedRole);
      if (accountStatus !== "all") params.append("account_status", accountStatus);
      if (passFilter !== "all") params.append("pass_filter", passFilter);
      if (listingFilter !== "all") params.append("listing_filter", listingFilter);
      if (sortBy !== "newest") params.append("sort_by", sortBy);
      if (search) params.append("search", search);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast.error("Failed to load CRM user data.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error loading CRM.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCrmUsers();
  };

  const resetAllFilters = () => {
    setSearch("");
    setSelectedRole("all");
    setAccountStatus("all");
    setPassFilter("all");
    setListingFilter("all");
    setSortBy("newest");
  };

  const handleToggleUserStatus = async (userId, currentUsername) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/crm/${userId}/toggle-status/`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.detail);
        if (inspectUser && inspectUser.id === userId) {
          setInspectUser(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
        }
        fetchCrmUsers();
      } else {
        toast.error("Failed to update user status.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  const totalBuyers = users.filter(u => u.roles?.includes("buyer") || u.role === "buyer").length;
  const totalOwners = users.filter(u => u.roles?.includes("owner") || u.role === "owner").length;
  const totalUnlocks = users.reduce((acc, u) => acc + (u.buyer_stats?.total_unlocks_count || 0), 0);
  const totalListings = users.reduce((acc, u) => acc + (u.owner_stats?.total_properties_listed || 0), 0);

  return (
    <AdminLayout activeTab="users">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16 pt-2">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--accent)" }}>
                <span className="material-symbols-outlined text-[18px]">people</span>
              </div>
              <h1 className="text-[24px] md:text-[26px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
                Users &amp; CRM Intelligence
              </h1>
            </div>
            <p className="text-[13px] font-medium mt-1.5" style={{ color: "var(--text-muted)" }}>
              Multi-filter CRM intelligence for Buyers &amp; Owners: active passes, unlock credits, listed properties &amp; payments.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 self-start md:self-auto">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px]" style={{ color: "var(--text-muted)" }}>search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email..."
                className="h-10 pl-9 pr-4 rounded-xl border text-[12.5px] font-bold outline-none shadow-sm w-64 transition-all"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              />
            </div>
            <button
              type="submit"
              className="h-10 px-5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>

        {/* Metrics Overview Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-3xl p-5 border shadow-sm transition-all hover:shadow-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Buyers Registered</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--accent)" }}>
                <span className="material-symbols-outlined text-[20px]">person_search</span>
              </div>
            </div>
            <p className="text-[26px] font-extrabold mt-2 tracking-tight" style={{ color: "var(--ink)" }}>{totalBuyers}</p>
          </div>

          <div className="rounded-3xl p-5 border shadow-sm transition-all hover:shadow-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Owners Registered</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--accent)" }}>
                <span className="material-symbols-outlined text-[20px]">real_estate_agent</span>
              </div>
            </div>
            <p className="text-[26px] font-extrabold mt-2 tracking-tight" style={{ color: "var(--ink)" }}>{totalOwners}</p>
          </div>

          <div className="rounded-3xl p-5 border shadow-sm transition-all hover:shadow-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Unlocks Paid</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <span className="material-symbols-outlined text-[20px]">key</span>
              </div>
            </div>
            <p className="text-[26px] font-extrabold mt-2 tracking-tight text-emerald-500">{totalUnlocks}</p>
          </div>

          <div className="rounded-3xl p-5 border shadow-sm transition-all hover:shadow-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Properties Listed</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <span className="material-symbols-outlined text-[20px]">home_work</span>
              </div>
            </div>
            <p className="text-[26px] font-extrabold mt-2 tracking-tight text-amber-500">{totalListings}</p>
          </div>
        </div>

        {/* MULTI-FILTER CONTROL BAR */}
        <div className="rounded-3xl p-4 border mb-8 shadow-sm space-y-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          
          {/* Top Row: Role Segmented Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All Users", icon: "group" },
                { id: "buyer", label: "Buyers Only", icon: "shopping_cart" },
                { id: "owner", label: "Owners Only", icon: "store" },
                { id: "agent", label: "Field Agents", icon: "badge" },
                { id: "sub_admin", label: "Sub-Admins", icon: "manage_accounts" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedRole(tab.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-extrabold transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedRole === tab.id ? "var(--accent)" : "var(--surface-alt)",
                    color: selectedRole === tab.id ? "#ffffff" : "var(--ink)",
                    borderColor: "var(--border)"
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={resetAllFilters}
              className="px-3 py-1.5 rounded-xl border text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all hover:bg-red-500/10 hover:text-red-500"
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              Reset Filters
            </button>
          </div>

          {/* Bottom Row: Detailed Dropdown Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[12px]">
            
            {/* Pass / Subscription Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Unlock Pass Filter:
              </label>
              <select
                value={passFilter}
                onChange={(e) => setPassFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border font-extrabold outline-none cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <option value="all">All Pass Types</option>
                <option value="has_active_pass">🟢 Active Pass Holders</option>
                <option value="starter_39">Starter Pass (₹39)</option>
                <option value="smart_79">Smart Pass (₹79)</option>
                <option value="pro_129">Pro Hunter Pass (₹129)</option>
                <option value="single_14">Single Unlock (₹14)</option>
                <option value="no_pass">⚪ No Active Pass</option>
              </select>
            </div>

            {/* Listing Status Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Owner Listing Filter:
              </label>
              <select
                value={listingFilter}
                onChange={(e) => setListingFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border font-extrabold outline-none cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <option value="all">All Listing Statuses</option>
                <option value="has_active">🏠 Active Live Listings</option>
                <option value="has_pending">⏳ Pending Review</option>
                <option value="no_listings">🚫 0 Properties Listed</option>
              </select>
            </div>

            {/* Account Status Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Account Status:
              </label>
              <select
                value={accountStatus}
                onChange={(e) => setAccountStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border font-extrabold outline-none cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <option value="all">All Accounts (Active &amp; Blocked)</option>
                <option value="active">🟢 Active Accounts Only</option>
                <option value="blocked">🔴 Blocked Accounts Only</option>
              </select>
            </div>

            {/* Sort Order Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                Sort Results By:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border font-extrabold outline-none cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <option value="newest">📅 Newest Registered First</option>
                <option value="oldest">⌛ Oldest Registered First</option>
                <option value="most_spent">💰 Most Money Spent</option>
                <option value="most_listings">🏠 Most Properties Listed</option>
                <option value="name">🔤 Alphabetical (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* CRM Users Roster Grid - Equal Height Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-300 border-t-slate-900 animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-3xl p-12 text-center border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
              <span className="material-symbols-outlined text-[32px]">filter_alt_off</span>
            </div>
            <h3 className="text-[18px] font-extrabold mb-1" style={{ color: "var(--ink)" }}>No Users Match Filter</h3>
            <p className="text-[13px] max-w-md mx-auto mb-4" style={{ color: "var(--text-muted)" }}>
              No registered accounts meet your combined search and filter criteria.
            </p>
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white rounded-xl font-extrabold text-[12px] uppercase cursor-pointer shadow-md"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {users.map((u) => {
              const isBuyer = u.roles?.includes("buyer") || u.role === "buyer";
              const isOwner = u.roles?.includes("owner") || u.role === "owner";
              const activePass = u.buyer_stats?.active_pass;

              return (
                <div
                  key={u.id}
                  className="rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="space-y-4">
                    {/* User Profile Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white font-extrabold text-[16px] flex items-center justify-center shadow-md border border-slate-800 flex-shrink-0">
                          {u.username ? u.username.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[15px] leading-tight truncate" style={{ color: "var(--ink)" }}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ""}` : u.username}
                          </h3>
                          <span className="text-[11.5px] font-semibold block mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            @{u.username} {u.phone ? `· ${u.phone}` : ""}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10.5px] border flex-shrink-0 ${
                        u.is_active
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-500 border-red-500/30'
                      }`}>
                        {u.is_active ? 'Active' : 'Blocked'}
                      </span>
                    </div>

                    {/* Roles Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles?.map(r => (
                        <span key={r} className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border shadow-xs flex items-center gap-1" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}>
                          <span className="material-symbols-outlined text-[13px]" style={{ color: "var(--accent)" }}>
                            {r === "buyer" ? "shopping_cart" : r === "owner" ? "store" : r === "admin" ? "shield_person" : "manage_accounts"}
                          </span>
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* Unified Executive CRM Stats Box */}
                    <div className="p-4 rounded-2xl border text-[12px] space-y-3 shadow-xs" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                      {/* Active Unlock Pass Row */}
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unlock Pass:</span>
                        <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-[11px] border ${
                          activePass?.pass_type
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {activePass?.pass_type ? activePass.pass_type.replace('_', ' ').toUpperCase() : "No Active Pass"}
                        </span>
                      </div>

                      {/* 2-Column Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {isBuyer && (
                          <>
                            <div>
                              <span className="text-[10px] font-bold block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Remaining:</span>
                              <span className="font-extrabold text-emerald-500">{activePass?.credits_remaining || 0} Unlocks</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Paid Unlocks:</span>
                              <span className="font-extrabold" style={{ color: "var(--ink)" }}>{u.buyer_stats?.total_unlocks_count || 0} (&#8377;{u.buyer_stats?.total_spent || 0})</span>
                            </div>
                          </>
                        )}

                        {isOwner && (
                          <>
                            <div>
                              <span className="text-[10px] font-bold block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Listed Props:</span>
                              <span className="font-extrabold text-amber-500">{u.owner_stats?.total_properties_listed || 0} Total</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Leads Recv:</span>
                              <span className="font-extrabold" style={{ color: "var(--ink)" }}>{u.owner_stats?.total_leads_received || 0} Inquiries</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => setInspectUser(u)}
                      className="flex-1 h-10 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white rounded-xl text-[12px] font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      Full CRM Profile
                    </button>

                    <button
                      onClick={() => handleToggleUserStatus(u.id, u.username)}
                      className={`h-10 px-3.5 rounded-xl border text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer flex-shrink-0 ${
                        u.is_active
                          ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {u.is_active ? 'Block' : 'Unblock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FULL CRM INSPECT MODAL */}
        {inspectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setInspectUser(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-6 border-b pb-5" style={{ borderColor: "var(--border)" }}>
                <div className="w-14 h-14 rounded-2xl bg-slate-950 text-white font-extrabold text-[22px] flex items-center justify-center border border-slate-800 shadow-md">
                  {inspectUser.username ? inspectUser.username.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[20px] font-extrabold" style={{ color: "var(--ink)" }}>
                      {inspectUser.first_name ? `${inspectUser.first_name} ${inspectUser.last_name || ""}` : inspectUser.username}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      inspectUser.is_active
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-500 border-red-500/30'
                    }`}>
                      {inspectUser.is_active ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                    @{inspectUser.username} • Phone: {inspectUser.phone || "N/A"} • Role: {inspectUser.role || "User"}
                  </p>
                </div>
              </div>

              {/* Structured 2-Column CRM Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl border text-[12px] space-y-2" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Active Subscription</span>
                    <span className="font-extrabold text-emerald-500">
                      {inspectUser.buyer_stats?.active_pass?.pass_type
                        ? inspectUser.buyer_stats.active_pass.pass_type.replace('_', ' ').toUpperCase()
                        : "No Active Pass"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>Remaining Unlocks:</span>
                    <span className="font-extrabold text-emerald-500">{inspectUser.buyer_stats?.active_pass?.credits_remaining || 0} Credits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>Member Since:</span>
                    <span className="font-extrabold" style={{ color: "var(--ink)" }}>{new Date(inspectUser.date_joined || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border text-[12px] space-y-2" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Activity &amp; Revenue</span>
                    <span className="font-extrabold" style={{ color: "var(--ink)" }}>CRM Overview</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>Total Unlocks Paid:</span>
                    <span className="font-extrabold text-emerald-500">{inspectUser.buyer_stats?.total_unlocks_count || 0} (&#8377;{inspectUser.buyer_stats?.total_spent || 0})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>Listed Properties:</span>
                    <span className="font-extrabold text-amber-500">{inspectUser.owner_stats?.total_properties_listed || 0} Listed</span>
                  </div>
                </div>
              </div>

              {/* History Details */}
              <div className="space-y-6">
                {/* Buyer Unlocks Log */}
                <div>
                  <h4 className="text-[12px] font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">key</span>
                    Contact Unlocks History:
                  </h4>
                  {inspectUser.buyer_stats?.recent_unlocks?.length > 0 ? (
                    <div className="space-y-2">
                      {inspectUser.buyer_stats.recent_unlocks.map(un => (
                        <div key={un.id} className="p-3 rounded-2xl border flex items-center justify-between text-[12px]" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                          <div>
                            <p className="font-extrabold" style={{ color: "var(--ink)" }}>{un.property_title}</p>
                            <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>Unlocked: {new Date(un.unlocked_at || Date.now()).toLocaleDateString()}</p>
                          </div>
                          <span className="font-extrabold text-emerald-500">&#8377;{un.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border text-center border-dashed" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                      <p className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
                        No property contact unlocks recorded yet for this buyer account.
                      </p>
                    </div>
                  )}
                </div>

                {/* Owner Properties Log */}
                <div>
                  <h4 className="text-[12px] font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[16px] text-amber-500">home_work</span>
                    Listed Properties History:
                  </h4>
                  {inspectUser.owner_stats?.listed_properties?.length > 0 ? (
                    <div className="space-y-2">
                      {inspectUser.owner_stats.listed_properties.map(p => (
                        <div key={p.id} className="p-3 rounded-2xl border flex items-center justify-between text-[12px]" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                          <div>
                            <p className="font-extrabold" style={{ color: "var(--ink)" }}>{p.title}</p>
                            <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>{p.city} • Listed: {new Date(p.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border text-center border-dashed" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                      <p className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
                        No properties listed on record for this owner account.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="mt-6 pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => handleToggleUserStatus(inspectUser.id, inspectUser.username)}
                  className={`px-4 py-2 rounded-xl border text-[11px] font-extrabold uppercase tracking-wider cursor-pointer ${
                    inspectUser.is_active
                      ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  {inspectUser.is_active ? 'Block Account' : 'Unblock Account'}
                </button>

                <button
                  onClick={() => setInspectUser(null)}
                  className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
