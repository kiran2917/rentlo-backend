import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AdminLayout } from "../components/AdminLayout";

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export const ModerationQueue = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [fraudNotes, setFraudNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [imageModalUrl, setImageModalUrl] = useState(null);
  const itemsPerPage = 10;
  const detailPanelRef = useRef(null);

  useEffect(() => {
    if (selectedProperty && detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedProperty]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/?status=pending_review`,
        {
          credentials: "include",
        },
      );
      if (res.ok) {
        const data = await res.json();
        const sorted = data.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        setProperties(sorted);
      }
    } catch (err) {
      toast.error("Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAction = async (actionType) => {
    if (!selectedProperty) return;

    if (actionType === "reject" && !rejectReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (actionType === "flag_fraud" && !fraudNotes) {
      toast.error("Please provide notes for fraud flag");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        action: actionType,
        notes:
          actionType === "reject"
            ? rejectReason
            : actionType === "flag_fraud"
              ? fraudNotes
              : "",
      };

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/moderation/properties/${selectedProperty.id}/moderate/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        toast.success(`Property marked as ${actionType}`);
        setSelectedProperty(null);
        setRejectReason("");
        setFraudNotes("");
        await fetchQueue();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || `Failed to ${actionType} property. Status: ${res.status}`);
      }
    } catch (err) {
      toast.error("Network error applying action: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePhoto = async (mediaId) => {
    if (!window.confirm("Are you sure you want to remove this photo?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/media/${mediaId}/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Photo removed successfully!");
        setSelectedProperty(prev => {
          if (!prev) return null;
          return {
            ...prev,
            media: prev.media.filter(m => m.id !== mediaId)
          };
        });
        setProperties(prev => prev.map(p => {
          if (p.id === selectedProperty?.id) {
            return {
              ...p,
              media: p.media.filter(m => m.id !== mediaId)
            };
          }
          return p;
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || "Failed to remove photo.");
      }
    } catch (err) {
      toast.error("Network error removing photo.");
    }
  };

  const filteredProperties = properties.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(p.id).includes(q) ||
      p.property_type?.toLowerCase().includes(q) ||
      p.owner_name_display?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AdminLayout activeTab="moderation">
      <ToastContainer position="top-right" />

      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px] group-hover:animate-[spin_3s_linear_infinite]">
                hourglass_empty
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                Moderation Queue
              </h1>
              <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
                Review and approve pending property listings before they go
                live.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-orange-500 transition-colors">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 w-full border rounded-xl text-[13px] font-bold outline-none focus:border-orange-500 transition-all shadow-sm"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                placeholder="Search queue..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <button
              onClick={fetchQueue}
              className="flex items-center justify-center w-12 h-12 border rounded-xl shadow-sm transition-all hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
              title="Refresh List"
            >
              <span className="material-symbols-outlined text-[20px]">
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl border shadow-sm overflow-hidden mb-8 relative" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="relative z-10">
            {/* 🖥️ Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    <th className="py-4 px-6 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Property Details
                    </th>
                    <th className="py-4 px-6 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Submitted
                    </th>
                    <th className="py-4 px-6 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Status
                    </th>
                    <th className="py-4 px-6 text-[11px] font-extrabold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center sticky left-0 right-0">
                        <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                          <div className="w-8 h-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
                          <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                            Loading queue...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredProperties.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center sticky left-0 right-0">
                        <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs sm:max-w-md mx-auto">
                          <span className="material-symbols-outlined text-5xl text-emerald-500/80">
                            task_alt
                          </span>
                          <p className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
                            Queue is clear
                          </p>
                          <p className="text-[12px] font-medium text-center" style={{ color: "var(--text-muted)" }}>
                            No pending properties require attention.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProperties.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50 transition-all duration-300 group cursor-pointer ${selectedProperty?.id === p.id ? "bg-orange-50 ring-2 ring-inset ring-orange-200" : ""}`}
                        onClick={() => {
                          setSelectedProperty(p);
                          setRejectReason("");
                          setFraudNotes("");
                        }}
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-white/80 border border-white shadow-sm group-hover:scale-105 transition-transform duration-500">
                              {p.media && p.media.length > 0 ? (
                                <img
                                  src={p.media[0].thumbnail_url || p.media[0].image_url}
                                  alt="Property"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <span className="material-symbols-outlined text-[24px]">
                                    home
                                  </span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[14px] font-extrabold text-slate-900 capitalize drop-shadow-sm" style={{ color: "var(--ink)" }}>
                                  #{p.id} — {p.property_type}
                                </p>
                                {p.duplicate_of && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                                    Duplicate
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                                {p.owner_name_display}
                              </p>
                              <p className="text-[13px] font-extrabold text-orange-600">
                                ₹{parseFloat(p.price).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                            {new Date(p.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {new Date(p.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>
                        <td className="py-5 px-6">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-amber-50/80 text-amber-700 border border-amber-200/50 shadow-sm">
                            Pending Review
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="flex items-center gap-1.5 px-4 py-2 bg-white/80 border border-white rounded-xl text-[12px] font-bold uppercase tracking-widest text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-all shadow-sm hover:shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProperty(p);
                                setRejectReason("");
                                setForgotStep(1);
                              }}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 📱 Mobile Card Stack View */}
            <div className="md:hidden divide-y divide-border" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Loading queue...
                    </p>
                  </div>
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-5xl text-emerald-500/80">
                      task_alt
                    </span>
                    <p className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
                      Queue is clear
                    </p>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                      No pending properties require attention.
                    </p>
                  </div>
                </div>
              ) : (
                paginatedProperties.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProperty(p);
                      setRejectReason("");
                      setFraudNotes("");
                    }}
                    className={`p-4 space-y-3 cursor-pointer transition-all duration-300 ${selectedProperty?.id === p.id ? "bg-orange-50/40 ring-1 ring-inset ring-orange-200" : ""}`}
                    style={{ backgroundColor: "var(--surface)" }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white border border-border shadow-xs">
                        {p.media && p.media.length > 0 ? (
                          <img
                            src={p.media[0].thumbnail_url || p.media[0].image_url}
                            alt="Property"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">home</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-extrabold text-slate-900 capitalize" style={{ color: "var(--ink)" }}>
                            #{p.id} — {p.property_type}
                          </p>
                          {p.duplicate_of && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                              Duplicate
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] font-semibold mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {p.owner_name_display}
                        </p>
                        <p className="text-[13px] font-extrabold text-orange-600 mt-1">
                          ₹{parseFloat(p.price).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-dashed" style={{ borderColor: "var(--border)" }}>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span className="font-bold">Submitted: </span>
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50/80 text-amber-700 border border-amber-200/50">
                          Pending
                        </span>
                        
                        <button
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-border rounded-lg text-[10px] font-bold uppercase text-orange-600 shadow-xs hover:bg-orange-50 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProperty(p);
                            setRejectReason("");
                            setFraudNotes("");
                          }}
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && filteredProperties.length > 0 && (
          <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredProperties.length)}{" "}
              of {filteredProperties.length} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-white shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">
                  chevron_left
                </span>{" "}
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-white shadow-sm transition-all"
              >
                Next{" "}
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Detail Panel — slides in when a property is selected */}
        {selectedProperty && (
          <div ref={detailPanelRef} className="bg-white/70 backdrop-blur-3xl rounded-3xl border border-white/80 shadow-[0_16px_40px_rgb(0,0,0,0.08)] overflow-hidden mb-8 transform transition-all animate-in fade-in slide-in-from-bottom-8 relative z-20">
            {/* Panel Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-6 sm:px-8 border-b border-white/60 bg-white/40 relative">
              {/* Left Side: Property ID & Submitter */}
              <div className="space-y-1.5 w-full pr-10 sm:pr-0">
                <h2 className="text-[18px] font-extrabold text-slate-900 drop-shadow-sm flex flex-wrap items-center gap-2">
                  Property #{selectedProperty.id}
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-slate-200 text-slate-700 border border-slate-300">
                    Source: {selectedProperty.added_by || 'Unknown'}
                  </span>
                </h2>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-normal">
                  Submitted by Agent ID: {selectedProperty.agent || 'N/A (Self-Listed)'}
                </p>
              </div>
              
              {/* Close button absolute-positioned on mobile, standard flex on desktop */}
              <div className="absolute right-4 top-4 sm:relative sm:right-0 sm:top-0">
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="w-9 h-9 rounded-xl bg-white/80 border border-white shadow-sm flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all hover:scale-105 hover:shadow-md group cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">
                    close
                  </span>
                </button>
              </div>

              {/* Price and Type Info */}
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-200/50 sm:border-t-0">
                <div className="text-left sm:text-right">
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight drop-shadow-sm">
                    ₹{parseFloat(selectedProperty.price).toLocaleString()}
                  </p>
                  <p className="text-[11px] font-extrabold text-orange-600 uppercase tracking-widest mt-0.5">
                    {selectedProperty.property_type}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8 bg-white/20">
              {/* Duplicate Warning */}
              {selectedProperty.duplicate_of && (
                <div className="p-5 bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 text-amber-800 rounded-2xl flex items-start gap-4 shadow-sm animate-pulse">
                  <span className="material-symbols-outlined text-amber-600 text-[28px]">
                    warning
                  </span>
                  <div>
                    <p className="text-[14px] font-extrabold tracking-tight">
                      Possible Duplicate Warning
                    </p>
                    <p className="text-[13px] font-medium mt-1">
                      This listing shares identical characteristics and is a
                      likely duplicate of property #
                      {selectedProperty.duplicate_of}.
                    </p>
                  </div>
                </div>
              )}

              {/* Owner & Consent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      person
                    </span>{" "}
                    Owner Details
                  </h3>
                  <div className="space-y-4">
                    <p className="text-[14px] text-slate-900 font-bold">
                      <span className="text-slate-500 font-medium inline-block w-20">
                        Name:
                      </span>{" "}
                      {selectedProperty.owner_name_display}
                    </p>
                    <p className="text-[14px] text-slate-900 font-bold">
                      <span className="text-slate-500 font-medium inline-block w-20">
                        Phone:
                      </span>{" "}
                      {selectedProperty.owner_phone_display}
                    </p>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      verified_user
                    </span>{" "}
                    Consent Proof
                  </h3>
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    {(() => {
                      const url = selectedProperty.consent_proof_url;
                      if (!url) {
                        return (
                          <span className="text-[13px] font-bold text-slate-400">
                            No Consent Proof
                          </span>
                        );
                      }

                      const isDataImage = url.startsWith("data:image");
                      const isImageFile =
                        isDataImage ||
                        url.startsWith("http") ||
                        url.startsWith("/media") ||
                        /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);

                      if (isImageFile) {
                        const isSignature =
                          isDataImage ||
                          url.toLowerCase().includes("sig") ||
                          url.toLowerCase().includes("signature") ||
                          selectedProperty.added_by === "self" ||
                          (selectedProperty.creator_info && selectedProperty.creator_info.role === "owner");

                        return (
                          <div className="flex flex-col items-center gap-3">
                            <div
                              onClick={() => setImageModalUrl(url)}
                              className="relative group cursor-pointer"
                            >
                              <img
                                src={url}
                                alt={
                                  isSignature
                                    ? "Owner Digital Signature"
                                    : "Owner Verification Photo"
                                }
                                className="max-h-24 max-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-sm group-hover:scale-105 transition-transform object-contain"
                              />
                              <div className="absolute inset-0 bg-slate-900/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl font-bold text-[11px] uppercase tracking-wider transition-opacity gap-1 backdrop-blur-[2px]">
                                <span className="material-symbols-outlined text-[18px]">
                                  zoom_in
                                </span>
                                View Full
                              </div>
                            </div>
                            <span className="text-[12px] font-extrabold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full shadow-sm">
                              <span className="material-symbols-outlined text-[16px]">
                                {isSignature ? "draw" : "photo_camera"}
                              </span>
                              {isSignature
                                ? "Digital Signature Verified"
                                : "Photo Verified"}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <span className="text-[13px] font-bold text-emerald-700 flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-5 py-2.5 rounded-xl shadow-sm">
                          <span className="material-symbols-outlined text-[20px]">
                            verified
                          </span>
                          OTP Verified
                        </span>
                      );
                    })()}

                    {selectedProperty.ownership_document && (
                      <a href={selectedProperty.ownership_document} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        View Ownership Document
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedProperty.description && (
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      description
                    </span>{" "}
                    Description
                  </h3>
                  <p className="text-[14px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedProperty.description}
                  </p>
                </div>
              )}

              {/* Photos & Map */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      photo_library
                    </span>{" "}
                    Photo Gallery
                  </h3>
                  {selectedProperty.media &&
                  selectedProperty.media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedProperty.media.map((m) => (
                        <div key={m.id} className="relative group overflow-hidden rounded-xl border border-white shadow-sm">
                          <img
                            src={m.image_url}
                            alt="Property"
                            className="w-full h-36 object-cover hover:scale-105 transition-transform duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(m.id)}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center justify-center shadow-md transition-all hover:scale-110 opacity-100 sm:opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                            title="Delete Photo"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/40 border border-dashed border-slate-300 p-8 text-center text-slate-400 rounded-xl flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[40px]">
                        image_not_supported
                      </span>
                      <span className="text-[12px] font-bold uppercase tracking-widest">
                        No photos provided
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      map
                    </span>{" "}
                    Exact Location
                  </h3>
                  {selectedProperty.display_lat &&
                  selectedProperty.display_lng ? (
                    <div className="h-64 rounded-xl overflow-hidden border border-white shadow-inner relative z-0">
                      <MapContainer
                        center={[
                          selectedProperty.display_lat,
                          selectedProperty.display_lng,
                        ]}
                        zoom={15}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker
                          position={[
                            selectedProperty.display_lat,
                            selectedProperty.display_lng,
                          ]}
                        />
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="bg-white/40 border border-dashed border-slate-300 p-8 text-center text-slate-400 rounded-xl flex flex-col items-center justify-center gap-3 h-64">
                      <span className="material-symbols-outlined text-[40px]">
                        location_off
                      </span>
                      <span className="text-[12px] font-bold uppercase tracking-widest">
                        No location provided
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Moderation Actions */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <h3 className="text-[13px] font-extrabold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-600 text-[20px]">
                    admin_panel_settings
                  </span>
                  Moderation Actions
                </h3>
                <div className="space-y-6">
                  {/* Approve */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction("approve")}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white text-[14px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      check_circle
                    </span>
                    {actionLoading ? "Processing..." : "Approve & Set Live"}
                  </button>

                  {/* Reject */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors">
                        edit_note
                      </span>
                      <input
                        type="text"
                        placeholder="Reason for rejection (mandatory)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border border-white shadow-sm rounded-xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 text-[13px] font-medium text-slate-900 transition-all"
                      />
                    </div>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleAction("reject")}
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 hover:shadow-red-600/40 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        close
                      </span>
                      Reject
                    </button>
                  </div>

                  {/* Fraud Flag */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200/50">
                    <div className="flex-1 relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
                        edit_note
                      </span>
                      <input
                        type="text"
                        placeholder="Fraud flag notes (mandatory)"
                        value={fraudNotes}
                        onChange={(e) => setFraudNotes(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border border-white shadow-sm rounded-xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-[13px] font-medium text-slate-900 transition-all"
                      />
                    </div>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleAction("flag_fraud")}
                      className="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 hover:shadow-amber-600/40 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        flag
                      </span>
                      Flag Fraud
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {imageModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setImageModalUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-4 border-b border-slate-800 mb-4 gap-4">
              <span className="text-white font-extrabold text-[15px] flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">verified</span>
                Consent Proof Verification
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={imageModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 border border-slate-700"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Open New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setImageModalUrl(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="w-full flex items-center justify-center overflow-auto max-h-[72vh] p-2 bg-slate-950/50 rounded-2xl border border-slate-800/50">
              <img
                src={imageModalUrl}
                alt="Verification Proof Full View"
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
