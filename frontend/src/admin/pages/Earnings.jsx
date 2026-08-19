import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminLayout } from "../components/AdminLayout";

export const Earnings = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    agent: "",
    status: "",
    start_date: "",
    end_date: "",
  });
  const [agents, setAgents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/users/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setAgents(data.filter((u) => u.role === "agent")))
      .catch(console.error);
  }, []);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/?${query.toString()}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (e) {
      toast.error("Failed to fetch earnings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [filters]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkMarkPaid = async () => {
    let successCount = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/earnings/${id}/mark-paid/`,
          {
            method: "PATCH",
            credentials: "include",
          },
        );
        if (res.ok) successCount++;
      } catch (e) {
        console.error(e);
      }
    }
    toast.success(`Marked ${successCount} entries as paid`);
    setSelectedIds(new Set());
    fetchEarnings();
  };

  const totalPending = entries
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalApproved = entries
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalPaid = entries
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.agent_details?.username?.toLowerCase().includes(q) ||
      e.source_type?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AdminLayout activeTab="earnings">
      <ToastContainer position="top-right" />
      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px]">
                account_balance_wallet
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                Earnings
              </h1>
              <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
                Review, track, and process agent payouts.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 min-w-[200px] md:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-emerald-500 transition-colors">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 w-full border rounded-xl text-[13px] font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                placeholder="Search earnings..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto md:justify-end">
              <button
                onClick={fetchEarnings}
                className="flex items-center justify-center w-12 h-12 border rounded-xl shadow-sm transition-all hover:opacity-90 cursor-pointer flex-shrink-0"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                title="Refresh List"
              >
                <span className="material-symbols-outlined text-[20px]">
                  refresh
                </span>
              </button>
              <button
                onClick={handleBulkMarkPaid}
                disabled={selectedIds.size === 0}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 h-12 rounded-xl text-[13px] font-extrabold uppercase tracking-widest disabled:opacity-50 transition-all shadow-md bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[17px]">
                  done_all
                </span>
                Mark Paid ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            {
              label: "Total Pending",
              value: totalPending,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Total Approved",
              value: totalApproved,
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              label: "Total Paid",
              value: totalPaid,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group hover:shadow-md transition-shadow"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div
                className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-60 pointer-events-none ${stat.bg} blur-2xl`}
              ></div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1.5 relative z-10" style={{ color: "var(--text-muted)" }}>
                {stat.label}
              </p>
              <p
                className={`text-[32px] font-extrabold tracking-tight relative z-10 leading-none ${stat.color}`}
              >
                &#8377;{stat.value.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center gap-3.5 border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-[18px] text-slate-400">
              filter_alt
            </span>
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500 sm:hidden">Filters</span>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center w-full">
            {/* Dropdowns group */}
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={filters.agent}
                onChange={(e) => {
                  setFilters({ ...filters, agent: e.target.value });
                  setCurrentPage(1);
                }}
                className="rounded-xl px-3 py-2 text-[13px] font-bold outline-none cursor-pointer border focus:border-emerald-500 flex-1 sm:flex-initial"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <option value="">All Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setCurrentPage(1);
                }}
                className="rounded-xl px-3 py-2 text-[13px] font-bold outline-none cursor-pointer border focus:border-emerald-500 flex-1 sm:flex-initial"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <option value="">All Statuses</option>
                {["pending", "approved", "paid"].map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range group */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => {
                  setFilters({ ...filters, start_date: e.target.value });
                  setCurrentPage(1);
                }}
                className="rounded-xl px-3 py-2 text-[13px] font-bold outline-none border focus:border-emerald-500 flex-1 sm:flex-initial w-full sm:w-auto"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0">
                to
              </span>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => {
                  setFilters({ ...filters, end_date: e.target.value });
                  setCurrentPage(1);
                }}
                className="rounded-xl px-3 py-2 text-[13px] font-bold outline-none border focus:border-emerald-500 flex-1 sm:flex-initial w-full sm:w-auto"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl border shadow-sm overflow-hidden mb-8" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            {/* 🖥️ Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    {["Sel", "Date", "Agent", "Source", "Amount", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center sticky left-0 right-0">
                        <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                          <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                          <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                            Loading…
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center sticky left-0 right-0">
                        <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                          <span className="material-symbols-outlined text-5xl text-emerald-500/80 mb-2 block">
                            receipt_long
                          </span>
                          <p className="text-[14px] font-extrabold uppercase tracking-widest text-center" style={{ color: "var(--ink)" }}>
                            No Earnings Found
                          </p>
                          <p className="text-[12px] font-medium text-center" style={{ color: "var(--text-muted)" }}>
                            Try adjusting your filters or search query.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:opacity-90 transition-all duration-300"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td className="px-6 py-5 text-center">
                          {entry.status === "approved" && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
                              checked={selectedIds.has(entry.id)}
                              onChange={() => toggleSelect(entry.id)}
                            />
                          )}
                        </td>
                        <td className="px-6 py-5 text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}>
                              {entry.agent_details?.username
                                ?.charAt(0)
                                ?.toUpperCase()}
                            </div>
                            <div>
                              <span className="text-[13px] font-extrabold block" style={{ color: "var(--ink)" }}>
                                {entry.agent_details?.username}
                              </span>
                              {entry.agent_details?.kyc_upi_id && (
                                <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px]">qr_code_2</span>
                                  {entry.agent_details.kyc_upi_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-[13px] font-bold capitalize" style={{ color: "var(--text-muted)" }}>
                          {entry.source_type.replace("_", " ")}
                        </td>
                        <td className="px-6 py-5 font-extrabold text-[15px] text-emerald-600">
                          &#8377;{entry.amount}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                              entry.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : entry.status === "approved"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 📱 Mobile Card Stack View */}
            <div className="md:hidden divide-y divide-border" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Loading…
                    </p>
                  </div>
                </div>
              ) : paginatedEntries.length === 0 ? (
                <div className="py-20 text-center">
                  <span className="material-symbols-outlined text-5xl text-emerald-500/80 mb-2 block">
                    receipt_long
                  </span>
                  <p className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
                    No Earnings Found
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                    Try adjusting your filters or search query.
                  </p>
                </div>
              ) : (
                paginatedEntries.map((entry) => (
                  <div key={entry.id} className="p-4 space-y-3" style={{ backgroundColor: "var(--surface)" }}>
                    <div className="flex items-start justify-between">
                      {/* Left: Checkbox + Agent Avatar/Details */}
                      <div className="flex items-center gap-3">
                        {entry.status === "approved" && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border shrink-0" style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            {entry.agent_details?.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[13px] font-extrabold block" style={{ color: "var(--ink)" }}>
                              {entry.agent_details?.username}
                            </span>
                            {entry.agent_details?.kyc_upi_id && (
                              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">qr_code_2</span>
                                {entry.agent_details.kyc_upi_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount */}
                      <div className="text-right">
                        <span className="font-extrabold text-[15px] text-emerald-600 block">&#8377;{entry.amount}</span>
                        <span
                          className={`inline-block px-2 py-0.5 mt-1 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            entry.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : entry.status === "approved"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11.5px] pt-2 border-t border-dashed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <div>
                        <span className="font-bold">Source:</span> <span className="capitalize">{entry.source_type.replace("_", " ")}</span>
                      </div>
                      <div>
                        <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && filteredEntries.length > 0 && (
          <div className="flex justify-between items-center mb-8 p-4 rounded-2xl border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{" "}
              {filteredEntries.length} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[12px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[16px]">
                  chevron_left
                </span>{" "}
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[12px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                Next{" "}
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
