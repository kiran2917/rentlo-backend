import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export const OwnerLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPropFilter, setSelectedPropFilter] = useState("all");
  const [viewMode, setViewMode] = useState("kanban"); // 'kanban' | 'table'
  const [activeMobileTab, setActiveMobileTab] = useState("new");

  useEffect(() => {
    let timeoutId;
    let isActive = true;

    const fetchLeads = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-leads/`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const processed = data.map((l) => ({ ...l, lead_status: l.lead_status || "new" }));
          if (isActive) setLeads(processed);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    const poll = () => {
      if (document.visibilityState === "visible") {
        fetchLeads().then(() => {
          if (isActive) timeoutId = setTimeout(poll, 15000);
        });
      } else {
        if (isActive) timeoutId = setTimeout(poll, 5000);
      }
    };

    fetchLeads().then(() => {
      timeoutId = setTimeout(poll, 15000);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timeoutId);
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    const targetLead = leads.find((l) => l.id === leadId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, lead_status: newStatus } : l)));

    if (newStatus === "rented" && targetLead) {
      setDealClosedModalLead(targetLead);
    }

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-leads/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: leadId, lead_status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("leadId", id);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    const leadId = parseInt(e.dataTransfer.getData("leadId"));
    if (leadId) {
      updateLeadStatus(leadId, status);
    }
  };

  const [dealClosedModalLead, setDealClosedModalLead] = useState(null);
  const [statusModalLead, setStatusModalLead] = useState(null);

  const columns = [
    {
      id: "new",
      title: "New Inquiries",
      countColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      accentBorder: "border-emerald-500/30",
      badge: "🌱 NEW",
    },
    {
      id: "contacted",
      title: "In Discussion",
      countColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      accentBorder: "border-blue-500/30",
      badge: "💬 IN TALKS",
    },
    {
      id: "rented",
      title: "Deal Closed 🎉",
      countColor: "bg-purple-500/10 text-purple-600 border-purple-500/30",
      accentBorder: "border-purple-500/30",
      badge: "🎉 RENTED",
    },
    {
      id: "rejected",
      title: "Not Interested",
      countColor: "bg-rose-500/10 text-rose-600 border-rose-500/30",
      accentBorder: "border-rose-500/30",
      badge: "🚫 REJECTED",
    },
  ];

  // Unique properties for filter dropdown
  const uniqueProperties = Array.from(new Set(leads.map((l) => l.property_id))).filter(Boolean);

  const filteredLeads = leads.filter((lead) => {
    if (selectedPropFilter !== "all" && String(lead.property_id) !== String(selectedPropFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (lead.user_name || "").toLowerCase();
      const phone = (lead.user_phone || "").toLowerCase();
      const propId = String(lead.property_id);
      return name.includes(q) || phone.includes(q) || propId.includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b pb-6 border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              Live Buyer Pipeline
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Leads & Contacts Board
          </h2>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 hidden md:block">
            Drag & drop buyer inquiries between status columns, or tap quick actions to message prospective tenants on WhatsApp.
          </p>
        </div>

        {/* Filter Controls & View Switcher */}
        <div className="flex items-center gap-3">
          {/* View Switcher Toggle */}
          <div className="hidden md:flex bg-slate-100 p-1 rounded-xl items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_rows</span>
              Table View
            </button>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by buyer name or phone..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all w-48 md:w-56"
            />
          </div>

          {uniqueProperties.length > 1 && (
            <select
              value={selectedPropFilter}
              onChange={(e) => setSelectedPropFilter(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 text-slate-700 cursor-pointer"
            >
              <option value="all">All Properties</option>
              {uniqueProperties.map((pid) => (
                <option key={pid} value={pid}>
                  Property #{pid}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary KPI Metrics Bar / Row */}
      {!loading && leads.length > 0 && (
        <div className="flex md:grid md:grid-cols-4 overflow-x-auto snap-x gap-2 md:gap-3.5 mb-6 md:mb-8 pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 md:p-4 rounded-full md:rounded-2xl bg-white border border-slate-200 shadow-sm snap-start">
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 items-center justify-center font-black">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
            <div className="flex items-center gap-1.5 md:block">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-wider">Total Inquiries<span className="md:hidden">:</span></p>
              <h4 className="text-[11px] md:text-xl font-black text-slate-900">{filteredLeads.length}</h4>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 md:p-4 rounded-full md:rounded-2xl bg-white border border-slate-200 shadow-sm snap-start">
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 items-center justify-center font-black">
              <span className="material-symbols-outlined text-[20px]">forum</span>
            </div>
            <div className="flex items-center gap-1.5 md:block">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-wider">In Discussion<span className="md:hidden">:</span></p>
              <h4 className="text-[11px] md:text-xl font-black text-slate-900">
                {filteredLeads.filter((l) => l.lead_status === "contacted").length}
              </h4>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 md:p-4 rounded-full md:rounded-2xl bg-white border border-slate-200 shadow-sm snap-start">
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 items-center justify-center font-black">
              <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
            </div>
            <div className="flex items-center gap-1.5 md:block">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-wider">Deals Closed<span className="md:hidden">:</span></p>
              <h4 className="text-[11px] md:text-xl font-black text-purple-600">
                {filteredLeads.filter((l) => l.lead_status === "rented").length}
              </h4>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 md:p-4 rounded-full md:rounded-2xl bg-white border border-slate-200 shadow-sm snap-start">
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 items-center justify-center font-black">
              <span className="material-symbols-outlined text-[20px]">do_not_disturb_on</span>
            </div>
            <div className="flex items-center gap-1.5 md:block">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-wider">Rejected<span className="md:hidden">:</span></p>
              <h4 className="text-[11px] md:text-xl font-black text-slate-900">
                {filteredLeads.filter((l) => l.lead_status === "rejected").length}
              </h4>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Navigation (Sticky) */}
      {!loading && leads.length > 0 && viewMode === "kanban" && (
        <div className="md:hidden flex overflow-x-auto border-b border-slate-200 mb-6 sticky top-[56px] bg-[#fafafa] z-20 -mx-4 px-4 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {columns.map((col) => {
            const isActive = activeMobileTab === col.id;
            const count = filteredLeads.filter((l) => l.lead_status === col.id).length;
            return (
              <button
                key={`tab-${col.id}`}
                onClick={() => setActiveMobileTab(col.id)}
                className={`shrink-0 whitespace-nowrap px-4 py-3 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 ${
                  isActive
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {col.title.replace(' 🎉', '')}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-600 animate-spin"></div>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-emerald-500 text-[40px]">person_search</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">No buyer inquiries yet</h3>
          <p className="text-xs font-medium text-slate-500 max-w-sm">
            When interested buyers unlock your property details, their verified phone numbers will automatically populate here in real-time.
          </p>
        </div>
      ) : viewMode === "table" ? (
        /* Table List Row View */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Buyer Name</th>
                  <th className="py-4 px-6">Contact Number</th>
                  <th className="py-4 px-6">Property</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Messaging Actions</th>
                  <th className="py-4 px-6 text-right">Lead Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {filteredLeads.map((lead) => {
                  const cleanPhone = (lead.user_phone || "").replace(/[^0-9]/g, "");
                  const whatsappMsg = encodeURIComponent(
                    `Hi ${lead.user_name || "there"}, thank you for expressing interest in my listing (Property #${lead.property_id}) on Rentlo! When are you free for a viewing?`
                  );
                  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${whatsappMsg}`;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-900 text-sm">{lead.user_name || "Anonymous Buyer"}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">Interested Buyer</div>
                      </td>
                      <td className="py-4 px-6">
                        <a href={`tel:${lead.user_phone}`} className="text-emerald-700 hover:underline font-extrabold">
                          {lead.user_phone}
                        </a>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-black">
                          Property #{lead.property_id}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/owner/chat"
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[13px]">forum</span> Web Chat
                          </Link>
                          {cleanPhone && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[13px]">chat</span> WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <select
                          value={lead.lead_status || "new"}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className="py-1.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-black outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                        >
                          <option value="new">🌱 New Inquiry</option>
                          <option value="contacted">💬 In Discussion</option>
                          <option value="rented">🎉 Deal Closed (Rented)</option>
                          <option value="rejected">🚫 Rejected</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-4 gap-0 md:gap-5">
          {columns.map((col) => {
            const columnLeads = filteredLeads.filter((l) => l.lead_status === col.id);
            const isMobileActive = activeMobileTab === col.id;

            return (
              <div
                key={col.id}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, col.id)}
                className={`${isMobileActive ? 'flex w-full' : 'hidden'} md:flex rounded-3xl p-4 md:p-5 border bg-slate-50/70 ${col.accentBorder} min-h-[520px] transition-all flex-col`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      {col.title}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${col.countColor}`}>
                    {columnLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3.5">
                  {columnLeads.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Drop leads here
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const cleanPhone = (lead.user_phone || "").replace(/[^0-9]/g, "");
                      const whatsappMsg = encodeURIComponent(
                        `Hi ${lead.user_name || "there"}, thank you for expressing interest in my listing (Property #${lead.property_id}) on Rentlo! When are you free for a viewing?`
                      );
                      const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${whatsappMsg}`;

                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, lead.id)}
                          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 group relative"
                        >
                          {/* Property Tag */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-extrabold text-[15px] text-slate-900 leading-snug">
                                {lead.user_name || "Anonymous Buyer"}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                Interested Buyer
                              </p>
                            </div>
                            <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                              Prop #{lead.property_id}
                            </span>
                          </div>

                          {/* Contact Details & Messaging Shortcuts */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-600">
                                  call
                                </span>
                                <a
                                  href={`tel:${lead.user_phone}`}
                                  className="text-[13px] font-black text-slate-900 hover:text-emerald-600 transition-colors"
                                >
                                  {lead.user_phone}
                                </a>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/60">
                              {/* Web Chat (Rentlo Platform Internal Chat) */}
                              <Link
                                to="/owner/chat"
                                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-black flex items-center justify-center gap-1 shadow-xs transition-all"
                                title="Open Rentlo Internal Web Chat"
                              >
                                <span className="material-symbols-outlined text-[13px]">forum</span>
                                Web Chat
                              </Link>

                              {/* WhatsApp Direct Chat Button */}
                              {cleanPhone && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-black flex items-center justify-center gap-1 shadow-xs transition-all"
                                  title="Chat on WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-[13px]">chat</span>
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Quick Action Chips (Touch-Friendly Move Buttons) */}
                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">
                              {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "Recent"}
                            </span>

                            <button
                              type="button"
                              onClick={() => setStatusModalLead(lead)}
                              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 shadow-xs rounded-lg text-slate-700 text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              Update Status
                              <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deal Closed Celebration Modal */}
      {dealClosedModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="rounded-3xl max-w-lg w-full p-8 shadow-2xl relative text-center border animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/30">
              <span className="material-symbols-outlined text-[36px]">workspace_premium</span>
            </div>

            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 inline-block mb-2">
              🎉 Deal Closed Successfully!
            </span>

            <h3 className="text-2xl font-black mb-2" style={{ color: "var(--ink)" }}>
              Congratulations, {dealClosedModalLead.user_name || "Owner"}!
            </h3>

            <p className="text-xs font-medium max-w-sm mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
              Property #{dealClosedModalLead.property_id} has been marked as <strong>RENTED</strong>. New buyer unlocks are now automatically paused.
            </p>

            {/* Action Box */}
            <div className="p-5 rounded-2xl border text-left space-y-4 mb-6" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <div>
                  <h4 className="text-xs font-black" style={{ color: "var(--ink)" }}>Draft Official Digital Rental Agreement</h4>
                  <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Generate a legally compliant Karnataka rental agreement in 2 minutes.</p>
                </div>
              </div>

              <Link
                to={`/property/${dealClosedModalLead.property_id}/lease`}
                onClick={() => setDealClosedModalLead(null)}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">edit_document</span>
                Draft Lease Agreement Now
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setDealClosedModalLead(null)}
              className="text-xs font-bold transition-colors cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              Done / Close Window
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet Modal for Status Update */}
      {statusModalLead && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-black text-slate-900">Update Lead Status</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">For {statusModalLead.user_name || "Buyer"}</p>
              </div>
              <button
                onClick={() => setStatusModalLead(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-3">
              {columns.map((col) => {
                const isActive = statusModalLead.lead_status === col.id;
                return (
                  <button
                    key={`status-${col.id}`}
                    onClick={() => {
                      updateLeadStatus(statusModalLead.id, col.id);
                      setStatusModalLead(null);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3.5 mb-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isActive 
                        ? `bg-slate-50 ${col.accentBorder}` 
                        : "border-transparent hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[13px] font-extrabold ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                        {col.badge}
                      </span>
                    </div>
                    {isActive && (
                      <span className="material-symbols-outlined text-[18px] text-slate-900">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
