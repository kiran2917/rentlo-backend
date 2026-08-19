import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminLayout } from "../components/AdminLayout";

export const FraudFlags = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState("fraud"); // 'fraud' | 'feedbacks'
  const [agents, setAgents] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchFraudList = async () => {
    setLoading(true);
    try {
      let res = await fetch(`${import.meta.env.VITE_API_URL}/moderation/agents/fraud/`, {
        credentials: "include",
      });
      if (!res.ok) {
        res = await fetch(`${import.meta.env.VITE_API_URL}/auth/users/`, {
          credentials: "include",
        });
      }
      if (res.ok) {
        const users = await res.json();
        const flagged = users
          .map((u) => ({
            ...u,
            fraud_flags: u.fraud_flags ?? u.fraud_flag_count ?? 0,
          }))
          .filter((u) => u.fraud_flags > 0)
          .sort((a, b) => b.fraud_flags - a.fraud_flags);
        setAgents(flagged);
      }
    } catch (e) {
      toast.error("Failed to fetch fraud list");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/unlocks/admin/feedbacks/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data);
      }
    } catch (e) {
      toast.error("Failed to fetch buyer contact feedbacks");
    } finally {
      setLoading(false);
    }
  };

  const suspendAgent = async (id) => {
    if (!window.confirm("Are you sure you want to suspend this agent?")) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/moderation/agents/${id}/suspend/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
      if (res.ok) {
        toast.success("Agent suspended successfully.");
        fetchFraudList();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || "Failed to suspend agent");
      }
    } catch (e) {
      toast.error("Failed to suspend agent");
    }
  };

  useEffect(() => {
    if (activeSubTab === "fraud") {
      fetchFraudList();
    } else {
      fetchFeedbacks();
    }
  }, [activeSubTab]);

  const filteredAgents = agents.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(a.id).includes(q) ||
      a.username?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(f.id).includes(q) ||
      f.buyer_name?.toLowerCase().includes(q) ||
      f.buyer_phone?.includes(q) ||
      f.property_title?.toLowerCase().includes(q) ||
      f.note?.toLowerCase().includes(q)
    );
  });

  const currentList = activeSubTab === "fraud" ? filteredAgents : filteredFeedbacks;
  const totalPages = Math.ceil(currentList.length / itemsPerPage);
  const paginatedList = currentList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AdminLayout activeTab="fraud">
      <ToastContainer position="top-right" />
      <div className="max-w-5xl mx-auto relative z-10 w-full">
        {/* Sub-Tab Navigation Bar */}
        <div className="flex gap-2 p-1.5 rounded-2xl border mb-8 max-w-md shadow-sm" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
          <button
            onClick={() => { setActiveSubTab("fraud"); setCurrentPage(1); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "fraud" ? "bg-rose-500 text-white shadow-md scale-[1.02]" : "hover:opacity-80"
            }`}
            style={activeSubTab !== "fraud" ? { color: "var(--text-muted)" } : {}}
          >
            <span className="material-symbols-outlined text-[18px]">shield</span>
            Fraud Flags ({agents.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("feedbacks"); setCurrentPage(1); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "feedbacks" ? "bg-amber-500 text-white shadow-md scale-[1.02]" : "hover:opacity-80"
            }`}
            style={activeSubTab !== "feedbacks" ? { color: "var(--text-muted)" } : {}}
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
            Buyer Feedbacks ({feedbacks.length})
          </button>
        </div>

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex items-center gap-4 group">
            <div className={`w-14 h-14 border rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500 ${
              activeSubTab === "fraud" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }`}>
              <span className="material-symbols-outlined text-[32px] group-hover:animate-pulse">
                {activeSubTab === "fraud" ? "radar" : "contact_phone"}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                {activeSubTab === "fraud" ? "Fraud Flags Monitor" : "Buyer Contact Accuracy Feedbacks"}
              </h1>
              <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
                {activeSubTab === "fraud"
                  ? "Agents and listing accounts sorted by highest reported fraud flags."
                  : "Live feedback submitted by buyers after unlocking owner contact details."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group w-64 md:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] transition-colors">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 w-full border rounded-xl text-[13px] font-bold outline-none focus:border-amber-500 transition-all shadow-sm"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                placeholder={activeSubTab === "fraud" ? "Search agents..." : "Search feedbacks or notes..."}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <button
              onClick={activeSubTab === "fraud" ? fetchFraudList : fetchFeedbacks}
              className="flex items-center justify-center w-12 h-12 border rounded-xl shadow-sm transition-all hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
              title="Refresh List"
            >
              <span className="material-symbols-outlined text-[20px]">
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl border shadow-sm overflow-hidden mb-8 relative" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  {activeSubTab === "fraud" ? (
                    <>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Agent ID</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Username</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Phone Number</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>Fraud Flags</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>Action</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Buyer</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Property</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Owner Phone</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>Accuracy Rating</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Feedback Note</th>
                      <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>Date</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center sticky left-0 right-0">
                      <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                        <div className="w-8 h-8 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin"></div>
                        <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          Loading data...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center sticky left-0 right-0">
                      <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                        <span className="material-symbols-outlined text-5xl text-emerald-500/80 mb-2 block">
                          task_alt
                        </span>
                        <p className="text-[14px] font-extrabold uppercase tracking-widest text-center" style={{ color: "var(--ink)" }}>
                          {activeSubTab === "fraud" ? "No Flagged Accounts" : "No Feedbacks Submitted Yet"}
                        </p>
                        <p className="text-[12px] font-medium text-center" style={{ color: "var(--text-muted)" }}>
                          {activeSubTab === "fraud"
                            ? "There are currently no accounts with active fraud reports."
                            : "Buyer feedback on unlocked contacts will appear here."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : activeSubTab === "fraud" ? (
                  paginatedList.map((agent) => (
                    <tr
                      key={agent.id}
                      className="hover:opacity-90 transition-all duration-300"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-bold px-2.5 py-1 rounded-lg border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}>
                          #{agent.id}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold bg-rose-100 text-rose-600">
                            {agent.username?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[13px] font-extrabold" style={{ color: "var(--ink)" }}>
                            {agent.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
                          {agent.phone || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          {agent.fraud_flags}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {agent.is_active === false ? (
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-[12px] font-bold uppercase tracking-widest">
                            Suspended
                          </span>
                        ) : (
                          <button
                            onClick={() => suspendAgent(agent.id)}
                            className="px-4 py-2 border border-rose-200 rounded-xl text-[12px] font-bold uppercase tracking-widest text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-all shadow-sm cursor-pointer"
                            style={{ backgroundColor: "var(--surface)" }}
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  paginatedList.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:opacity-90 transition-all duration-300"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-[13px] font-extrabold" style={{ color: "var(--ink)" }}>
                            {item.buyer_name || "Buyer"}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                            +91 {item.buyer_phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-[13px] font-extrabold line-clamp-1" style={{ color: "var(--ink)" }}>
                            {item.property_title || `Property #${item.property_id}`}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400">
                            ID: #{item.property_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-bold tracking-wider" style={{ color: "var(--ink)" }}>
                          {item.owner_phone ? `+91 ${item.owner_phone}` : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {item.is_accurate ? (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Accurate / Working
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            Inaccurate / Report
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 max-w-xs">
                        <p className="text-[12px] font-medium leading-relaxed italic" style={{ color: "var(--text-muted)" }}>
                          {item.note ? `"${item.note}"` : "No comment added"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                          {new Date(item.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && currentList.length > 0 && (
          <div className="flex justify-between items-center mb-8 p-4 rounded-2xl border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, currentList.length)} of{" "}
              {currentList.length} entries
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
