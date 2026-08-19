import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const MySavedSearches = () => {
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSearches();
  }, []);

  const fetchSearches = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/saved-searches/`,
        { credentials: "include" }
      );
      if (res.ok) {
        setSearches(await res.json());
      } else {
        if (res.status === 401 || res.status === 403) {
          setError("AUTH_REQUIRED");
        } else {
          setError("SERVER_ERROR");
        }
      }
    } catch (e) {
      setError("SERVER_ERROR");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/saved-searches/${id}/`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
        toast.success("Saved search alert deleted successfully");
      } else {
        toast.error("Failed to delete saved search");
      }
    } catch (e) {
      toast.error("Network error deleting search");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRunSearch = (search) => {
    const params = new URLSearchParams();
    if (search.city) params.append("city_id", search.city);
    if (search.locality) params.append("locality", search.locality);
    if (search.property_type) params.append("property_type", search.property_type);
    if (search.min_price) params.append("min_price", search.min_price);
    if (search.max_price) params.append("max_price", search.max_price);
    navigate(`/?${params.toString()}`);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--ink)",
        minHeight: "100vh",
      }}
      className="font-sans transition-colors duration-300 py-10 px-4 md:px-10"
    >
      <main className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div
          className="mb-10 pb-8 border-b flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest mb-3 border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                color: "var(--accent)"
              }}
            >
              <span className="material-symbols-outlined text-[15px]">notifications_active</span>
              Property Alert Filters
            </span>
            <h1
              className="font-display font-extrabold leading-tight tracking-tight"
              style={{ fontSize: "clamp(24px, 3.5vw, 34px)", color: "var(--ink)" }}
            >
              Saved Searches
            </h1>
          </div>

          {!loading && !error && (
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="h-11 px-5 rounded-xl text-[13px] font-extrabold flex items-center gap-2 border transition-all hover:opacity-90"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                Create New Search Alert
              </Link>

              <div
                className="px-6 py-3 rounded-xl border flex items-center gap-3 shrink-0"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--accent)" }}>
                  bookmark_heart
                </span>
                <div>
                  <p className="font-extrabold text-[20px] leading-none" style={{ color: "var(--ink)" }}>
                    {searches.length}
                  </p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Active Alerts
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-3xl p-6 border animate-pulse flex flex-col gap-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-1/2 h-6 rounded-lg" style={{ backgroundColor: "var(--border)" }} />
                <div className="w-1/3 h-4 rounded-lg" style={{ backgroundColor: "var(--border)" }} />
                <div className="flex gap-2 mt-4">
                  <div className="w-20 h-6 rounded-md" style={{ backgroundColor: "var(--border)" }} />
                  <div className="w-24 h-6 rounded-md" style={{ backgroundColor: "var(--border)" }} />
                </div>
                <div className="w-full h-10 rounded-xl mt-6" style={{ backgroundColor: "var(--border)" }} />
              </div>
            ))}
          </div>
        ) : error === "AUTH_REQUIRED" ? (
          /* Authentication Required State */
          <div
            className="flex flex-col items-center justify-center py-20 px-6 rounded-3xl border text-center max-w-2xl mx-auto shadow-sm"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent)"
              }}
            >
              <span className="material-symbols-outlined text-[36px]">bookmark_border</span>
            </div>
            <h2 className="font-display font-extrabold text-[28px] mb-3" style={{ color: "var(--ink)" }}>
              Sign In to View Saved Searches
            </h2>
            <p className="text-[14px] leading-relaxed max-w-md mb-8" style={{ color: "var(--text-muted)" }}>
              Access your custom property search alerts, receive instant WhatsApp and email notifications for new listings in Hubli & Dharwad.
            </p>
            <Link
              to="/login"
              className="h-12 px-8 rounded-xl text-[14px] font-extrabold flex items-center gap-2 transition-all hover:opacity-90 shadow-md"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--btn-text, #ffffff)",
              }}
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              Sign In with OTP
            </Link>
          </div>
        ) : error === "SERVER_ERROR" ? (
          /* Server Error State */
          <div
            className="flex flex-col items-center justify-center py-20 px-6 rounded-3xl border text-center max-w-2xl mx-auto"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <span className="material-symbols-outlined text-[48px] mb-4" style={{ color: "var(--danger)" }}>
              error_outline
            </span>
            <h2 className="font-display font-extrabold text-[24px] mb-2" style={{ color: "var(--ink)" }}>
              Unable to Load Saved Searches
            </h2>
            <p className="text-[14px] mb-6" style={{ color: "var(--text-muted)" }}>
              There was a problem loading your alerts. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-6 rounded-xl text-[13px] font-extrabold flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: "var(--ink)", color: "var(--surface)" }}
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Retry
            </button>
          </div>
        ) : searches.length === 0 ? (
          /* Empty Saved Searches State */
          <div
            className="flex flex-col items-center justify-center py-24 px-6 rounded-3xl border text-center max-w-2xl mx-auto"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent)"
              }}
            >
              <span className="material-symbols-outlined text-[36px]">bookmark_add</span>
            </div>
            <h2 className="font-display font-extrabold text-[28px] mb-3" style={{ color: "var(--ink)" }}>
              No Saved Searches Yet
            </h2>
            <p className="text-[14px] max-w-md mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Save search filters on the home page to get instant automated alerts whenever matching zero-brokerage properties are listed in Hubli & Dharwad.
            </p>
            <Link
              to="/"
              className="h-12 px-8 rounded-xl text-[14px] font-extrabold flex items-center gap-2 shadow-md transition-all hover:opacity-90"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--btn-text, #ffffff)",
              }}
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
              Set Up First Search Alert
            </Link>
          </div>
        ) : (
          /* Saved Searches Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {searches.map((search) => {
              const minPrice = search.min_price ? `₹${(search.min_price / 1000).toFixed(0)}k` : null;
              const maxPrice = search.max_price ? `₹${(search.max_price / 1000).toFixed(0)}k` : null;
              const priceText = minPrice && maxPrice ? `${minPrice} – ${maxPrice} /mo` : minPrice ? `From ${minPrice}` : maxPrice ? `Up to ${maxPrice}` : "Any Price Range";

              return (
                <div
                  key={search.id}
                  className="group rounded-3xl p-6 border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl relative"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div>
                    {/* Header with location & delete button */}
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div className="flex items-start gap-2.5 overflow-hidden">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                            color: "var(--accent)"
                          }}
                        >
                          <span className="material-symbols-outlined text-[20px]">location_on</span>
                        </div>
                        <div className="truncate">
                          <h3 className="font-extrabold text-[20px] leading-snug truncate" style={{ color: "var(--ink)" }}>
                            {search.city_name || "Hubli & Dharwad"}
                          </h3>
                          {search.locality_name && (
                            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-muted)" }}>
                              {search.locality_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        disabled={deletingId === search.id}
                        onClick={() => handleDelete(search.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer border hover:border-red-500/30"
                        style={{
                          backgroundColor: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--text-muted)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--danger)";
                          e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--danger) 10%, transparent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                          e.currentTarget.style.backgroundColor = "var(--bg)";
                        }}
                        title="Delete saved search"
                      >
                        {deletingId === search.id ? (
                          <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        )}
                      </button>
                    </div>

                    {/* Filter Badges */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {search.property_type && (
                        <span
                          className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                            borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                            color: "var(--accent)",
                          }}
                        >
                          {search.property_type}
                        </span>
                      )}

                      <span
                        className="px-3 py-1 rounded-full text-[11px] font-extrabold border"
                        style={{
                          backgroundColor: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--ink)",
                        }}
                      >
                        🏷️ {priceText}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div>
                    {/* Active Alert Banner Indicator */}
                    <div
                      className="p-3 rounded-2xl border mb-4 flex items-center justify-between gap-2 text-[12px] font-semibold"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)",
                        borderColor: "color-mix(in srgb, var(--success) 25%, transparent)",
                        color: "var(--success)"
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--success)" }} />
                        <span>Instant Alerts Active</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                    </div>

                    <button
                      onClick={() => handleRunSearch(search)}
                      className="w-full h-11 rounded-xl text-[13px] font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:opacity-90"
                      style={{
                        backgroundColor: "var(--ink)",
                        color: "var(--surface)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                      Run Search & View Listings
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
