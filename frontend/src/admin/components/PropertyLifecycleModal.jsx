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
                            <td className="px-6 py-4 font-bold text-slate-700">₹{unlock.amount}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                unlock.status === 'paid' ? 'bg-emerald-50 text-indigo-600' : 
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
              {activeTab === "audit" && (
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {data.audit_logs?.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[32px] text-slate-300">history_toggle_off</span>
                      </div>
                      <p className="text-slate-500 font-medium">No changes have been recorded yet.</p>
                    </div>
                  ) : (
                    <div className="relative p-8">
                      {/* Timeline line */}
                      <div className="absolute top-8 bottom-8 left-[47px] w-[3px] bg-slate-100 rounded-full"></div>
                      
                      <div className="space-y-8 relative">
                        {data.audit_logs.map(log => (
                          <div key={log.id} className="flex gap-5 group">
                            <div className="relative z-10 bg-white border-[3px] border-emerald-400 rounded-full w-12 h-12 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300 shrink-0">
                              <span className="material-symbols-outlined text-[20px]">history_edu</span>
                            </div>
                            <div className="flex-1 bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                                <p className="text-[14px] text-slate-600">
                                  <strong className="text-slate-800 font-bold">{log.changed_by}</strong> updated{' '}
                                  <span className="font-mono text-[12px] font-semibold bg-slate-100 text-brand-600 px-2 py-1 rounded-md border border-slate-200/60">
                                    {log.field_name}
                                  </span>
                                </p>
                                <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                                  {formatDate(log.changed_at)}
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-[13px] mt-4">
                                <div className="flex-1 bg-indigo-50/50 border border-indigo-100/50 text-indigo-600 p-3 rounded-lg line-through opacity-80 break-all font-medium">
                                  {log.old_value || "(empty)"}
                                </div>
                                <div className="flex items-center justify-center text-slate-300 hidden sm:flex">
                                  <span className="material-symbols-outlined text-[24px]">arrow_right_alt</span>
                                </div>
                                <div className="flex-1 bg-emerald-50/50 border border-emerald-100/50 text-emerald-700 p-3 rounded-lg font-bold break-all shadow-inner">
                                  {log.new_value || "(empty)"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
};
