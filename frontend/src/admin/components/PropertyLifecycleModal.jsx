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
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propertyId}/lifecycle/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch lifecycle data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load property lifecycle data.");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchLifecycleData();
  }, [propertyId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">history</span>
              Property Lifecycle & Audit Log
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Property ID: #{propertyId}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined w-5 h-5">close</span>
          </button>
        </div>

        {loading || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"></div>
            <p className="text-slate-500 mt-4 font-medium animate-pulse">Gathering lifecycle data...</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center px-6 border-b bg-white gap-6">
              {[
                { id: "overview", icon: "info", label: "Registration & Overview" },
                { id: "unlocks", icon: "key", label: `Unlock History (${data.unlocks?.length || 0})` },
                { id: "audit", icon: "history", label: `Audit Log (${data.audit_logs?.length || 0})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? "border-brand-500 text-brand-600" 
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">person</span> Registration Info
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Owner Name</p>
                        <p className="font-medium text-slate-800">{data.property.owner_name || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Owner Phone</p>
                        <p className="font-medium text-slate-800">{data.property.owner_phone || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Registered By</p>
                        <p className="font-medium text-slate-800 capitalize">
                          {data.property.added_by || "Self"} 
                          {data.property.agent ? ` (Agent ID: ${data.property.agent})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">location_on</span> Property Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Rent / Price</p>
                        <p className="font-bold text-slate-800 text-lg">
                          ₹{Number(data.property.price).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Status & Verification</p>
                        <div className="flex gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 uppercase">
                            {data.property.status?.replace('_', ' ')}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 uppercase">
                            {data.property.verification_status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Location</p>
                        <p className="font-medium text-slate-800">
                          {data.property.locality?.name}, {data.property.locality?.city_name}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Unlocks Tab */}
              {activeTab === "unlocks" && (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  {data.unlocks?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No unlocks recorded for this property yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                        <tr>
                          <th className="px-4 py-3">Buyer</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">Lead Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.unlocks.map(unlock => (
                          <tr key={unlock.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{unlock.buyer_name}</p>
                              <p className="text-xs text-slate-500">{unlock.buyer_phone}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {formatDate(unlock.created_at)}
                            </td>
                            <td className="px-4 py-3 font-medium">₹{unlock.amount}</td>
                            <td className="px-4 py-3 capitalize">{unlock.status}</td>
                            <td className="px-4 py-3 capitalize">
                              <span className="px-2 py-1 rounded bg-slate-100 text-xs font-semibold">
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
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  {data.audit_logs?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No changes have been recorded since audit logging was enabled.
                    </div>
                  ) : (
                    <div className="relative p-6">
                      <div className="absolute top-6 bottom-6 left-[39px] w-0.5 bg-slate-200"></div>
                      <div className="space-y-8 relative">
                        {data.audit_logs.map(log => (
                          <div key={log.id} className="flex gap-4">
                            <div className="relative z-10 bg-white border-2 border-brand-500 rounded-full w-10 h-10 flex items-center justify-center text-brand-600 shadow-sm shrink-0">
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </div>
                            <div className="flex-1 bg-slate-50 border rounded-lg p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-500">
                                  <strong className="text-slate-800">{log.changed_by}</strong> updated <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">{log.field_name}</span>
                                </p>
                                <p className="text-xs text-slate-400">
                                  {formatDate(log.changed_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-sm mt-3">
                                <div className="flex-1 bg-red-50 text-red-700 p-2 rounded line-through opacity-70 break-all">
                                  {log.old_value || "(empty)"}
                                </div>
                                <div className="text-slate-400">→</div>
                                <div className="flex-1 bg-green-50 text-green-700 p-2 rounded font-medium break-all">
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
