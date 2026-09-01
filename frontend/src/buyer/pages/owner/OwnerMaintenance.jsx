import React, { useState, useEffect } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { toast } from "react-toastify";

export const OwnerMaintenance = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Form State
  const [formData, setFormData] = useState({
    property: "",
    title: "",
    category: "plumbing",
    priority: "medium",
    description: "",
    assigned_vendor_name: "",
    assigned_vendor_phone: "",
    estimated_cost: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [ticketRes, propRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/properties/maintenance-tickets/`, { credentials: "include" }),
        fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, { credentials: "include" }),
      ]);

      if (ticketRes.ok) {
        const tData = await ticketRes.json();
        setTickets(Array.isArray(tData) ? tData : (tData?.results || []));
      }

      if (propRes.ok) {
        const pData = await propRes.json();
        const list = Array.isArray(pData) ? pData : (pData?.results || []);
        setProperties(list);
        if (list.length > 0) {
          setFormData((prev) => ({ ...prev, property: prev.property || list[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load maintenance data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.property) {
      toast.error("Please select a property and fill in title and description");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/maintenance-tickets/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success(`Repair ticket #${created.id} created!`);
        setShowCreateModal(false);
        setTickets((prev) => [created, ...prev]);
        setFormData({
          property: properties[0]?.id || "",
          title: "",
          category: "plumbing",
          priority: "medium",
          description: "",
          assigned_vendor_name: "",
          assigned_vendor_phone: "",
          estimated_cost: 0,
        });
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to create ticket");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/maintenance-tickets/${ticketId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
        if (selectedTicket?.id === ticketId) setSelectedTicket(updated);
        toast.success(`Ticket marked as ${newStatus.replace('_', ' ')}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update ticket status");
    }
  };

  const categories = {
    plumbing: { name: "Plumbing / Water", icon: "water_drop", color: "text-blue-500 bg-blue-50" },
    electrical: { name: "Electrical / Power", icon: "bolt", color: "text-amber-500 bg-amber-50" },
    appliance: { name: "Appliance Repair", icon: "kitchen", color: "text-purple-500 bg-purple-50" },
    carpentry: { name: "Carpentry & Locks", icon: "handyman", color: "text-orange-500 bg-orange-50" },
    painting: { name: "Painting & Seepage", icon: "format_paint", color: "text-teal-500 bg-teal-50" },
    cleaning: { name: "Deep Cleaning & Pest", icon: "sanitizer", color: "text-emerald-500 bg-emerald-50" },
    other: { name: "General Repair", icon: "build", color: "text-slate-500 bg-slate-50" },
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  const openTicketsCount = tickets.filter((t) => t.status === "open" || t.status === "assigned").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-12 px-2 sm:px-0">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 border shadow-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/20 text-white">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-3 inline-block">
              Property Care & Facilities
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Maintenance & Repairs</h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium mt-2 leading-relaxed">
              Track maintenance tickets across your properties, assign local service technicians, log repair expenses, and resolve tenant complaints swiftly.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Raise Repair Ticket</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">pending_actions</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Open Tickets</p>
            <h3 className="text-2xl font-black text-slate-800">{openTicketsCount} Pending</h3>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">engineering</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">In Progress</p>
            <h3 className="text-2xl font-black text-slate-800">{inProgressCount} Active</h3>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">check_circle</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resolved</p>
            <h3 className="text-2xl font-black text-slate-800">{resolvedCount} Completed</h3>
          </div>
        </div>
      </div>

      {/* Tickets List Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">Repair & Service Tickets</h2>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Manage tasks assigned to plumbers, electricians, and carpenters</p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl w-full sm:w-auto overflow-x-auto">
            {["all", "open", "in_progress", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-black capitalize transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">No Maintenance Tickets</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1">
              Your properties are in pristine condition with no active repair requests.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider shadow transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create First Ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTickets.map((t) => {
              const cat = categories[t.category] || categories.other;
              return (
                <div key={t.id} className="p-5 sm:p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${cat.color}`}>
                      <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-extrabold text-slate-900 text-base">{t.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          t.priority === 'emergency' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          t.priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 max-w-xl">
                        {t.description}
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1.5">
                        Property: <span className="text-slate-700">{t.property_title}</span> • Category: <span className="text-indigo-600 font-bold">{cat.name}</span>
                        {t.assigned_vendor_name && ` • Technician: ${t.assigned_vendor_name} (📱 ${t.assigned_vendor_phone})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      t.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      t.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>

                    {t.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateTicketStatus(t.id, 'resolved')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs transition-colors border border-emerald-200 cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">done_all</span>
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 sm:top-5 right-4 sm:right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-5 sm:mb-6 pb-4 border-b border-slate-100 pr-10">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">add_circle</span>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">Raise Repair Ticket</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">Report an issue and assign a service technician</p>
              </div>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Select Property *</label>
                <div className="relative">
                  <select
                    value={formData.property}
                    required
                    onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 appearance-none cursor-pointer"
                  >
                    {properties.length === 0 ? (
                      <option value="" disabled>No properties listed — please post a listing first</option>
                    ) : (
                      <>
                        <option value="" disabled>-- Select a Property --</option>
                        {properties.map((p) => {
                          const buildingName = p.exact_address ? p.exact_address.split(",")[0].trim() : "";
                          const locality = p.locality_details?.name || p.locality_name || "";
                          const city = p.locality_details?.city_name || p.city_name || "";
                          const locationStr = locality ? (city ? `${locality}, ${city}` : locality) : city;
                          const typeStr = p.property_type ? p.property_type.replace(/_/g, " ").toUpperCase() : (p.property_category || "Property");
                          const bhk = p.bedrooms ? `${p.bedrooms} BHK ` : "";
                          const title = p.display_title || p.title || `${bhk}${typeStr}${locationStr ? ` in ${locationStr}` : ""}`;
                          const label = buildingName && !title.includes(buildingName) ? `${buildingName} — ${title}` : title;
                          return (
                            <option key={p.id} value={p.id}>{label}</option>
                          );
                        })}
                      </>
                    )}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Bathroom Geyser Not Heating"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 appearance-none cursor-pointer"
                    >
                      {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>{v.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">
                      expand_more
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Priority</label>
                  <div className="relative">
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 appearance-none cursor-pointer"
                    >
                      <option value="low">Low (Routine)</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="high">High (Urgent)</option>
                      <option value="emergency">Emergency</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Description & Location Inside Flat *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue, when it started, and specific location..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-medium text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Assign Vendor / Technician</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh (Plumber)"
                    value={formData.assigned_vendor_name}
                    onChange={(e) => setFormData({ ...formData, assigned_vendor_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">Technician Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9845098765"
                    value={formData.assigned_vendor_phone}
                    onChange={(e) => setFormData({ ...formData, assigned_vendor_phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
