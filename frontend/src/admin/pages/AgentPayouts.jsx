import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminLayout } from "../components/AdminLayout";

export const AgentPayouts = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    agent: "",
  });
  const [agents, setAgents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [payingBatchId, setPayingBatchId] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const itemsPerPage = 10;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/users/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const safeData = Array.isArray(data) ? data : [];
        setAgents(safeData.filter((u) => u.role === "agent"));
      })
      .catch(console.error);
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/payout-batches/?${query.toString()}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      toast.error("Failed to fetch payout batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [filters]);

  const handlePayBatch = async (batchId) => {
    if (!utrNumber.trim()) {
      toast.warn("Please enter a UTR Number / Reference");
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/payout-batches/${batchId}/mark-paid/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ utr_number: utrNumber }),
        }
      );
      if (res.ok) {
        toast.success("Batch marked as PAID!");
        setPayingBatchId(null);
        setUtrNumber("");
        fetchBatches();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to mark batch as paid");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const safeBatches = Array.isArray(batches) ? batches : [];
  const totalProcessing = safeBatches
    .filter((b) => b.status === "processing")
    .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
  const totalPaid = safeBatches
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

  const filteredBatches = safeBatches.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.agent_details?.username?.toLowerCase().includes(q) ||
      b.utr_number?.toLowerCase().includes(q) ||
      b.id?.toString().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <AdminLayout activeTab="payouts">
      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px]">
                account_balance
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                Agent Payouts
              </h1>
              <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
                Process weekly settlement batches for agents.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 min-w-[200px] md:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-blue-500 transition-colors">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 w-full border rounded-xl text-[13px] font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                placeholder="Search agent or UTR..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <button
              onClick={fetchBatches}
              className="flex items-center justify-center w-12 h-12 border rounded-xl shadow-sm transition-all hover:opacity-90 cursor-pointer flex-shrink-0"
              style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
              title="Refresh List"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div
            className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group hover:shadow-md transition-shadow"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-60 pointer-events-none bg-amber-50 blur-2xl"></div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1.5 relative z-10 text-text-muted">
              Processing (To Pay)
            </p>
            <h3 className="text-3xl font-black text-amber-600 relative z-10">
              ₹{totalProcessing.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div
            className="rounded-3xl p-6 shadow-sm border relative overflow-hidden group hover:shadow-md transition-shadow"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-60 pointer-events-none bg-emerald-50 blur-2xl"></div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1.5 relative z-10 text-text-muted">
              Successfully Paid
            </p>
            <h3 className="text-3xl font-black text-indigo-600 relative z-10">
              ₹{totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </h3>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            className="px-4 py-2 border rounded-lg text-sm font-medium outline-none"
            style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="processing">Processing (Unpaid)</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="px-4 py-2 border rounded-lg text-sm font-medium outline-none"
            style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
            value={filters.agent}
            onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.username} ({a.first_name})</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div
          className="rounded-3xl border overflow-hidden shadow-sm"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
              <p className="mt-2 text-[13px] font-medium">Loading batches...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Batch ID</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Agent</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Cycle Dates</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted text-right">Amount</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted text-center">Status</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-text-muted text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[13px] font-medium text-ink" style={{ borderColor: "var(--border)" }}>
                  {paginatedBatches.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                        No payout batches found.
                      </td>
                    </tr>
                  ) : (
                    paginatedBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-slate-400">#{b.id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{b.agent_details?.username}</div>
                          <div className="text-[11px] text-text-muted">{b.agent_details?.email}</div>
                          {b.agent_details?.kyc_upi_id && (
                            <div className="text-[11px] font-mono text-blue-600 mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">account_balance</span>
                              {b.agent_details.kyc_upi_id}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-muted">
                          {new Date(b.cycle_start_date).toLocaleDateString()} - {new Date(b.cycle_end_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-indigo-600">
                          ₹{parseFloat(b.total_amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {b.status === "paid" ? (
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
                          {b.utr_number && (
                            <div className="text-[10px] mt-1 text-slate-400">UTR: {b.utr_number}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {b.status === "processing" ? (
                            <button
                              onClick={() => setPayingBatchId(b.id)}
                              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold shadow-sm hover:bg-slate-800 transition-colors"
                            >
                              Settle & Pay
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pay Modal */}
      {payingBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border p-6"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black" style={{ color: "var(--ink)" }}>Settle Payout</h3>
              <button onClick={() => setPayingBatchId(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {(() => {
              const b = batches.find((x) => x.id === payingBatchId);
              return b ? (
                <div className="mb-6 p-4 rounded-xl border bg-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[12px] font-bold text-slate-500">Amount to Pay</span>
                    <span className="text-lg font-black text-indigo-600">₹{parseFloat(b.total_amount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] font-bold text-slate-500">Agent UPI ID</span>
                    <span className="text-[14px] font-mono font-bold text-blue-600 select-all">
                      {b.agent_details?.kyc_upi_id || "Not Provided"}
                    </span>
                  </div>
                </div>
              ) : null;
            })()}
            
            <form onSubmit={handleMarkPaid}>
              <div className="mb-5">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-text-muted mb-2">
                  UTR / Transaction Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR123456789"
                  className="w-full px-4 py-3 rounded-xl border text-[14px] font-bold outline-none focus:border-blue-500 transition-colors"
                  style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                />
                <p className="text-[12px] text-text-muted mt-2">
                  Perform the NEFT/IMPS transfer from your bank manually, then paste the UTR number here. This will mark the batch and all its earnings as paid.
                </p>
              </div>
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide transition-all shadow-md shadow-blue-500/20"
              >
                Confirm Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
