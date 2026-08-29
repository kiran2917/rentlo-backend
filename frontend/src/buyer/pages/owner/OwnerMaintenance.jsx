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
        setTickets(Array.isArray(tData) ? tData : []);
      }

      if (propRes.ok) {
        const pData = await propRes.json();
        const list = Array.isArray(pData) ? pData : pData.results || [];
        setProperties(list);
        if (list.length > 0) {
          setFormData((prev) => ({ ...prev, property: list[0].id }));
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
      toast.error("Please fill in title and description");
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
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 border shadow-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/20 text-white">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-3 inline-block">
              Property Care & Facilities
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1">
              Maintenance & Repair Ticket Manager
            </h1>
            <p className="text-slate-300 text-sm md:text-base mt-2 font-medium leading-relaxed">
              Track maintenance issues reported by tenants, assign local service technicians, log repair expenses, and resolve tickets.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Raise Repair Ticket</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl border bg-white shadow-xs border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Open Tickets</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{openTicketsCount} Pending</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-[24px]">pending_actions</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl border bg-white shadow-xs border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">In Progress</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{inProgressCount} Active</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-[24px]">engineering</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl border bg-white shadow-xs border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Resolved Repairs</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount} Completed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-[24px]">task_alt</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {["all", "open", "in_progress", "resolved"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              statusFilter === tab ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="rounded-3xl border bg-white shadow-xs overflow-hidden border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin mx-auto mb-3"></div>
            Loading maintenance tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">handyman</span>
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">No Maintenance Tickets Found</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
              All properties are in good shape! Raise a ticket whenever a repair or cleaning is required.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Raise Repair Ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTickets.map((t) => {
              const cat = categories[t.category] || categories.other;
              return (
                <div key={t.id} className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">add_circle</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Raise Repair Ticket</h3>
                <p className="text-xs text-slate-400 font-semibold">Report an issue and assign a service technician</p>
              </div>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Select Property *</label>
                <select
                  value={formData.property}
                  onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.locality?.name || p.city_name || "Listed"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Bathroom Geyser Not Heating"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                  >
                    {Object.entries(categories).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                  >
                    <option value="low">Low (Routine)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="high">High (Urgent)</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Description & Location Inside Flat *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue, when it started, and specific location..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Assign Vendor / Technician</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh (Plumber)"
                    value={formData.assigned_vendor_name}
                    onChange={(e) => setFormData({ ...formData, assigned_vendor_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Technician Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9845098765"
                    value={formData.assigned_vendor_phone}
                    onChange={(e) => setFormData({ ...formData, assigned_vendor_phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all cursor-pointer"
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
