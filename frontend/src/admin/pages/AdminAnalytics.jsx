import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
  "#ec4899",
];

export const AdminAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState([]);
  const [selectedCityId, setSelectedCityId] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/cities/`)
      .then((res) => res.json())
      .then((data) => setCities(data))
      .catch((err) => console.error("Error fetching cities:", err));
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/admin");
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const url = selectedCityId
          ? `${import.meta.env.VITE_API_URL}/analytics/summary/?city_id=${selectedCityId}`
          : `${import.meta.env.VITE_API_URL}/analytics/summary/`;
        const res = await fetch(url, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          toast.error("Failed to load analytics data.");
        }
      } catch (e) {
        toast.error("Network error fetching analytics.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user, navigate, selectedCityId]);

  if (loading) {
    return (
      <AdminLayout activeTab="analytics">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[12px]">
              Loading Analytics...
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  return (
    <AdminLayout activeTab="analytics">
      <div className="relative z-10 w-full">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 drop-shadow-sm" style={{ color: "var(--ink)" }}>
              Platform Analytics
            </h1>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
              Monitor platform performance, unlocks, and agent rankings in real-time.
            </p>
          </div>
          <div>
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
              className="border px-5 py-2.5 rounded-xl outline-none focus:border-orange-500 font-bold text-[13px] shadow-sm cursor-pointer transition-all"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Live Listings */}
          <div
            className="rounded-2xl p-6 border shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-default"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border group-hover:-translate-y-2 transition-all duration-500"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[28px] group-hover:text-orange-500 transition-colors">
                  home_work
                </span>
              </div>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1 relative z-10" style={{ color: "var(--text-muted)" }}>
              Total Live Listings
            </p>
            <p className="text-4xl font-extrabold tracking-tight relative z-10 drop-shadow-sm" style={{ color: "var(--ink)" }}>
              {data.metrics.total_live_listings}
            </p>
          </div>

          {/* Unlocks This Month */}
          <div
            className="rounded-2xl p-6 border shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-default"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border group-hover:rotate-45 group-hover:scale-110 transition-all duration-500"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[28px] group-hover:text-orange-500 transition-colors">
                  vpn_key
                </span>
              </div>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1 relative z-10" style={{ color: "var(--text-muted)" }}>
              Unlocks This Month
            </p>
            <p className="text-4xl font-extrabold tracking-tight relative z-10 drop-shadow-sm" style={{ color: "var(--ink)" }}>
              {data.metrics.total_unlocks_this_month}
            </p>
          </div>

          {/* Revenue This Month */}
          <div
            className="rounded-2xl p-6 border shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-default"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border group-hover:animate-bounce transition-all duration-500"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[28px] group-hover:text-emerald-500 transition-colors">
                  payments
                </span>
              </div>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1 relative z-10" style={{ color: "var(--text-muted)" }}>
              Revenue This Month
            </p>
            <p className="text-4xl font-extrabold tracking-tight relative z-10 drop-shadow-sm truncate" style={{ color: "var(--ink)" }}>
              ₹{data.metrics.total_revenue_this_month}
            </p>
          </div>

          {/* Avg Review Time */}
          <div
            className="rounded-2xl p-6 border shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-default"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border group-hover:-rotate-90 transition-all duration-700 ease-in-out"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[28px] group-hover:text-amber-500 transition-colors">
                  schedule
                </span>
              </div>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1 relative z-10" style={{ color: "var(--text-muted)" }}>
              Avg Review Time
            </p>
            <p className="text-4xl font-extrabold tracking-tight relative z-10 drop-shadow-sm" style={{ color: "var(--ink)" }}>
              {data.metrics.avg_review_hours_last_30d}
              <span className="text-xl font-bold ml-1.5" style={{ color: "var(--text-muted)" }}>
                hrs
              </span>
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div
            className="rounded-2xl p-6 border shadow-sm lg:col-span-2 relative"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="text-[16px] font-bold mb-6" style={{ color: "var(--ink)" }}>
              Unlocks Per Day (Last 30 Days)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.charts.unlocks_per_day}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      boxShadow: "0 8px 30px rgb(0 0 0 / 0.2)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#FF6B00"
                    strokeWidth={4}
                    dot={{ r: 5, strokeWidth: 2, fill: "var(--surface)" }}
                    activeDot={{
                      r: 7,
                      fill: "#FF6B00",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-2xl p-6 border shadow-sm lg:col-span-1"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="text-[16px] font-bold mb-6" style={{ color: "var(--ink)" }}>
              Listings by Status
            </h2>
            <div className="h-72 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.listings_by_status}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  >
                    {data.charts.listings_by_status.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      boxShadow: "0 8px 30px rgb(0 0 0 / 0.2)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-2xl shadow-sm border overflow-hidden"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="p-6 border-b"
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
            >
              <h2 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                Top 10 Unlocked Properties
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead style={{ backgroundColor: "var(--surface-alt)" }}>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Property ID
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Type
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Unlocks
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {data.tables.top_properties.map((p) => (
                    <tr
                      key={p.id}
                      className="transition-colors hover:opacity-90"
                      style={{ borderBottomColor: "var(--border)" }}
                    >
                      <td className="px-6 py-4 text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                        #{p.id}{" "}
                        <span className="font-medium" style={{ color: "var(--text-muted)" }}>
                          ({p.owner_name})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium capitalize" style={{ color: "var(--ink)" }}>
                        {p.property_type}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-orange-500">
                        {p.unlock_count}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/property/${p.id}`}
                          style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--accent)" }}
                          className="inline-flex items-center gap-1 border text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-sm transition-all"
                        >
                          View{" "}
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.tables.top_properties.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-[13px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No properties found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="rounded-2xl shadow-sm border overflow-hidden"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="p-6 border-b"
              style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
            >
              <h2 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                Agent Performance Rankings
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead style={{ backgroundColor: "var(--surface-alt)" }}>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Agent
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Submitted
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Approved
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Trust Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {data.tables.agents_ranked.map((a) => (
                    <tr
                      key={a.id}
                      className="transition-colors hover:opacity-90"
                      style={{ borderBottomColor: "var(--border)" }}
                    >
                      <td className="px-6 py-4 text-[13px] font-bold flex items-center gap-3" style={{ color: "var(--ink)" }}>
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[12px] font-bold border border-orange-500/20 shadow-sm">
                          {a.username.charAt(0).toUpperCase()}
                        </div>
                        {a.username}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
                        {a.submitted_count}
                      </td>
                      <td className="px-6 py-4 text-[13px] font-extrabold text-emerald-500">
                        {a.approved_count}
                      </td>
                      <td className="px-6 py-4">
                        {a.trust_score !== null ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border shadow-sm ${a.trust_score >= 80 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : a.trust_score >= 50 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}
                          >
                            {a.trust_score}%
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                            No data
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.tables.agents_ranked.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-[13px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
