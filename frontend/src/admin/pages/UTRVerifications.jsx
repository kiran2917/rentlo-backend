import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { AdminLayout } from "../components/AdminLayout";

export const UTRVerifications = () => {
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBuyers, setExpandedBuyers] = useState({});
  const [selectedRoleTab, setSelectedRoleTab] = useState("all");
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    user: "",
    property_id: "",
    amount: "99",
    payment_method: "cash",
    utr: "",
  });

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.user) {
      toast.warn("Please enter a username or phone number.");
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/unlocks/admin/manual-transaction/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(manualForm),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.detail || "Manual transaction recorded successfully!");
        setShowManualModal(false);
        setManualForm({ user: "", property_id: "", amount: "99", payment_method: "cash", utr: "" });
        fetchUnlocks();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to record manual transaction.");
      }
    } catch (e) {
      toast.error("Error submitting manual transaction: " + e.message);
    }
  };

  const fetchUnlocks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/unlocks/admin/list/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnlocks(data);
      }
    } catch (e) {
      toast.error("Failed to fetch unlocks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnlocks();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/unlocks/admin/${id}/action/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(`Payment ${action}d successfully`);
        fetchUnlocks();
      } else {
        toast.error(`Failed to ${action} payment`);
      }
    } catch (e) {
      toast.error("An error occurred");
    }
  };

  const toggleBuyer = (buyerName) => {
    setExpandedBuyers((prev) => ({
      ...prev,
      [buyerName]: !prev[buyerName],
    }));
  };

  const getRole = (u) => {
    if (u.utr?.startsWith('ADMIN_MANUAL_') || u.payment_method === 'admin_grant') return 'admin';
    if (u.buyer_role) return u.buyer_role;
    if (u.buyer_name?.startsWith('owner_')) return 'owner';
    if (u.buyer_name?.startsWith('agent_')) return 'agent';
    if (u.buyer_name?.startsWith('admin') || u.buyer_name?.startsWith('superadmin')) return 'admin';
    return 'buyer';
  };

  const filteredUnlocks = unlocks.filter((u) => {
    if (selectedRoleTab === "all") return true;
    const role = getRole(u);
    if (selectedRoleTab === "buyer") return role === "buyer" || role === "user";
    if (selectedRoleTab === "owner") return role === "owner";
    if (selectedRoleTab === "agent") return role === "agent";
    if (selectedRoleTab === "admin") return role === "admin" || role === "superadmin";
    return true;
  });

  const groupedUnlocks = filteredUnlocks.reduce((acc, u) => {
    if (!acc[u.buyer_name]) {
      acc[u.buyer_name] = {
        buyerName: u.buyer_name,
        buyerFullName: u.buyer_full_name,
        buyerRole: getRole(u),
        buyerIsActive: u.buyer_is_active,
        payments: [],
        latestPaymentId: -1,
      };
    }
    acc[u.buyer_name].payments.push(u);
    if (u.id > acc[u.buyer_name].latestPaymentId) {
      acc[u.buyer_name].latestPaymentId = u.id;
    }
    return acc;
  }, {});

  const sortedBuyers = Object.values(groupedUnlocks).sort(
    (a, b) => b.latestPaymentId - a.latestPaymentId
  );

  return (
    <AdminLayout activeTab="payments">
      <div className="max-w-[1200px] mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[28px] font-display font-semibold mb-2" style={{ color: "var(--ink)" }}>
            Payment Approvals
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            Verify UTR numbers and approve payments filtered by user role.
          </p>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
          {[
            { id: "all", label: "All Payments", icon: "payments", count: unlocks.length },
            {
              id: "buyer",
              label: "Buyers (Contact Unlocks)",
              icon: "person",
              count: unlocks.filter((u) => ["buyer", "user"].includes(getRole(u))).length,
            },
            {
              id: "owner",
              label: "Owners (Listings & Plans)",
              icon: "home_work",
              count: unlocks.filter((u) => getRole(u) === "owner").length,
            },
            {
              id: "agent",
              label: "Agents",
              icon: "badge",
              count: unlocks.filter((u) => getRole(u) === "agent").length,
            },
            {
              id: "admin",
              label: "Admin (Manual & Grants)",
              icon: "shield",
              count: unlocks.filter((u) => ["admin", "superadmin"].includes(getRole(u))).length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedRoleTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-[12px] font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border flex-shrink-0 ${
                selectedRoleTab === tab.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  selectedRoleTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-card overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            {/* 🖥️ Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>ID</th>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Transaction User (Payer)</th>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Property</th>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>UTR</th>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-right" style={{ color: "var(--text-muted)" }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-[14px] sticky left-0 right-0" style={{ color: "var(--text-muted)" }}>
                        <div className="flex flex-col items-center justify-center gap-2 w-full max-w-xs sm:max-w-md mx-auto">
                          <span>Loading payments...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedBuyers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-[14px] sticky left-0 right-0" style={{ color: "var(--text-muted)" }}>
                        <div className="flex flex-col items-center justify-center gap-2 w-full max-w-xs sm:max-w-md mx-auto">
                          <span>No payments found.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedBuyers.map((buyerGroup) => (
                      <React.Fragment key={buyerGroup.buyerName}>
                        <tr
                          className="hover:bg-black/5 transition-colors cursor-pointer"
                          style={{ backgroundColor: "rgba(0,0,0,0.01)" }}
                          onClick={() => toggleBuyer(buyerGroup.buyerName)}
                        >
                          <td className="px-6 py-4 border-b border-[var(--border)] w-12 text-center text-[var(--text-muted)]">
                            {expandedBuyers[buyerGroup.buyerName] ? '▼' : '▶'}
                          </td>
                          <td className="px-6 py-4 border-b border-[var(--border)]">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-[14px] text-[var(--ink)]">
                                  {buyerGroup.buyerFullName && buyerGroup.buyerFullName !== 'Unknown Name' ? buyerGroup.buyerFullName : 'User'}
                                </span>
                                <span className="text-[12px] text-[var(--text-muted)] font-normal">
                                  {buyerGroup.buyerName}
                                </span>
                              </div>
                              <span className="text-[12px] font-medium bg-black/5 px-2 py-0.5 rounded-full text-[var(--text-muted)]">
                                {buyerGroup.payments.length} {buyerGroup.payments.length === 1 ? 'payment' : 'payments'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-[var(--border)]"></td>
                          <td className="px-6 py-4 border-b border-[var(--border)]"></td>
                          <td className="px-6 py-4 border-b border-[var(--border)]"></td>
                          <td className="px-6 py-4 border-b border-[var(--border)] text-right">
                            {buyerGroup.buyerIsActive === false && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                Banned
                              </span>
                            )}
                          </td>
                        </tr>
                        {expandedBuyers[buyerGroup.buyerName] &&
                          buyerGroup.payments.map((u) => (
                            <tr key={u.id} className="hover:bg-black/5 transition-colors">
                              <td className="px-6 py-4 text-[13px] font-medium pl-10">#{u.id}</td>
                              <td className="px-6 py-4 text-[13px] font-semibold text-[var(--text-muted)]">
                                {u.buyer_full_name && u.buyer_full_name !== 'Unknown Name' ? u.buyer_full_name : u.buyer_name}
                              </td>
                              <td className="px-6 py-4 text-[13px]">
                                ID: {u.property_id} <br />
                                <span className="text-[11px] opacity-70">{u.property_title}</span>
                              </td>
                              <td className="px-6 py-4">
                                {u.payment_method === 'upi' ? (
                                  <span className="font-mono text-[13px] font-semibold">{u.utr || "N/A"}</span>
                                ) : (
                                  <span className="text-[12px] opacity-70">Razorpay Auto</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                    u.status === 'paid'
                                      ? 'bg-green-100 text-green-700'
                                      : u.status === 'failed'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {u.buyer_is_active === false ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(u.id, 'unban');
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-xs hover:opacity-90"
                                  >
                                    Unban User
                                  </button>
                                ) : (
                                  <>
                                    {u.status === 'pending' && (
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(u.id, 'approve');
                                          }}
                                          className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-green-500 text-white hover:bg-green-600 transition-colors shadow-xs hover:opacity-90"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(u.id, 'reject');
                                          }}
                                          className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-xs hover:opacity-95"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                    {u.status === 'paid' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Are you sure you want to BAN user account "${buyerGroup.buyerName}" (${buyerGroup.buyerRole}) and revoke their access?`)) {
                                            handleAction(u.id, 'ban');
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs hover:opacity-90"
                                      >
                                        Ban & Revoke
                                      </button>
                                    )}
                                    {u.status === 'failed' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Are you sure you want to BAN user account "${buyerGroup.buyerName}" (${buyerGroup.buyerRole})?`)) {
                                            handleAction(u.id, 'ban');
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs hover:opacity-90"
                                      >
                                        Ban User
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 📱 Mobile Card/Accordion Stack View */}
            <div className="md:hidden divide-y divide-border" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <div className="px-6 py-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Loading payments...
                </div>
              ) : sortedBuyers.length === 0 ? (
                <div className="px-6 py-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                  No payments found.
                </div>
              ) : (
                sortedBuyers.map((buyerGroup) => (
                  <div key={buyerGroup.buyerName} className="p-4 space-y-3" style={{ backgroundColor: "var(--surface)" }}>
                    {/* Buyer Group Accordion Header */}
                    <div 
                      className="flex items-center justify-between cursor-pointer" 
                      onClick={() => toggleBuyer(buyerGroup.buyerName)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-accent">
                          {expandedBuyers[buyerGroup.buyerName] ? 'expand_more' : 'chevron_right'}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>
                            {buyerGroup.buyerFullName && buyerGroup.buyerFullName !== 'Unknown Name' ? buyerGroup.buyerFullName : 'User'}
                          </span>
                          <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                            @{buyerGroup.buyerName}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold bg-slate-500/10 px-2.5 py-0.5 rounded-full text-slate-400 border border-slate-500/20">
                          {buyerGroup.payments.length} txn
                        </span>
                        {buyerGroup.buyerIsActive === false && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-100 text-red-700">
                            Banned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grouped Payments List (Expanded) */}
                    {expandedBuyers[buyerGroup.buyerName] && (
                      <div className="space-y-3 pt-3 border-t border-dashed mt-2" style={{ borderColor: "var(--border)" }}>
                        {buyerGroup.payments.map((u) => (
                          <div key={u.id} className="p-3 rounded-xl border space-y-2.5" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-extrabold text-[12px] block" style={{ color: "var(--ink)" }}>Transaction #{u.id}</span>
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Property ID: {u.property_id} ({u.property_title})</span>
                              </div>
                              
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                                  u.status === 'paid'
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                    : u.status === 'failed'
                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}
                              >
                                {u.status}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-[12px]">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest block" style={{ color: "var(--text-muted)" }}>UTR Transaction ID</span>
                                {u.payment_method === 'upi' ? (
                                  <span className="font-mono font-bold" style={{ color: "var(--ink)" }}>{u.utr || "N/A"}</span>
                                ) : (
                                  <span className="opacity-70">Razorpay Auto</span>
                                )}
                              </div>
                              
                              <div className="text-right">
                                {u.buyer_is_active === false ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(u.id, 'unban');
                                    }}
                                    className="px-2.5 py-1 rounded bg-amber-500 text-white text-[10.5px] font-bold transition-all shadow-xs cursor-pointer shadow-sm hover:opacity-90"
                                  >
                                    Unban
                                  </button>
                                ) : (
                                  <>
                                    {u.status === 'pending' && (
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(u.id, 'approve');
                                          }}
                                          className="px-2.5 py-1 rounded bg-green-500 text-white text-[10.5px] font-bold transition-all shadow-xs cursor-pointer shadow-sm hover:opacity-90"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(u.id, 'reject');
                                          }}
                                          className="px-2.5 py-1 rounded bg-red-50 text-red-600 text-[10.5px] font-bold border border-red-150 transition-all shadow-xs cursor-pointer shadow-sm hover:opacity-95"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                    {u.status === 'paid' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Are you sure you want to BAN user account "${buyerGroup.buyerName}" (${buyerGroup.buyerRole}) and revoke their access?`)) {
                                            handleAction(u.id, 'ban');
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded bg-red-600 text-white text-[10.5px] font-bold transition-all shadow-xs cursor-pointer shadow-sm hover:opacity-90"
                                      >
                                        Ban & Revoke
                                      </button>
                                    )}
                                    {u.status === 'failed' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Are you sure you want to BAN user account "${buyerGroup.buyerName}" (${buyerGroup.buyerRole})?`)) {
                                            handleAction(u.id, 'ban');
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded bg-red-600 text-white text-[10.5px] font-bold transition-all shadow-xs cursor-pointer shadow-sm hover:opacity-90"
                                      >
                                        Ban User
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-[16px] font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600">add_card</span>
                Record Manual Transaction
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Target User (Username / Phone / User ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.user}
                  onChange={(e) => setManualForm({ ...manualForm, user: e.target.value })}
                  placeholder="e.g. buyer_123 or 9876543210"
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-[12px] font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Property ID (Optional)
                </label>
                <input
                  type="number"
                  value={manualForm.property_id}
                  onChange={(e) => setManualForm({ ...manualForm, property_id: e.target.value })}
                  placeholder="e.g. 104"
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-[12px] font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    placeholder="e.g. 99"
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-[12px] font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={manualForm.payment_method}
                    onChange={(e) => setManualForm({ ...manualForm, payment_method: e.target.value })}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-[12px] font-bold outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="cash">Cash / Offline</option>
                    <option value="upi">Direct UPI Transfer</option>
                    <option value="bank_transfer">Bank Wire / NEFT</option>
                    <option value="admin_grant">Admin Grant (Free Bonus)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  UTR / Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={manualForm.utr}
                  onChange={(e) => setManualForm({ ...manualForm, utr: e.target.value })}
                  placeholder="Auto-generated if left empty"
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-[12px] font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-[11px] font-black bg-orange-600 text-white hover:bg-orange-500 shadow-md cursor-pointer"
                >
                  Record & Approve Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

