import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

// Helper function to format date
const formatDate = (isoString) => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const PropertyLifecycleModal = ({ propertyId, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isOpen || !propertyId) return;

    const fetchLifecycleData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propertyId}/lifecycle/`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch lifecycle data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load property lifecycle data.");
        // We removed onClose() here so the modal stays open to show the error state
      } finally {
        setLoading(false);
      }
    };

    fetchLifecycleData();
  }, [propertyId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-4xl max-h-[90vh] rounded-[24px] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.25),_0_0_30px_rgba(16,185,129,0.1)] border border-white/40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white/80">
          <div>
            <h2 className="text-[22px] font-bold text-slate-800 flex items-center gap-2.5 tracking-tight">
              <span className="material-symbols-outlined bg-gradient-to-tr from-emerald-500 to-teal-400 bg-clip-text text-transparent">history</span>
              Property Lifecycle & Audit Log
            </h2>
            <p className="text-[13px] font-medium text-slate-500 mt-1 uppercase tracking-widest">
              Property ID: #{propertyId}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-all duration-300 hover:rotate-90 hover:scale-105 active:scale-95"
          >
            <span className="material-symbols-outlined w-6 h-6">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[450px]">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-[3px] border-emerald-100 animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-emerald-500 animate-spin"></div>
            </div>
            <p className="text-slate-500 mt-5 font-semibold text-sm tracking-wide animate-pulse">Synchronizing lifecycle data...</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[450px]">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[32px] text-red-500">error</span>
            </div>
            <p className="text-slate-700 font-bold text-lg">Failed to load property lifecycle.</p>
            <p className="text-sm text-slate-500 mt-2 max-w-sm text-center font-medium leading-relaxed">
              Ensure your backend database migrations are fully applied and the server is responsive.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center px-8 pt-2 border-b border-slate-200/50 bg-white/50 gap-8">
              {[
                { id: "overview", icon: "info", label: "Overview" },
                { id: "unlocks", icon: "key", label: `Unlocks (${data.unlocks?.length || 0})` },
                { id: "audit", icon: "history", label: `Audit Log (${data.audit_logs?.length || 0})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-4 pt-3 text-[14px] font-bold border-b-[3px] transition-all duration-300 ${
                    activeTab === tab.id 
                      ? "border-indigo-600 text-indigo-600 drop-shadow-sm" 
                      : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : ''}`}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/40 relative">
              
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  
                  {/* Registration Card */}
                  <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <h3 className="text-[14px] font-extrabold text-slate-700 tracking-wide">REGISTRATION INFO</h3>
                    </div>
                    <div className="space-y-5">
                      <div className="group/item">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner Name</p>
                        <p className="font-semibold text-slate-800 text-[15px] group-hover/item:text-blue-600 transition-colors">{data.property.owner_name || "N/A"}</p>
                      </div>
                      <div className="group/item">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner Phone</p>
                        <p className="font-semibold text-slate-800 text-[15px] group-hover/item:text-blue-600 transition-colors">{data.property.owner_phone || "N/A"}</p>
                      </div>
                      <div className="group/item">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered By</p>
                        <p className="font-semibold text-slate-800 text-[15px] capitalize">
                          {data.property.added_by || "Self"} 
                          {data.property.agent && <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">ID: {data.property.agent}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Property Details Card */}
                  <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined">location_on</span>
                      </div>
                      <h3 className="text-[14px] font-extrabold text-slate-700 tracking-wide">PROPERTY DETAILS</h3>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rent / Price</p>
                        <p className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 text-2xl tracking-tight">
                          ₹{Number(data.property.price).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status & Verification</p>
                        <div className="flex gap-2.5">
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider bg-slate-100 text-slate-600 uppercase border border-slate-200 shadow-sm">
                            {data.property.status?.replace('_', ' ')}
                          </span>
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider bg-emerald-50 text-indigo-600 uppercase border border-emerald-100 shadow-sm">
                            {data.property.verification_status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Location</p>
                        <p className="font-semibold text-slate-800 text-[15px]">
                          {data.property.locality?.name}, {data.property.locality?.city_name}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Unlocks Tab */}
              {activeTab === "unlocks" && (
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {data.unlocks?.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[32px] text-slate-300">key_off</span>
                      </div>
                      <p className="text-slate-500 font-medium">No unlocks recorded for this property yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[14px]">
                      <thead className="bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Buyer</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Payment</th>
                          <th className="px-6 py-4">Lead Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.unlocks.map(unlock => (
                          <tr key={unlock.id} className="hover:bg-slate-50/60 transition-colors group">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{unlock.buyer_name}</p>
                              <p className="text-[12px] font-medium text-slate-500 mt-0.5">{unlock.buyer_phone}</p>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-500">
                              {formatDate(unlock.created_at)}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700">
                              {parseFloat(unlock.amount) === 0 ? (
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                                  {unlock.pass_name || "Pass Credit"}
                                </span>
                              ) : (
                                `₹${unlock.amount}`
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                unlock.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 
                                unlock.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {unlock.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                unlock.lead_status === 'new' ? 'bg-blue-50 text-blue-600' : 
                                unlock.lead_status === 'contacted' ? 'bg-purple-50 text-purple-600' :
                                unlock.lead_status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {unlock.lead_status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Audit Log Tab */}
              {activeTab === "audit" && (() => {
                const logs = data.audit_logs || [];
                
                // Categorize counts
                const modCount = logs.filter(l => l.event_category === 'moderation' || l.field_name === 'status').length;
                const priceCount = logs.filter(l => l.event_category === 'pricing' || l.field_name === 'price').length;
                const leadCount = logs.filter(l => l.event_category === 'lead_unlock' || l.field_name === 'contact_unlocked').length;
                const sysCount = logs.filter(l => l.event_category === 'system' || l.changed_by === 'System').length;
                const lifeCount = logs.filter(l => l.event_category === 'lifecycle' && l.changed_by !== 'System').length;

                // Price trend calculation
                const priceLogs = logs.filter(l => l.field_name === 'price' && l.price_change_pct != null);
                const latestPriceDiff = priceLogs.length > 0 ? priceLogs[0].price_change_pct : null;

                // Client filter states
                const [categoryFilter, setCategoryFilter] = useState("all");
                const [searchQuery, setSearchQuery] = useState("");
                const [viewMode, setViewMode] = useState("timeline"); // "timeline" or "table"

                // Filtered logs
                const filteredLogs = logs.filter(log => {
                  if (categoryFilter === 'moderation' && log.event_category !== 'moderation' && log.field_name !== 'status') return false;
                  if (categoryFilter === 'pricing' && log.event_category !== 'pricing' && log.field_name !== 'price') return false;
                  if (categoryFilter === 'lead_unlock' && log.event_category !== 'lead_unlock' && log.field_name !== 'contact_unlocked') return false;
                  if (categoryFilter === 'lifecycle' && (log.event_category !== 'lifecycle' || log.changed_by === 'System')) return false;
                  if (categoryFilter === 'system' && log.event_category !== 'system' && log.changed_by !== 'System') return false;

                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const matchActor = (log.changed_by || "").toLowerCase().includes(q);
                    const matchField = (log.field_name || "").toLowerCase().includes(q);
                    const matchReason = (log.reason || "").toLowerCase().includes(q);
                    const matchIp = (log.ip_address || "").toLowerCase().includes(q);
                    const matchDevice = (log.device_label || "").toLowerCase().includes(q);
                    if (!matchActor && !matchField && !matchReason && !matchIp && !matchDevice) return false;
                  }
                  return true;
                });

                // Export CSV Handler
                const handleExportCsv = () => {
                  if (!logs.length) return;
                  const headers = ["Timestamp", "Category", "Actor", "Actor Role", "Field", "Old Value", "New Value", "Reason / Notes", "IP Address", "Device"];
                  const rows = logs.map(l => [
                    `"${new Date(l.changed_at).toLocaleString()}"`,
                    `"${l.event_category || 'lifecycle'}"`,
                    `"${l.changed_by || 'System'}"`,
                    `"${l.changed_by_role || 'system'}"`,
                    `"${l.field_name || ''}"`,
                    `"${(l.old_value || '').replace(/"/g, '""')}"`,
                    `"${(l.new_value || '').replace(/"/g, '""')}"`,
                    `"${(l.reason || '').replace(/"/g, '""')}"`,
                    `"${l.ip_address || 'N/A'}"`,
                    `"${l.device_label || 'N/A'}"`
                  ]);
                  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `Property_${propertyId}_Audit_Trail.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Audit trail exported successfully!");
                };

                const getCategoryStyle = (category, field) => {
                  if (category === 'moderation' || field === 'status') {
                    return { icon: 'verified_user', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Moderation' };
                  }
                  if (category === 'pricing' || field === 'price') {
                    return { icon: 'payments', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Pricing' };
                  }
                  if (category === 'lead_unlock' || field === 'contact_unlocked') {
                    return { icon: 'lock_open', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', label: 'Lead Unlock' };
                  }
                  if (category === 'security' || field === 'is_fraud_flagged') {
                    return { icon: 'gpp_bad', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', label: 'Security' };
                  }
                  if (category === 'system') {
                    return { icon: 'smart_toy', bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500', label: 'System' };
                  }
                  return { icon: 'published_with_changes', bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', label: 'Lifecycle' };
                };

                return (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    
                    {/* Top Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Logs</p>
                          <p className="text-xl font-black text-slate-900 mt-0.5">{logs.length}</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                          <span className="material-symbols-outlined text-[20px]">history</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Moderation Checks</p>
                          <p className="text-xl font-black text-emerald-600 mt-0.5">{modCount}</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <span className="material-symbols-outlined text-[20px]">verified</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Buyer Unlocks</p>
                          <p className="text-xl font-black text-indigo-600 mt-0.5">{leadCount}</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <span className="material-symbols-outlined text-[20px]">key</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Price Trend</p>
                          <p className="text-[14px] font-extrabold text-slate-800 mt-1 flex items-center gap-1">
                            {latestPriceDiff != null ? (
                              latestPriceDiff < 0 ? (
                                <span className="text-emerald-600 flex items-center font-black">
                                  <span className="material-symbols-outlined text-[16px]">trending_down</span> {latestPriceDiff}%
                                </span>
                              ) : latestPriceDiff > 0 ? (
                                <span className="text-rose-600 flex items-center font-black">
                                  <span className="material-symbols-outlined text-[16px]">trending_up</span> +{latestPriceDiff}%
                                </span>
                              ) : "Stable"
                            ) : `${priceCount} Edits`}
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                          <span className="material-symbols-outlined text-[20px]">currency_rupee</span>
                        </div>
                      </div>
                    </div>

                    {/* Filter, Search & Export Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
                      {/* Category Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'all', label: `All (${logs.length})` },
                          { id: 'moderation', label: `Moderation (${modCount})` },
                          { id: 'pricing', label: `Pricing (${priceCount})` },
                          { id: 'lead_unlock', label: `Unlocks (${leadCount})` },
                          { id: 'lifecycle', label: `Lifecycle (${lifeCount})` },
                          { id: 'system', label: `System (${sysCount})` },
                        ].map(pill => (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() => setCategoryFilter(pill.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                              categoryFilter === pill.id
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {pill.label}
                          </button>
                        ))}
                      </div>

                      {/* Search, View Toggle, Export */}
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-48">
                          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search logs, IP, actor..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>

                        {/* View Switcher */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setViewMode("timeline")}
                            className={`p-1.5 rounded-lg transition-all ${
                              viewMode === 'timeline' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Timeline View"
                          >
                            <span className="material-symbols-outlined text-[18px]">timeline</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={`p-1.5 rounded-lg transition-all ${
                              viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Data Table View"
                          >
                            <span className="material-symbols-outlined text-[18px]">table_rows</span>
                          </button>
                        </div>

                        {/* Export CSV Button */}
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          disabled={!logs.length}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">download</span>
                          <span>Export CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Content Display: Timeline or Table */}
                    {filteredLogs.length === 0 ? (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                          <span className="material-symbols-outlined text-[24px]">history_toggle_off</span>
                        </div>
                        <p className="text-slate-700 font-bold text-sm">No audit records found</p>
                        <p className="text-slate-400 text-xs mt-1">Try clearing your filters or search keywords.</p>
                      </div>
                    ) : viewMode === "timeline" ? (
                      /* ─── TIMELINE VIEW ─── */
                      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {filteredLogs.map(log => {
                          const style = getCategoryStyle(log.event_category, log.field_name);
                          return (
                            <div key={log.id} className="relative group">
                              {/* Node Dot */}
                              <div className={`absolute -left-[23px] sm:-left-[31px] top-1.5 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110 ${style.bg}`}>
                                <span className="material-symbols-outlined text-[13px]">{style.icon}</span>
                              </div>

                              {/* Card Content */}
                              <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
                                <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${style.bg}`}>
                                      {style.label}
                                    </span>
                                    <span className="text-[13px] font-extrabold text-slate-900 capitalize">
                                      {log.field_name.replace(/_/g, ' ')}
                                    </span>
                                    {log.price_change_pct != null && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        log.price_change_pct < 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}>
                                        {log.price_change_pct < 0 ? `📉 ${log.price_change_pct}% drop` : `📈 +${log.price_change_pct}% increase`}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    <span>{formatDate(log.changed_at)}</span>
                                  </div>
                                </div>

                                {/* Diff Details */}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Change:</span>
                                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 line-through text-[11px] font-semibold border border-slate-200/50">
                                    {log.old_value || "(empty)"}
                                  </span>
                                  <span className="material-symbols-outlined text-[14px] text-slate-400">arrow_forward</span>
                                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-black text-[11px] border border-emerald-200 shadow-2xs">
                                    {log.new_value || "(empty)"}
                                  </span>
                                </div>

                                {/* Moderator Notes / Reason Box */}
                                {log.reason && (
                                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-indigo-500 mt-0.5">chat_bubble</span>
                                    <p className="text-[12px] font-semibold text-slate-700 leading-relaxed italic">
                                      "{log.reason}"
                                    </p>
                                  </div>
                                )}

                                {/* Actor & Device Metadata Footer */}
                                <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-bold">Triggered by:</span>
                                    <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                                      log.changed_by === 'System'
                                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                        : 'bg-slate-900 text-white'
                                    }`}>
                                      {log.changed_by} ({log.changed_by_role || 'user'})
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                                    {log.ip_address && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 font-mono text-[10px] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px] text-slate-400">lan</span>
                                        {log.ip_address}
                                      </span>
                                    )}
                                    {log.device_label && log.device_label !== 'Unknown Device' && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 font-medium text-[10px] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px] text-slate-400">devices</span>
                                        {log.device_label}
                                      </span>
                                    )}
                                  </div>
                                </div>

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ─── TABLE VIEW ─── */
                      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Date & Time</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Actor</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Field</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Change Value</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Remarks / Reason</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">IP & Device</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[12px]">
                              {filteredLogs.map(log => {
                                const style = getCategoryStyle(log.event_category, log.field_name);
                                return (
                                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-500">
                                      {formatDate(log.changed_at)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${style.bg}`}>
                                        {style.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                        log.changed_by === 'System' ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white'
                                      }`}>
                                        {log.changed_by}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-bold text-slate-700">
                                      {log.field_name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 line-through text-[11px] font-semibold">
                                          {log.old_value || "(empty)"}
                                        </span>
                                        <span className="material-symbols-outlined text-[12px] text-slate-300">arrow_right_alt</span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[11px]">
                                          {log.new_value || "(empty)"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-600 font-medium text-[11px]" title={log.reason || ""}>
                                      {log.reason || "-"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-[10px]">{log.ip_address || "N/A"}</span>
                                        <span className="text-[10px] text-slate-400">{log.device_label || ""}</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

            </div>
          </>
        )}
      </div>
    </div>
  );
};
