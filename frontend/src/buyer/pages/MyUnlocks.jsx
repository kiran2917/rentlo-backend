import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getWhatsAppShareLink, getGoogleMapsLink } from "../../shared/qrCodeUtils";
import { Translate } from "../../shared/components/Translate";

export const MyUnlocks = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [unlocksRes, subRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/my-unlocks/`, { credentials: "include" }),
          fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" })
        ]);

        if (unlocksRes.ok) {
          setProperties(await unlocksRes.json());
        } else {
          if (unlocksRes.status === 401 || unlocksRes.status === 403) {
            setError("AUTH_REQUIRED");
          } else {
            setError("SERVER_ERROR");
          }
        }

        if (subRes.ok) {
          setSubscription(await subRes.json());
        }
      } catch (err) {
        setError("SERVER_ERROR");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProperties = properties.filter((item) => {
    const prop = item.property || item;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const title = (prop.title || "").toLowerCase();
    const locality = (prop.locality_details?.name || "").toLowerCase();
    const city = (prop.locality_details?.city_name || "").toLowerCase();
    const owner = (prop.owner_name_display || prop.owner_name || "").toLowerCase();
    const type = (prop.property_type || "").toLowerCase();
    return title.includes(q) || locality.includes(q) || city.includes(q) || owner.includes(q) || type.includes(q);
  });

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
        {/* Active Subscription Banner */}
        {subscription && (
          <div
            className="mb-8 p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                  color: "var(--accent)"
                }}
              >
                <span className="material-symbols-outlined text-[26px]">key</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-[16px]" style={{ color: "var(--ink)" }}>
                    {subscription.has_active_pass ? `Active Pass: ${subscription.pass_type ? subscription.pass_type.replace('_', ' ').toUpperCase() : 'Pass Active'}` : "No Active Unlock Pass"}
                  </h3>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider"
                    style={
                      subscription.has_active_pass
                        ? { backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                        : { backgroundColor: "color-mix(in srgb, var(--text-muted) 15%, transparent)", color: "var(--text-muted)" }
                    }
                  >
                    {subscription.has_active_pass ? "Active" : "Expired / Inactive"}
                  </span>
                </div>
                <p className="text-[13px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {subscription.has_active_pass
                    ? `⚡ ${subscription.credits_remaining} Unlock Credits Remaining · 📜 ${subscription.agreement_credits_remaining || 0} Free Lease Agreements`
                    : "Buy a credit pack to unlock direct owner contact info with Zero Brokerage."}
                </p>
              </div>
            </div>

            <Link
              to="/pricing"
              className="px-5 py-2.5 rounded-xl text-[13px] font-extrabold flex items-center gap-2 transition-all hover:opacity-90 shrink-0"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--btn-text, #ffffff)"
              }}
            >
              <span className="material-symbols-outlined text-[18px]">add_card</span>
              {subscription.has_active_pass ? "Buy More Credits" : "Get Unlock Pass"}
            </Link>
          </div>
        )}

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
              <span className="material-symbols-outlined text-[15px]">folder_special</span>
              Your Unlocked Portfolio
            </span>
            <h1
              className="font-display font-extrabold leading-tight tracking-tight"
              style={{ fontSize: "clamp(24px, 3.5vw, 34px)", color: "var(--ink)" }}
            >
              My Unlocks
            </h1>
          </div>

          {!loading && !error && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Search filter input */}
              {properties.length > 0 && (
                <div className="relative min-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: "var(--text-muted)" }}>
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search unlocks by locality, city, owner..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl text-[13px] font-medium border outline-none transition-all"
                    style={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--ink)"
                    }}
                  />
                </div>
              )}

              <div
                className="px-6 py-3 rounded-xl border flex items-center gap-3 shrink-0"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--accent)" }}>
                  verified_user
                </span>
                <div>
                  <p className="font-extrabold text-[20px] leading-none" style={{ color: "var(--ink)" }}>
                    {properties.length}
                  </p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Properties Unlocked
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-3xl p-5 border animate-pulse flex flex-col gap-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-full h-48 rounded-2xl" style={{ backgroundColor: "var(--border)" }} />
                <div className="w-3/4 h-6 rounded-lg" style={{ backgroundColor: "var(--border)" }} />
                <div className="w-1/2 h-4 rounded-lg" style={{ backgroundColor: "var(--border)" }} />
                <div className="w-full h-10 rounded-xl mt-4" style={{ backgroundColor: "var(--border)" }} />
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
              <span className="material-symbols-outlined text-[36px]">lock</span>
            </div>
            <h2 className="font-display font-extrabold text-[28px] mb-3" style={{ color: "var(--ink)" }}>
              Sign In to Access Your Unlocked Properties
            </h2>
            <p className="text-[14px] leading-relaxed max-w-md mb-8" style={{ color: "var(--text-muted)" }}>
              View verified direct owner phone numbers, WhatsApp contact links, exact Google Maps locations, and rental agreements for all properties you have unlocked.
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
              Unable to Load Unlocks
            </h2>
            <p className="text-[14px] mb-6" style={{ color: "var(--text-muted)" }}>
              There was a problem loading your portfolio. Please check your network connection and try again.
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
        ) : properties.length === 0 ? (
          /* Empty Unlocks State */
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
              <span className="material-symbols-outlined text-[36px]">key_off</span>
            </div>
            <h2 className="font-display font-extrabold text-[28px] mb-3" style={{ color: "var(--ink)" }}>
              No Properties Unlocked Yet
            </h2>
            <p className="text-[14px] max-w-md mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              When you unlock a property listing, direct owner contact details, WhatsApp links, exact maps, and legal lease templates will appear here instantly.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/"
                className="h-12 px-7 rounded-xl text-[14px] font-extrabold flex items-center gap-2 shadow-md transition-all hover:opacity-90"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--btn-text, #ffffff)",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
                Browse Properties
              </Link>
              <Link
                to="/pricing"
                className="h-12 px-7 rounded-xl text-[14px] font-extrabold flex items-center gap-2 border transition-all hover:opacity-90"
                style={{
                  backgroundColor: "var(--bg)",
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">sell</span>
                View Unlock Passes
              </Link>
            </div>
          </div>
        ) : (
          /* Unlocked Properties Grid */
          <div>
            {filteredProperties.length === 0 ? (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[40px] mb-2 opacity-50">search_off</span>
                <p className="text-[15px] font-semibold">No unlocks found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProperties.map((item, i) => {
                  const prop = item.property || item;
                  const ownerName = prop.owner_name_display || prop.owner_name || "Verified Owner";
                  const ownerPhone = prop.owner_phone_display || prop.owner_phone || "";
                  const priceFormatted = parseFloat(prop.price) ? `₹${parseFloat(prop.price).toLocaleString("en-IN")}` : "Price on Request";

                  return (
                    <div
                      key={item.id || prop.id || i}
                      className="group rounded-3xl overflow-hidden border flex flex-col transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl"
                      style={{
                        backgroundColor: "var(--surface)",
                        borderColor: "var(--border)",
                      }}
                    >
                      {/* Property Image Header */}
                      <div className="relative h-52 overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                        {prop.media?.length > 0 ? (
                          <img
                            src={prop.media[0].thumbnail_url || prop.media[0].image_url}
                            alt={prop.title || "Property"}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}>
                            <span className="material-symbols-outlined text-[48px] opacity-40">apartment</span>
                            <span className="text-[12px] font-semibold">No Preview Image</span>
                          </div>
                        )}

                        {/* Unlocked Badge */}
                        <div
                          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-md backdrop-blur-md"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--success) 90%, black)",
                            color: "#ffffff",
                          }}
                        >
                          <span className="material-symbols-outlined text-[14px]">lock_open</span>
                          Unlocked & Verified
                        </div>

                        {/* Property Type Badge */}
                        {prop.property_type && (
                          <div
                            className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-md backdrop-blur-md"
                            style={{
                              backgroundColor: "rgba(15, 23, 42, 0.85)",
                              color: "#ffffff",
                            }}
                          >
                            {prop.property_type}
                          </div>
                        )}
                      </div>

                      {/* Content Body */}
                      <div className="p-6 flex flex-col flex-grow">
                        {/* Price & Location */}
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="font-extrabold text-[28px] leading-tight" style={{ color: "var(--ink)" }}>
                              {priceFormatted}
                            </span>
                            {prop.price && <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>/month</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px] font-medium truncate" style={{ color: "var(--text-muted)" }}>
                            <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--accent)" }}>location_on</span>
                            <span className="truncate">
                              <Translate>
                                {prop.locality_details
                                  ? `${prop.locality_details.name}, ${prop.locality_details.city_name}`
                                  : prop.display_address || "Hubli-Dharwad"}
                              </Translate>
                            </span>
                          </div>
                        </div>

                        {/* Owner Details Card (Unlocked Info) */}
                        <div
                          className="p-4 rounded-2xl border mb-5 flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
                            borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-extrabold text-[15px]"
                              style={{
                                backgroundColor: "var(--accent)",
                                color: "var(--btn-text, #ffffff)"
                              }}
                            >
                              {ownerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <p className="font-extrabold text-[13px] truncate" style={{ color: "var(--ink)" }}>
                                  {ownerName}
                                </p>
                                <span className="material-symbols-outlined text-[14px] text-emerald-600" title="Verified Owner">check_circle</span>
                              </div>
                              <p className="text-[12px] font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                                {ownerPhone || "Contact Direct"}
                              </p>
                            </div>
                          </div>

                          {ownerPhone && (
                            <a
                              href={`tel:${ownerPhone}`}
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-105"
                              style={{ backgroundColor: "var(--accent)", color: "#ffffff" }}
                              title="Call Owner"
                            >
                              <span className="material-symbols-outlined text-[18px]">call</span>
                            </a>
                          )}
                        </div>

                        {/* Quick Contact & Navigation Action Buttons */}
                        <div className="grid grid-cols-2 gap-2.5 mb-4">
                          <a
                            href={getWhatsAppShareLink(ownerPhone, ownerName, prop.property_type, prop.locality_details?.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90 shadow-sm"
                            style={{ backgroundColor: "#25D366" }}
                          >
                            <span className="material-symbols-outlined text-[17px]">chat</span>
                            WhatsApp
                          </a>

                          <a
                            href={getGoogleMapsLink(prop.display_lat || prop.exact_lat, prop.display_lng || prop.exact_lng, prop.display_address || prop.exact_address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-extrabold transition-opacity hover:opacity-90 border"
                            style={{
                              backgroundColor: "color-mix(in srgb, #4285F4 12%, transparent)",
                              borderColor: "color-mix(in srgb, #4285F4 30%, transparent)",
                              color: "#1a73e8"
                            }}
                          >
                            <span className="material-symbols-outlined text-[17px]">directions</span>
                            Maps Pin
                          </a>
                        </div>

                        {/* Lease Agreement & Details Footer */}
                        <div className="mt-auto pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                          <Link
                            to={`/lease-agreement?property_id=${prop.id}`}
                            className="flex-1 h-10 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-extrabold transition-all hover:opacity-90"
                            style={{
                              backgroundColor: "var(--bg)",
                              borderColor: "var(--border)",
                              color: "var(--ink)",
                            }}
                          >
                            <span className="material-symbols-outlined text-[15px]" style={{ color: "var(--accent)" }}>description</span>
                            Lease Agreement
                          </Link>

                          <Link
                            to={`/property/${prop.id}`}
                            className="h-10 px-4 rounded-xl flex items-center justify-center gap-1 text-[12px] font-extrabold transition-all hover:opacity-90"
                            style={{
                              backgroundColor: "var(--ink)",
                              color: "var(--surface)",
                            }}
                          >
                            View
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
