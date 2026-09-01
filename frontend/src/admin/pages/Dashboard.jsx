import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { AdminLayout } from "../components/AdminLayout";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";

export const Dashboard = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentEarnings, setAgentEarnings] = useState(null);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [pendingOwnerKycs, setPendingOwnerKycs] = useState([]);
  const [reviewingKycId, setReviewingKycId] = useState(null);

  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    totalListings: 0,
    pendingApprovals: 0,
    pendingOwnerVerifications: 0,
    totalEarnings: 0,
    totalUnlocks: 0,
    totalPgProperties: 0,
    totalPgCapacity: 0,
    totalPgResidents: 0,
    totalPgFreeBeds: 0,
    pgOccupancyRate: 0,
  });

  useEffect(() => {
    fetchProperties();
    fetchPendingOwnerKycs();
    if (user?.role === "admin" || user?.roles?.includes("admin")) {
      fetchAdminAnalytics();
    }
    if (user?.role === "agent" || user?.roles?.includes("agent")) {
      fetchAgentEarnings();
    }
  }, [user]);

  const fetchPendingOwnerKycs = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/owner-kyc/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setPendingOwnerKycs(list);
        setMetrics(prev => ({ ...prev, pendingOwnerVerifications: list.length }));
      }
    } catch (e) {
      console.error("Failed to fetch pending owner KYC:", e);
    }
  };

  const handleReviewOwnerKyc = async (userId, action) => {
    setReviewingKycId(userId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/owner-kyc/${userId}/review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        fetchPendingOwnerKycs();
      }
    } catch (e) {
      console.error("Error reviewing owner KYC:", e);
    } finally {
      setReviewingKycId(null);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/properties/`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const propList = Array.isArray(data) ? data : data.results || [];
        setProperties(propList);

        const pgProps = propList.filter(p => p.property_category === 'pg' || p.property_type?.includes('pg'));
        let cap = 0;
        let free = 0;
        pgProps.forEach(p => {
          cap += Number(p.total_beds) || 0;
          free += Number(p.available_beds) || 0;
        });
        const res = Math.max(0, cap - free);
        const rate = cap > 0 ? roundOneDecimal((res / cap) * 100) : 0;

        setMetrics(prev => ({
          ...prev,
          totalListings: propList.length,
          pendingApprovals: propList.filter(
            (p) => ["pending", "pending_review", "pending_approval", "pending_verification"].includes(p.status) || p.verification_status === "pending_review"
          ).length,
          totalPgProperties: prev.totalPgProperties || pgProps.length,
          totalPgCapacity: prev.totalPgCapacity || cap,
          totalPgResidents: prev.totalPgResidents || res,
          totalPgFreeBeds: prev.totalPgFreeBeds || free,
          pgOccupancyRate: prev.pgOccupancyRate || rate,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const roundOneDecimal = (val) => Math.round(val * 10) / 10;

  const fetchAdminAnalytics = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/analytics/summary/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(prev => ({
          ...prev,
          totalEarnings: data.metrics?.total_revenue_all_time || 0,
          totalUnlocks: data.metrics?.total_unlocks_all_time || 0,
          totalPgProperties: data.metrics?.total_pg_properties || prev.totalPgProperties || 0,
          totalPgCapacity: data.metrics?.total_pg_capacity || prev.totalPgCapacity || 0,
          totalPgResidents: data.metrics?.total_pg_residents || prev.totalPgResidents || 0,
          totalPgFreeBeds: data.metrics?.total_pg_free_beds || prev.totalPgFreeBeds || 0,
          pgOccupancyRate: data.metrics?.pg_occupancy_rate || prev.pgOccupancyRate || 0,
        }));

        if (data.charts && data.charts.unlocks_per_day && data.charts.unlocks_per_day.length > 0) {
          setRevenueChartData(data.charts.unlocks_per_day.map(item => ({
            label: item.date ? item.date.slice(5) : "Day",
            revenue: Number(item.total_rev ?? 0)
          })));
        } else {
          setRevenueChartData([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    }
  };

  const fetchAgentEarnings = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/agents/${user.id}/earnings-summary/`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setAgentEarnings(data);

        if (data.daily_trend && data.daily_trend.length > 0) {
          setRevenueChartData(data.daily_trend.map(d => ({
            label: d.date ? d.date.slice(5) : "Day",
            revenue: d.net_payout || d.amount || 0
          })));
        } else {
          setRevenueChartData([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch agent earnings:", e);
    }
  };

  return (
    <AdminLayout activeTab="dashboard">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: "var(--ink)" }}>
            Overview Dashboard
          </h1>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
            Welcome back, {user?.username}. Here's what's happening today.
          </p>
        </div>
        <div className="hidden md:flex gap-2">
          <button
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
            className="border text-[13px] font-medium h-9 px-4 rounded-md hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>{" "}
            Export
          </button>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI 1: Total Listings */}
        <div
          className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group transition-all duration-300 hover-lift hover:shadow-xl cursor-pointer"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-100 shadow-sm group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[24px]">home_work</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase tracking-wider">Active</span>
          </div>
          <h3 className="text-[11px] font-extrabold mb-1.5 uppercase tracking-widest relative z-10" style={{ color: "var(--text-muted)" }}>Total Listings</h3>
          <p className="text-[32px] font-extrabold tracking-tight relative z-10 leading-none group-hover:text-blue-600 transition-colors" style={{ color: "var(--ink)" }}>
            {metrics.totalListings}
          </p>
        </div>

        {/* KPI 2: Pending Approvals */}
        <Link
          to="/admin/moderation"
          className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group transition-all duration-300 hover-lift hover:shadow-xl cursor-pointer block"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-amber-600 bg-amber-50 border border-amber-100 shadow-sm group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[24px]">pending_actions</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-extrabold uppercase tracking-wider">
              {metrics.pendingOwnerVerifications > 0 ? `${metrics.pendingOwnerVerifications} KYC Pending` : "Review"}
            </span>
          </div>
          <h3 className="text-[11px] font-extrabold mb-1.5 uppercase tracking-widest relative z-10" style={{ color: "var(--text-muted)" }}>Pending Approvals</h3>
          <p className="text-[32px] font-extrabold tracking-tight relative z-10 leading-none group-hover:text-amber-600 transition-colors" style={{ color: "var(--ink)" }}>
            {metrics.pendingApprovals}
          </p>
        </Link>

        {/* KPI 3: Total Earnings / Agent Earnings */}
        <div
          className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group transition-all duration-300 hover-lift hover:shadow-xl cursor-pointer"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 bg-emerald-50 border border-emerald-100 shadow-sm group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[24px]">{agentEarnings ? "account_balance_wallet" : "payments"}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-indigo-600 text-[10px] font-extrabold uppercase tracking-wider">{agentEarnings ? "Wallet" : "Revenue"}</span>
          </div>
          <h3 className="text-[11px] font-extrabold mb-1.5 uppercase tracking-widest relative z-10" style={{ color: "var(--text-muted)" }}>
            {agentEarnings ? "Wallet Balance (Unpaid)" : "Total Platform Revenue"}
          </h3>
          <p className="text-[32px] font-extrabold text-indigo-600 tracking-tight relative z-10 leading-none">
            ₹{agentEarnings ? (agentEarnings.wallet_balance || 0).toLocaleString("en-IN") : metrics.totalEarnings.toLocaleString("en-IN")}
          </p>
          {agentEarnings && agentEarnings.next_payout_date && (
            <p className="text-[11px] font-medium mt-4 relative z-10" style={{ color: "var(--text-muted)" }}>
              Next Payout: <strong style={{ color: "var(--ink)" }}>{new Date(agentEarnings.next_payout_date).toLocaleDateString()}</strong>
            </p>
          )}
        </div>

        {/* KPI 4: Total Unlocks */}
        <div
          className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group transition-all duration-300 hover-lift hover:shadow-xl cursor-pointer"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-600 bg-purple-50 border border-purple-100 shadow-sm group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[24px]">key</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 text-[10px] font-extrabold uppercase tracking-wider">Unlocks</span>
          </div>
          <h3 className="text-[11px] font-extrabold mb-1.5 uppercase tracking-widest relative z-10" style={{ color: "var(--text-muted)" }}>Total Unlocks</h3>
          <p className="text-[32px] font-extrabold text-purple-600 tracking-tight relative z-10 leading-none">
            {metrics.totalUnlocks}
          </p>
        </div>
      </section>

      {/* Pending Owner Identity Verifications Section */}
      {pendingOwnerKycs.length > 0 && (
        <section className="mb-8 animate-in fade-in duration-300">
          <div
            className="rounded-3xl p-6 shadow-sm border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-6" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-[16px] tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    Owner Verification Requests
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white animate-pulse">
                      {pendingOwnerKycs.length} Action Required
                    </span>
                  </h3>
                  <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                    Owners who uploaded identity proof or property ownership documents awaiting admin review
                  </p>
                </div>
              </div>

              <Link
                to="/admin/agents"
                className="text-[12px] font-extrabold text-indigo-600 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                Open Verifications Hub
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOwnerKycs.map((owner) => (
                <div
                  key={owner.id}
                  className="rounded-2xl p-5 border flex flex-col justify-between space-y-4"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-950 text-white font-black text-[13px] flex items-center justify-center">
                          {owner.username?.charAt(0).toUpperCase() || "O"}
                        </div>
                        <div>
                          <p className="font-extrabold text-[13px]" style={{ color: "var(--ink)" }}>
                            @{owner.username}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                            {owner.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-700 border border-amber-500/30">
                        {owner.owner_kyc_status || "submitted"}
                      </span>
                    </div>

                    <div className="text-[12px] space-y-1">
                      {owner.email && (
                        <p className="text-[11px] text-slate-500">
                          Email: <strong className="text-slate-800">{owner.email}</strong>
                        </p>
                      )}
                      <div className="pt-1">
                        {owner.ownership_document_url ? (
                          <a
                            href={owner.ownership_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px] hover:bg-indigo-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                            View Uploaded Proof
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No document file attached</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <button
                      type="button"
                      disabled={reviewingKycId === owner.id}
                      onClick={() => handleReviewOwnerKyc(owner.id, "reject")}
                      className="flex-1 py-2 px-3 rounded-xl border text-[11.5px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border-red-200 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[15px]">cancel</span>
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={reviewingKycId === owner.id}
                      onClick={() => handleReviewOwnerKyc(owner.id, "approve")}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[11.5px] uppercase cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PG Residents & Occupancy Insights Section */}
      <section className="mb-8">
        <div
          className="rounded-3xl p-6 shadow-sm border relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white"
          style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-500/20 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <span className="material-symbols-outlined text-[22px]">hotel</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  PG Resident Occupancy &amp; Capacity Tracker
                </h3>
                <p className="text-[12px] text-indigo-200/70 font-medium">
                  Live tracking of post-registration residents across all PG properties
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-black/20 text-emerald-300 border border-indigo-600/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {metrics.pgOccupancyRate}% Occupancy Rate
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">PG Listings</span>
              <div className="text-2xl font-black text-white">{metrics.totalPgProperties} PGs</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 block mb-1">Total Capacity</span>
              <div className="text-2xl font-black text-white">{metrics.totalPgCapacity} Beds</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200 block mb-1">Persons Residing</span>
              <div className="text-2xl font-black text-indigo-300">{metrics.totalPgResidents} Persons</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/15 border border-indigo-600/30">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 block mb-1">Free Available Beds</span>
              <div className="text-2xl font-black text-emerald-300">{metrics.totalPgFreeBeds} Beds</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Chart & Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Chart Area */}
        <div
          className="lg:col-span-8 border rounded-2xl p-6 md:p-8 shadow-sm flex flex-col relative overflow-hidden"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              Revenue Growth
            </h2>
            <select
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              className="border text-[12px] font-bold rounded-xl px-3 py-2 outline-none focus:border-orange-500 shadow-sm cursor-pointer transition-all"
            >
              <option>Last 30 Days</option>
              <option>This Quarter</option>
              <option>Year to Date</option>
            </select>
          </div>

          <div
            className="flex-1 min-h-[300px] rounded-xl relative overflow-hidden flex flex-col justify-center items-center border shadow-inner p-4"
            style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
          >
            {revenueChartData.length === 0 || revenueChartData.every((d) => d.revenue === 0) ? (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 mb-1">
                  <span className="material-symbols-outlined text-[24px]">show_chart</span>
                </div>
                <h4 className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>₹0 Revenue Recorded</h4>
                <p className="text-[12px] font-medium max-w-sm" style={{ color: "var(--text-muted)" }}>
                  No revenue transactions recorded in this period yet. Real payment data will automatically graph here as transactions occur.
                </p>
              </div>
            ) : (
              <div className="w-full h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="realRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                      formatter={(val) => [`₹${val}`, "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={3} fillOpacity={1} fill="url(#realRevenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity List */}
        <div
          className="lg:col-span-4 rounded-3xl p-6 md:p-8 shadow-sm border flex flex-col h-full min-h-[420px] relative"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h2 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              Recent Properties
            </h2>
            <Link
              to="/admin/properties"
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--accent)" }}
              className="text-[11px] font-extrabold uppercase tracking-widest hover:opacity-90 transition-colors px-3 py-1.5 rounded-lg border shadow-sm flex items-center gap-1"
            >
              View All
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 relative z-10">
            {loading ? (
              <p className="text-[13px] font-medium text-center py-10" style={{ color: "var(--text-muted)" }}>
                Loading...
              </p>
            ) : properties.length === 0 ? (
              <p className="text-[13px] font-medium text-center py-10" style={{ color: "var(--text-muted)" }}>
                No recent properties.
              </p>
            ) : (
              properties.slice(0, 5).map((prop) => (
                <div
                  key={prop.id}
                  className="flex gap-4 items-start p-3 transition-all duration-300 rounded-xl group border cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
                >
                  <div
                    className="w-12 h-12 rounded-xl shrink-0 border flex items-center justify-center shadow-sm transition-all duration-300"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--accent)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {prop.status === "approved"
                        ? "check_circle"
                        : prop.status === "pending"
                          ? "pending"
                          : "cancel"}
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[13px] font-bold line-clamp-1 capitalize tracking-wide" style={{ color: "var(--ink)" }}>
                      {prop.property_type} Listed
                    </p>
                    <p className="text-[12px] line-clamp-1 mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                      Owner: {prop.owner_name}
                    </p>
                    <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1.5 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shadow-sm ${prop.status === "approved" ? "bg-black shadow-emerald-500/50" : prop.status === "pending" ? "bg-amber-500 shadow-amber-500/50" : "bg-red-500 shadow-red-500/50"}`}
                      ></span>
                      {prop.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Agent Payouts History (Only for Agents) */}
      {user?.role === "agent" && agentEarnings?.payout_batches && (
        <section className="mb-8">
          <div
            className="rounded-3xl shadow-sm border overflow-hidden"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                My Payout History
              </h2>
              <p className="text-[12px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                Track your weekly settlements and bank transfers.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Cycle Dates</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Amount</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Status</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">UTR / Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[13px] font-medium" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                  {(!agentEarnings?.payout_batches || agentEarnings.payout_batches.length === 0) ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                        No payout history yet.
                      </td>
                    </tr>
                  ) : (
                    agentEarnings.payout_batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-500">
                            {new Date(batch.cycle_start_date).toLocaleDateString()} - {new Date(batch.cycle_end_date).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-indigo-600">
                          ₹{parseFloat(batch.total_amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-4">
                          {batch.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-700">
                              <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                              PROCESSING
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {batch.utr_number ? (
                            <div className="flex flex-col gap-2 items-start">
                              <span className="font-mono text-[12px] text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded">
                                {batch.utr_number}
                              </span>
                              <button 
                                onClick={() => window.open(`${import.meta.env.VITE_API_URL}/earnings/payout-batches/${batch.id}/receipt/`, "_blank")}
                                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">download</span>
                                Download Statement
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400">Waiting for transfer...</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

    </AdminLayout>
  );
};
