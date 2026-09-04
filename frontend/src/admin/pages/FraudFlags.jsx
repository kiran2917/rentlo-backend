import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminLayout } from "../components/AdminLayout";
import { ConfirmModal } from "../../shared/components/ConfirmModal";

export const FraudFlags = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState("disputes"); // 'disputes' | 'feedbacks' | 'fraud'
  const [agents, setAgents] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [disputeFilter, setDisputeFilter] = useState("all"); // 'all' | 'pending' | 'approved' | 'rejected'
  const [currentPage, setCurrentPage] = useState(1);
  const [agentToSuspend, setAgentToSuspend] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const itemsPerPage = 10;

  // Confirm Modal state for heavy actions (ban buyer / suspend owner)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "",
    isDanger: true,
    onConfirm: () => {},
  });

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
        const data = await res.json();
        const safeData = Array.isArray(data) ? data : [];
        const flagged = safeData
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
        setFeedbacks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      toast.error("Failed to fetch buyer contact feedbacks");
    } finally {
      setLoading(false);
    }
  };

  const suspendAgent = (id) => {
    setAgentToSuspend(id);
  };

  const confirmSuspendAgent = async () => {
    if (!agentToSuspend) return;
    const id = agentToSuspend;
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
        toast.success("Agent suspended successfully");
        fetchFraudList();
      } else {
        toast.error("Failed to suspend agent");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAgentToSuspend(null);
    }
  };

  // 1-Click Dispute Resolution Action
  const handleResolveDispute = async (feedbackId, action, notes = "") => {
    setActionLoadingId(feedbackId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/unlocks/admin/feedbacks/${feedbackId}/resolve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.detail || "Dispute action processed successfully!");
        fetchFeedbacks();
      } else {
        toast.error(data.detail || "Failed to process dispute action");
      }
    } catch (err) {
      toast.error("Network error processing dispute");
    } finally {
      setActionLoadingId(null);
      setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
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

  const disputesList = feedbacks.filter((f) => f.is_accurate === false);
  const pendingDisputesCount = disputesList.filter((f) => f.dispute_status === "pending" || !f.dispute_status || f.dispute_status === "none").length;
  const approvedRefundsCount = disputesList.filter((f) => f.dispute_status === "approved" || f.refund_granted).length;
  const rejectedClaimsCount = disputesList.filter((f) => f.dispute_status === "rejected").length;

  const filteredDisputes = disputesList.filter((f) => {
    // Status filter
    if (disputeFilter === "pending") {
      if (f.dispute_status !== "pending" && f.dispute_status !== "none" && f.dispute_status) return false;
    } else if (disputeFilter === "approved") {
      if (f.dispute_status !== "approved" && !f.refund_granted) return false;
    } else if (disputeFilter === "rejected") {
      if (f.dispute_status !== "rejected") return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(f.id).includes(q) ||
      f.buyer_name?.toLowerCase().includes(q) ||
      f.buyer_phone?.includes(q) ||
      f.property_title?.toLowerCase().includes(q) ||
      f.owner_phone?.includes(q) ||
      f.note?.toLowerCase().includes(q) ||
      f.reason_display?.toLowerCase().includes(q)
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

  const currentList =
    activeSubTab === "disputes"
      ? filteredDisputes
      : activeSubTab === "feedbacks"
      ? filteredFeedbacks
      : filteredAgents;

  const totalPages = Math.ceil(currentList.length / itemsPerPage);
  const paginatedList = currentList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AdminLayout activeTab="fraud">
      <div className="max-w-6xl mx-auto relative z-10 w-full pb-16">
        <ToastContainer position="top-right" autoClose={3000} />

        {/* Sub-Tab Navigation Bar */}
        <div
          className="flex flex-wrap gap-2 p-1.5 rounded-2xl border mb-8 max-w-xl shadow-sm"
          style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}
        >
          <button
            onClick={() => { setActiveSubTab("disputes"); setCurrentPage(1); }}
            className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "disputes" ? "bg-rose-600 text-white shadow-md scale-[1.02]" : "hover:opacity-80"
            }`}
            style={activeSubTab !== "disputes" ? { color: "var(--text-muted)" } : {}}
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            SLA Disputes
            {pendingDisputesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-rose-600 shadow-xs animate-pulse">
                {pendingDisputesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveSubTab("feedbacks"); setCurrentPage(1); }}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "feedbacks" ? "bg-amber-500 text-white shadow-md scale-[1.02]" : "hover:opacity-80"
            }`}
            style={activeSubTab !== "feedbacks" ? { color: "var(--text-muted)" } : {}}
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
            All Feedbacks ({feedbacks.length})
          </button>

          <button
            onClick={() => { setActiveSubTab("fraud"); setCurrentPage(1); }}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "fraud" ? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "hover:opacity-80"
            }`}
            style={activeSubTab !== "fraud" ? { color: "var(--text-muted)" } : {}}
          >
            <span className="material-symbols-outlined text-[18px]">shield</span>
            Agent Flags ({agents.length})
          </button>
        </div>

        {/* Header & Stats Strip */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex items-center gap-4 group">
            <div
              className={`w-14 h-14 border rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-all duration-300 ${
                activeSubTab === "disputes"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  : activeSubTab === "feedbacks"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
              }`}
            >
              <span className="material-symbols-outlined text-[32px]">
                {activeSubTab === "disputes" ? "support_agent" : activeSubTab === "feedbacks" ? "contact_phone" : "radar"}
              </span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                {activeSubTab === "disputes"
                  ? "Dispute SLA & Automated Refund Center"
                  : activeSubTab === "feedbacks"
                  ? "Buyer Contact Accuracy Feedbacks"
                  : "Fraud Flags Monitor"}
              </h1>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
                {activeSubTab === "disputes"
                  ? "1-Click Admin Approval for Tenant Unlock Credit Restorations with Anti-Fraud Intelligence."
                  : activeSubTab === "feedbacks"
                  ? "Direct feedback submitted by buyers after unlocking owner phone numbers."
                  : "Agents and listing accounts sorted by highest reported fraud flags."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone, name, ID..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-[13px] font-medium transition-all shadow-xs focus:border-rose-500"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
              />
            </div>
          </div>
        </div>

        {/* Dispute Summary Stats Row (Shown on Disputes Tab) */}
        {activeSubTab === "disputes" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Pending SLA Reviews
                </span>
                <span className="text-2xl font-black text-rose-600">
                  {pendingDisputesCount}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Under 2-Hour SLA Queue</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px] animate-pulse">hourglass_top</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Refunds Approved (+1 Credit)
                </span>
                <span className="text-2xl font-black text-emerald-600">
                  {approvedRefundsCount}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Credits Restored to Passes</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Fake Claims Blocked
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {rejectedClaimsCount}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Fraud Prevented / Kept Paid</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">security</span>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Status Filter Bar */}
        {activeSubTab === "disputes" && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {[
              { id: "all", label: "All Disputes", count: disputesList.length },
              { id: "pending", label: "⏳ Pending Review", count: pendingDisputesCount },
              { id: "approved", label: "✅ Approved & Refunded", count: approvedRefundsCount },
              { id: "rejected", label: "❌ Rejected / Fake", count: rejectedClaimsCount },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setDisputeFilter(f.id); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-[12px] font-extrabold transition-all cursor-pointer shrink-0 border ${
                  disputeFilter === f.id
                    ? "bg-slate-950 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        <div
          className="rounded-3xl border shadow-sm overflow-hidden"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 rounded-full border-[3px] border-rose-200 border-t-rose-600 animate-spin mx-auto mb-3"></div>
              <p className="text-[13px] font-medium text-slate-500">Loading intelligence records...</p>
            </div>
          ) : paginatedList.length === 0 ? (
            <div className="py-20 text-center px-4">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-2 block">
                {activeSubTab === "disputes" ? "verified" : "task_alt"}
              </span>
              <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                {activeSubTab === "disputes"
                  ? "No Disputes in this Queue"
                  : activeSubTab === "fraud"
                  ? "No Flagged Accounts"
                  : "No Feedbacks Submitted Yet"}
              </p>
              <p className="text-[12px] text-slate-400 mt-1 max-w-sm mx-auto">
                {activeSubTab === "disputes"
                  ? "All buyer contact disputes are fully resolved. No pending SLA tickets."
                  : "Records will automatically appear here as users interact with the platform."}
              </p>
            </div>
          ) : activeSubTab === "disputes" ? (
            /* DISPUTES INTELLIGENCE LIST */
            <div className="divide-y divide-slate-100">
              {paginatedList.map((item) => {
                const isPending = !item.dispute_status || item.dispute_status === "pending" || item.dispute_status === "none";
                const isApproved = item.dispute_status === "approved" || item.refund_granted;
                const isRejected = item.dispute_status === "rejected";
                const trustScore = item.buyer_trust_score ?? 100;
                const isActionLoading = actionLoadingId === item.id;

                return (
                  <div key={item.id} className="p-6 hover:bg-slate-50/60 transition-colors space-y-4">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-xl text-[11px] font-black bg-slate-900 text-white font-mono shadow-xs">
                          TICKET #{item.id}
                        </span>

                        {isPending ? (
                          <span className="px-3 py-1 rounded-xl text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            Pending SLA Review
                          </span>
                        ) : isApproved ? (
                          <span className="px-3 py-1 rounded-xl text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Refund Granted (+1 Credit Restored)
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            Rejected Claim (No Refund)
                          </span>
                        )}

                        <span className="text-[11px] font-bold text-slate-400">
                          {new Date(item.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Dispute Reason Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[12px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                        <span className="material-symbols-outlined text-[15px]">report_problem</span>
                        {item.reason_display || item.reason || "Listing Inaccurate"}
                      </div>
                    </div>

                    {/* Intelligence Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      {/* Left: Buyer Intelligence */}
                      <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200/80 pb-3 md:pb-0 md:pr-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                            Tenant / Buyer Intelligence
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              trustScore >= 80
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : trustScore >= 50
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            🛡️ {trustScore}% Trust Score
                          </span>
                        </div>

                        <p className="text-[14px] font-black text-slate-900 flex items-center gap-2">
                          {item.buyer_name || "Verified Buyer"}
                          {item.buyer_is_active === false && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 rounded">
                              BANNED
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] font-mono text-slate-600 font-bold">
                          Phone: +91 {item.buyer_phone || "N/A"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Total Unlocks: <strong>{item.buyer_total_unlocks || 0}</strong> | Past Disputes:{" "}
                          <strong>{item.buyer_total_disputes || 0}</strong>
                        </p>
                      </div>

                      {/* Right: Property & Owner Intelligence */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                            Target Property &amp; Owner
                          </span>
                          {item.property_total_disputes > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                              ⚠️ {item.property_total_disputes} Complaints
                            </span>
                          )}
                        </div>

                        <p className="text-[13px] font-extrabold text-slate-900 line-clamp-1">
                          {item.property_title || `Property #${item.property_id}`}
                        </p>
                        <p className="text-[12px] text-slate-700 font-medium">
                          Owner: <strong>{item.owner_name}</strong> | Phone:{" "}
                          <strong className="font-mono">{item.owner_phone ? `+91 ${item.owner_phone}` : "N/A"}</strong>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Listing ID: #{item.property_id} | Status:{" "}
                          <strong>{item.property_is_available ? "Active" : "Hidden / Inactive"}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Buyer Note / Explanation */}
                    {item.note && (
                      <div className="px-4 py-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-[12px] text-slate-700 font-medium italic flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-600 text-[16px] shrink-0 mt-0.5">chat_bubble</span>
                        <span>"{item.note}"</span>
                      </div>
                    )}

                    {/* Resolution / Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] text-slate-500 font-medium">
                        {isApproved && item.resolved_by_name && (
                          <span>Approved by <strong>{item.resolved_by_name}</strong></span>
                        )}
                        {isRejected && item.resolved_by_name && (
                          <span>Rejected by <strong>{item.resolved_by_name}</strong></span>
                        )}
                      </div>

                      {/* 1-Click Action Buttons */}
                      <div className="flex items-center gap-2 ml-auto">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleResolveDispute(item.id, "approve")}
                              className="h-9 px-4 rounded-xl text-[12px] font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              Approve &amp; Restore +1 Credit
                            </button>

                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleResolveDispute(item.id, "reject")}
                              className="h-9 px-3.5 rounded-xl text-[12px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">cancel</span>
                              Reject Claim
                            </button>
                          </>
                        )}

                        {/* Heavy Safety Actions */}
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              title: `Ban Buyer "${item.buyer_name}"?`,
                              message: "This will permanently freeze this buyer's account and block all future unlock passes.",
                              confirmLabel: "Yes, Permanently Ban",
                              isDanger: true,
                              onConfirm: () => handleResolveDispute(item.id, "ban_buyer", "Banned for fraudulent dispute filing"),
                            });
                          }}
                          className="h-9 px-3 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Ban buyer for false refund claims"
                        >
                          <span className="material-symbols-outlined text-[15px]">block</span>
                          Ban Buyer
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              title: `Deactivate Property #${item.property_id}?`,
                              message: "This will immediately hide the property from search results so no more buyers unlock it.",
                              confirmLabel: "Deactivate Listing",
                              isDanger: true,
                              onConfirm: () => handleResolveDispute(item.id, "suspend_owner", "Deactivated from dispute queue"),
                            });
                          }}
                          className="h-9 px-3 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Hide stale or fake property listing"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility_off</span>
                          Hide Listing
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW FOR FEEDBACKS & FRAUD */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-extrabold uppercase tracking-wider"
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {activeSubTab === "fraud" ? (
                      <>
                        <th className="py-4 px-6">Agent ID</th>
                        <th className="py-4 px-6">Username</th>
                        <th className="py-4 px-6">Phone</th>
                        <th className="py-4 px-6 text-center">Fraud Flags</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </>
                    ) : (
                      <>
                        <th className="py-4 px-6">Buyer</th>
                        <th className="py-4 px-6">Property</th>
                        <th className="py-4 px-6">Owner Phone</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6">Feedback Note</th>
                        <th className="py-4 px-6 text-right">Date</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px] font-medium">
                  {activeSubTab === "fraud"
                    ? paginatedList.map((agent) => (
                        <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg border bg-slate-50 text-slate-700">
                              #{agent.id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-indigo-100 text-indigo-700">
                                {agent.username?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-extrabold text-slate-900">{agent.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-[12px]">{agent.phone || "N/A"}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              {agent.fraud_flags}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {agent.is_active === false ? (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold uppercase">
                                Suspended
                              </span>
                            ) : (
                              <button
                                onClick={() => suspendAgent(agent.id)}
                                className="px-3 py-1.5 border border-indigo-200 rounded-xl text-[11px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                Suspend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    : paginatedList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-extrabold text-slate-900">{item.buyer_name || "Buyer"}</p>
                            <p className="text-[11px] text-slate-400 font-mono">+91 {item.buyer_phone}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 line-clamp-1">{item.property_title || `ID #${item.property_id}`}</p>
                          </td>
                          <td className="px-6 py-4 font-mono text-[12px] text-slate-700">
                            {item.owner_phone ? `+91 ${item.owner_phone}` : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.is_accurate ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                Accurate
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">report_problem</span>
                                {item.reason_display || "Disputed"}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 max-w-xs text-slate-600 text-[12px] italic">
                            {item.note ? `"${item.note}"` : "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[12px] font-bold text-slate-500">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Confirm Modal */}
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          onClose={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModalConfig.onConfirm}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmLabel={confirmModalConfig.confirmLabel}
          isDanger={confirmModalConfig.isDanger}
        />

        {/* Suspend Agent Modal */}
        <ConfirmModal
          isOpen={!!agentToSuspend}
          onClose={() => setAgentToSuspend(null)}
          onConfirm={confirmSuspendAgent}
          title="Suspend Agent Account"
          message="Are you sure you want to suspend this agent account? They will lose access to all property listings."
          confirmLabel="Suspend Agent"
          isDanger={true}
        />
      </div>
    </AdminLayout>
  );
};
