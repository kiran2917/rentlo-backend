import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { SeoHead } from "../../shared/components/SeoHead";

export const CitySeoLanding = () => {
  const { cityName } = useParams();
  const formattedCity = cityName
    ? cityName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "India";

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/properties/public/?search=${encodeURIComponent(formattedCity)}`)
      .then((res) => res.json())
      .then((data) => {
        setProperties(data.results || data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [cityName, formattedCity]);

  // Schema.org FAQ & Breadcrumb
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://rentlo.in/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": `Properties in ${formattedCity}`,
          "item": `https://rentlo.in/rent-in-${cityName}`
        }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": `How do I find zero-brokerage flats for rent in ${formattedCity}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Rentlo offers 100% verified properties in ${formattedCity} listed directly by property owners. Browse listings, filter by locality or budget, and unlock owner contact numbers without paying broker fees.`
          }
        },
        {
          "@type": "Question",
          "name": `What is the cost of renting a 2BHK flat in ${formattedCity} on Rentlo?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Rental prices in ${formattedCity} range from budget 1BHKs to luxury 3BHK apartments. Rentlo lets you view exact pricing set by owners with zero brokerage markup.`
          }
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <SeoHead
        title={`Zero Brokerage Flats for Rent in ${formattedCity} | Direct Owner Property — Rentlo`}
        description={`Find verified 1BHK, 2BHK, 3BHK flats, apartments, PGs, and commercial spaces for rent in ${formattedCity} directly from owners. Zero broker commission.`}
        keywords={`flats for rent in ${formattedCity}, house for rent ${formattedCity}, 2BHK rent ${formattedCity}, zero brokerage ${formattedCity}, no broker rental ${formattedCity}`}
        canonicalUrl={`https://rentlo.in/rent-in-${cityName}`}
        jsonLd={jsonLd}
      />

      {/* Hero Banner */}
      <section className="bg-slate-900 text-white py-16 px-4 md:px-10 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto text-center">
          {/* Breadcrumb */}
          <nav className="flex justify-center items-center gap-2 text-xs font-semibold text-slate-400 mb-4">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-emerald-400">Rent in {formattedCity}</span>
          </nav>

          <span className="inline-block px-3.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            Local SEO Landing Page • Zero Brokerage
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
            Flats &amp; Houses for Rent in <span className="text-emerald-400">{formattedCity}</span>
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-sm sm:text-base font-medium">
            Connect directly with verified property owners in {formattedCity}. Save thousands on broker commissions with Rentlo's direct unlock platform.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1400px] mx-auto px-4 md:px-10 pt-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Verified Properties in {formattedCity}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {properties.length} live listings available directly from owners
            </p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
          >
            Search All Cities →
          </Link>
        </div>

        {/* Property Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-600">Loading {formattedCity} listings...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">location_off</span>
            <h3 className="text-lg font-bold text-slate-800">No properties listed in {formattedCity} yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Be the first landlord to list a property in {formattedCity} and get instant direct tenant leads!
            </p>
            <Link
              to="/owner/login"
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-2xl text-xs shadow-lg"
            >
              List Your Property Free in {formattedCity}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col"
              >
                <div className="h-48 bg-slate-100 relative overflow-hidden">
                  <img
                    src={prop.media?.[0]?.medium_url || prop.media?.[0]?.image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80"}
                    alt={`${prop.title} - ${prop.property_type} in ${formattedCity}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-white/20">
                    {prop.property_type}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-emerald-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-md">
                    ₹{Number(prop.price).toLocaleString("en-IN")}/mo
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1 mb-1 group-hover:text-emerald-600 transition-colors">
                      {prop.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mb-3">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">location_on</span>
                      {prop.locality_name || formattedCity}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {prop.description}
                    </p>
                  </div>

                  <Link
                    to={`/property/${prop.id}`}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs text-center transition-all flex items-center justify-center gap-1.5"
                  >
                    View Details &amp; Contact Owner
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEO Content & FAQ Section */}
        <section className="mt-20 bg-white rounded-3xl border border-slate-200 p-8 sm:p-12">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
            Why Rent a Flat in {formattedCity} via Rentlo?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="material-symbols-outlined text-[28px] text-emerald-600 mb-2">money_off</span>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Zero Brokerage Fees</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect directly with landlords in {formattedCity}. Save 1 to 2 months of rent usually spent on middleman broker commissions.
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="material-symbols-outlined text-[28px] text-emerald-600 mb-2">verified_user</span>
              <h3 className="font-bold text-sm text-slate-900 mb-1">100% Verified Owners</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every property listed in {formattedCity} undergoes phone and ownership document check before going live.
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="material-symbols-outlined text-[28px] text-emerald-600 mb-2">bolt</span>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Instant Owner Contact</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Unlock phone numbers in 1-click using Rentlo single contact unlocks or buyer credit pass packs.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-4">Frequently Asked Questions (FAQs)</h3>
          <div className="space-y-4">
            <details className="group border border-slate-200 rounded-2xl p-4 [&_summary::-webkit-details-marker]:hidden cursor-pointer">
              <summary className="flex items-center justify-between font-bold text-sm text-slate-900">
                <span>How do I find zero-brokerage flats for rent in {formattedCity}?</span>
                <span className="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Rentlo offers 100% verified properties in {formattedCity} listed directly by property owners. Browse listings, filter by locality or budget, and unlock owner contact numbers without paying broker fees.
              </p>
            </details>
            <details className="group border border-slate-200 rounded-2xl p-4 [&_summary::-webkit-details-marker]:hidden cursor-pointer">
              <summary className="flex items-center justify-between font-bold text-sm text-slate-900">
                <span>What is the cost of renting a 2BHK flat in {formattedCity} on Rentlo?</span>
                <span className="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Rental prices in {formattedCity} range from budget 1BHKs to luxury 3BHK apartments. Rentlo lets you view exact pricing set by owners with zero brokerage markup.
              </p>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
};
