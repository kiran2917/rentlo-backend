import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

const STATUS_COLORS = {
  pending: "bg-amber-500/10 text-amber-500 border border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-500 border border-red-500/30",
  cancelled: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

export const OwnerVisits = () => {
  const [slots, setSlots] = useState([]);
  const [myProperties, setMyProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ property_id: "", slot_date: "", slot_time: "", max_bookings: 1 });
  const [saving, setSaving] = useState(false);

  const fetchSlots = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/visits/my-slots/`, { credentials: "include" });
      if (r.ok) setSlots(await r.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        setMyProperties(list);
        if (list.length > 0 && !form.property_id) {
          setForm(prev => ({ ...prev, property_id: list[0].id.toString() }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSlots();
    fetchProperties();
  }, []);

  const addSlot = async (e) => {
    e.preventDefault();
    if (!form.property_id || !form.slot_date || !form.slot_time) {
      toast.error("Please fill all fields");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(
        `${import.meta.env.VITE_API_URL}/visits/property/${form.property_id}/slots/`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot_date: form.slot_date, slot_time: form.slot_time, max_bookings: form.max_bookings }),
        }
      );
      if (r.ok) {
        toast.success("Visit slot added!");
        setShowAddModal(false);
        setForm({ property_id: "", slot_date: "", slot_time: "", max_bookings: 1 });
        fetchSlots();
      } else {
        toast.error("Failed to add slot");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleBookingAction = async (bookingId, status) => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/visits/bookings/${bookingId}/action/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        toast.success(`Booking ${status}!`);
        fetchSlots();
      }
    } catch {
      toast.error("Error updating booking");
    }
  };

  const deleteSlot = async (slotId) => {
    if (!window.confirm("Remove this slot?")) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/visits/slots/${slotId}/delete/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        toast.success("Slot removed");
        fetchSlots();
      }
    } catch {}
  };

  return (
    <>
      {/* Add Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[20px] font-extrabold" style={{ color: "var(--ink)" }}>Add Visit Slot</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center border opacity-80 hover:opacity-100 transition-colors"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={addSlot} className="space-y-5">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
                  Select Your Listed Property
                </label>
                {myProperties.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[12px] font-bold text-center">
                    No active property listings found. Please post a listing first.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {myProperties.map((p) => {
                      const isSelected = form.property_id === p.id.toString();
                      const thumb = p.media?.[0]?.thumbnail_url || p.media?.[0]?.image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=300";
                      const title = `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${p.property_type ? p.property_type.replace('_', ' ').toUpperCase() : 'Property'}`;
                      const locationStr = `${p.locality_details?.name || ''}${p.locality_details?.city_name ? ', ' + p.locality_details.city_name : ''}`;

                      return (
                        <div
                          key={p.id}
                          onClick={() => setForm({ ...form, property_id: p.id.toString() })}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                              : "border-border bg-surface-alt hover:opacity-90"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={thumb}
                              alt={title}
                              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border"
                              style={{ borderColor: "var(--border)" }}
                            />
                            <div className="flex flex-col truncate">
                              <span className="text-[13px] font-bold truncate" style={{ color: "var(--ink)" }}>
                                {title}
                              </span>
                              <span className="text-[11px] font-medium truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                <span className="material-symbols-outlined text-[13px] text-emerald-500">location_on</span>
                                {locationStr || "Karnataka"}
                              </span>
                              <span className="text-[11px] font-extrabold text-emerald-500 mt-0.5">
                                &#8377;{p.price ? (typeof p.price === 'number' ? p.price.toLocaleString("en-IN") : p.price) : 'N/A'} / mo
                              </span>
                            </div>
                          </div>

                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-400"
                          }`}>
                            {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>Date</label>
                  <input
                    type="date"
                    value={form.slot_date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, slot_date: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>Time</label>
                  <input
                    type="time"
                    value={form.slot_time}
                    onChange={(e) => setForm({ ...form, slot_time: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>Max Visitors</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.max_bookings}
                  onChange={(e) => setForm({ ...form, max_bookings: parseInt(e.target.value) || 1 })}
                  className="w-full h-11 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-70"
              >
                {saving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Slot
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              Visit Slots
            </h1>
            <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
              Open time slots for buyers to schedule property viewings.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold rounded-xl flex items-center gap-2 text-[12px] uppercase tracking-wider transition-all shadow-md cursor-pointer self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Visit Slot
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-300 border-t-slate-900 animate-spin"></div>
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-3xl border shadow-sm p-16 flex flex-col items-center text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-emerald-500 text-[40px]">event_available</span>
            </div>
            <h3 className="text-[22px] font-extrabold mb-2" style={{ color: "var(--ink)" }}>No visit slots yet</h3>
            <p className="text-[13.5px] font-medium mb-6 max-w-sm" style={{ color: "var(--text-muted)" }}>
              Add your first visit slot to let buyers book a time to view your property without any back-and-forth calling.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-11 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold rounded-xl flex items-center gap-2 text-[12.5px] uppercase tracking-wider shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add First Slot
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {slots.map((slot) => (
              <div key={slot.id} className="rounded-3xl border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                {/* Slot Header */}
                <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-emerald-500 uppercase">
                        {new Date(slot.slot_date).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span className="text-[20px] font-extrabold text-emerald-500 leading-none">
                        {new Date(slot.slot_date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[15px] capitalize" style={{ color: "var(--ink)" }}>
                        {slot.property_type ? slot.property_type.replace('_', ' ') : 'Property'} Listing
                      </h3>
                      <p className="text-[13px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {new Date(`1970-01-01T${slot.slot_time}`).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &mdash; Max {slot.max_bookings} visitor{slot.max_bookings > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
                      {slot.bookings?.length || 0} booking{slot.bookings?.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => deleteSlot(slot.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-red-500/10 text-red-500"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Bookings */}
                {slot.bookings?.length === 0 ? (
                  <div className="px-6 py-4 text-[13px] font-medium italic" style={{ color: "var(--text-muted)" }}>
                    No bookings yet for this slot.
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {slot.bookings.map((booking) => (
                      <div key={booking.id} className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center font-extrabold text-[13px] flex-shrink-0 border border-slate-800">
                            {booking.buyer_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-[14px]" style={{ color: "var(--ink)" }}>{booking.buyer_name}</p>
                            {booking.buyer_phone && (
                              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{booking.buyer_phone}</p>
                            )}
                            {booking.note && (
                              <p className="text-[12px] italic mt-0.5" style={{ color: "var(--text-muted)" }}>&ldquo;{booking.note}&rdquo;</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-12 sm:ml-0">
                          <span className={`text-[10.5px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${STATUS_COLORS[booking.status]}`}>
                            {booking.status}
                          </span>
                          {booking.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleBookingAction(booking.id, "approved")}
                                className="h-8 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-extrabold rounded-lg transition-all cursor-pointer shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleBookingAction(booking.id, "rejected")}
                                className="h-8 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
