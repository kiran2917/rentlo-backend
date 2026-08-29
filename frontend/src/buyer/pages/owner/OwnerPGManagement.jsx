import React, { useState, useEffect } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { toast } from "react-toastify";

export const OwnerPGManagement = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);

  // Form State for Digital Check-In
  const [formData, setFormData] = useState({
    property: "",
    resident_name: "",
    phone: "",
    email: "",
    room_number: "101",
    bed_number: "Bed A",
    monthly_rent: 7500,
    security_deposit: 15000,
    deposit_paid: true,
    mess_opted: true,
    mess_fee: 2500,
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchResidents(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  const fetchProperties = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        const pgList = list.filter((p) => p.property_category === "pg" || p.property_type?.includes("pg"));
        setProperties(pgList.length > 0 ? pgList : list);
        if (pgList.length > 0) {
          setSelectedPropertyId(pgList[0].id);
          setFormData((prev) => ({ ...prev, property: pgList[0].id }));
        } else if (list.length > 0) {
          setSelectedPropertyId(list[0].id);
          setFormData((prev) => ({ ...prev, property: list[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async (propId) => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/pg-residents/?property_id=${propId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setResidents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load resident roster");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!formData.resident_name || !formData.phone || !formData.room_number) {
      toast.error("Please fill all required resident details");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/pg-residents/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...formData, property: selectedPropertyId }),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success(`Digital check-in completed for ${formData.resident_name}!`);
        setShowCheckInModal(false);
        setResidents((prev) => [created, ...prev]);
        setFormData({
          property: selectedPropertyId,
          resident_name: "",
          phone: "",
          email: "",
          room_number: "101",
          bed_number: "Bed A",
          monthly_rent: 7500,
          security_deposit: 15000,
          deposit_paid: true,
          mess_opted: true,
          mess_fee: 2500,
          emergency_contact_name: "",
          emergency_contact_phone: "",
        });
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to check in resident");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error during resident check-in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (residentId, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/pg-residents/${residentId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setResidents((prev) => prev.map((r) => (r.id === residentId ? updated : r)));
        toast.success(`Resident status updated to ${newStatus}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    }
  };

  const activeResidents = residents.filter((r) => r.status === "active");
  const noticeResidents = residents.filter((r) => r.status === "notice_period");
  const currentProperty = properties.find((p) => p.id === Number(selectedPropertyId)) || properties[0];

  const totalCapacity = currentProperty?.total_beds || 30;
  const occupiedBeds = activeResidents.length + noticeResidents.length;
  const availableBeds = Math.max(0, totalCapacity - occupiedBeds);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 border shadow-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/20 text-white">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-3 inline-block">
              Live PG / Hostel Management
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1">
              PG Resident Roster & Bed Allocation
            </h1>
            <p className="text-slate-300 text-sm md:text-base mt-2 font-medium leading-relaxed">
              Manage room bed allocations, digital resident check-ins, security deposits, and monthly mess fees in real time.
            </p>
          </div>
          <button
            onClick={() => setShowCheckInModal(true)}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>Digital Check-In</span>
          </button>
        </div>
      </div>

      {/* Property Selector & Occupancy Bar */}
      <div className="p-6 rounded-3xl border bg-white shadow-xs border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">Select PG / Co-Living Building</label>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full md:max-w-md h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800 outline-none focus:border-indigo-500"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.title} ({p.locality?.name || p.city_name || "PG Property"})</option>
            ))}
          </select>
        </div>

        {/* Real-Time KPI Stats */}
        <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center min-w-[100px]">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Capacity</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalCapacity} Beds</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-center min-w-[100px]">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Occupied</p>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{occupiedBeds} Persons</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center min-w-[100px]">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Free Beds</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{availableBeds} Beds</p>
          </div>
        </div>
      </div>

      {/* Visual Capacity Bar */}
      <div className="p-6 rounded-3xl border bg-white shadow-xs border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600">Building Occupancy Rate</span>
          <span className="text-sm font-black text-indigo-600">{occupancyRate}% Full</span>
        </div>
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${occupancyRate}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
          ></div>
        </div>
      </div>

      {/* Resident Roster Table */}
      <div className="rounded-3xl border bg-white shadow-xs overflow-hidden border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Current Resident Roster</h2>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Active tenants, room allocations & payment statuses</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
            {residents.length} Registered
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-3"></div>
            Loading resident roster...
          </div>
        ) : residents.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">bed</span>
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">No Residents Checked In Yet</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
              Check in your first resident to allocate rooms, track security deposits, and automate monthly rent.
            </p>
            <button
              onClick={() => setShowCheckInModal(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Digital Check-In
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Resident</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Room & Bed</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Monthly Rent</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mess / Meals</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Deposit Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {residents.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs">
                          {r.resident_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{r.resident_name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">📱 {r.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-black text-xs border border-indigo-100">
                        Room {r.room_number} • {r.bed_number}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-900">
                      ₹{Number(r.monthly_rent).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                    </td>
                    <td className="px-5 py-4">
                      {r.mess_opted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px]">
                          Opted (₹{Number(r.mess_fee || 0).toLocaleString()})
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">No Mess</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {r.deposit_paid ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          ₹{Number(r.security_deposit).toLocaleString()} Paid
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold">Pending Deposit</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        r.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r.status === 'notice_period' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {r.status === 'active' ? 'Active' : r.status === 'notice_period' ? 'Notice Period' : 'Vacated'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {r.status === 'active' && (
                        <button
                          onClick={() => handleUpdateStatus(r.id, 'notice_period')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer border border-slate-200 mr-2"
                        >
                          Notice
                        </button>
                      )}
                      {r.status !== 'vacated' && (
                        <button
                          onClick={() => handleUpdateStatus(r.id, 'vacated')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Digital Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCheckInModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">person_add</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Resident Digital Check-In</h3>
                <p className="text-xs text-slate-400 font-semibold">Allocate bed, assign rent & record deposit</p>
              </div>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Resident Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Nair"
                    value={formData.resident_name}
                    onChange={(e) => setFormData({ ...formData, resident_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9845012345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Room Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 204"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Bed Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bed A, Single"
                    value={formData.bed_number}
                    onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Monthly Rent (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.monthly_rent}
                    onChange={(e) => setFormData({ ...formData, monthly_rent: Number(e.target.value) })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Security Deposit (₹)</label>
                  <input
                    type="number"
                    value={formData.security_deposit}
                    onChange={(e) => setFormData({ ...formData, security_deposit: Number(e.target.value) })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-xs text-slate-800">Monthly Mess / Meals</p>
                  <p className="text-[11px] text-slate-400">Include 3-times food service</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.mess_opted}
                  onChange={(e) => setFormData({ ...formData, mess_opted: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-all cursor-pointer"
                >
                  {submitting ? "Checking In..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
