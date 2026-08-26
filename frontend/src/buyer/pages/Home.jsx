import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PropertyCard } from "../../shared/components/PropertyCard";
import { OtpModal } from "../components/OtpModal";
import { ComparisonModal } from "../components/ComparisonModal";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "../../shared/context/AuthContext";
import { SeoHead } from "../../shared/components/SeoHead";
import { toast } from "react-toastify";
import { STATE_CITY_DATA, MapFlyToHandler } from "../../shared/constants/locationData";
import { PropertyImageSlideshow } from "../../shared/components/PropertyImageSlideshow";
import { Translate } from "../../shared/components/Translate";


delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pointInPolygon = (point, vs) => {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};



const MapDrawEvents = ({ isDrawingMode, drawnPolygon, setDrawnPolygon }) => {
  useMapEvents({
    click(e) {
      if (!isDrawingMode) return;
      setDrawnPolygon([...drawnPolygon, [e.latlng.lat, e.latlng.lng]]);
    }
  });
  return null;
};

const PropertyCardSkeleton = () => (
  <div className="rounded-2xl overflow-hidden border shadow-sm flex flex-col h-full bg-white border-slate-200">
    <div className="aspect-[4/3] w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
    <div className="p-4 flex flex-col gap-4">
      <div className="h-7 w-1/2 rounded-lg bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
      <div className="h-4 w-3/4 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
        <div className="h-6 w-16 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
        <div className="h-6 w-16 rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] animate-shimmer"></div>
      </div>
    </div>
  </div>
);

const EmptyState = () => {
  const { t } = useTranslation();
  return (
    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center animate-fade-in bg-white rounded-card shadow-sm border border-slate-100">
      <div className="w-48 h-48 mb-6 relative">
        <svg viewBox="0 0 200 200" className="w-full h-full text-slate-50" fill="currentColor">
          <path d="M100,20 L20,100 L40,100 L40,180 L160,180 L160,100 L180,100 Z" />
        </svg>
        <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 text-[64px] bg-white rounded-full p-4 shadow-lg shadow-orange-500/20">search_off</span>
      </div>
      <h3 className="font-display text-3xl text-slate-900 font-bold mb-2">{t("home.noPropertiesFound", "No Properties Found")}</h3>
      <p className="text-slate-500 text-base max-w-md">{t("home.noPropertiesDesc", "Try adjusting your filters, searching a different area, or clearing your custom drawn boundary to discover more homes.")}</p>
    </div>
  );
};

export const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const gridRef = useRef(null);
  const isFirstRender = useRef(true);

  const [viewMode, setViewMode] = useState("grid");
  const [filters, setFilters] = useState({
    property_type: searchParams.get("property_type") || "",
    min_price: searchParams.get("min_price") || "",
    max_price: searchParams.get("max_price") || "",
    city_id: searchParams.get("city_id") || "",
    locality: searchParams.get("locality") || "",
    lat: searchParams.get("lat") || "",
    lng: searchParams.get("lng") || "",
    radius_km: searchParams.get("radius_km") || "",
  });

  const [cities, setCities] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState([]);
  const [selectedStateKey, setSelectedStateKey] = useState("karnataka");
  const [selectedCityId, setSelectedCityId] = useState("hubli");
  const [mapCenter, setMapCenter] = useState([15.3647, 75.1240]);
  const [mapZoom, setMapZoom] = useState(13);

  const [platformSettings, setPlatformSettings] = useState(null);

  const [showCustomPriceInputs, setShowCustomPriceInputs] = useState(
    Boolean(
      searchParams.get("min_price") || searchParams.get("max_price")
    )
  );

  const handleBudgetOptionChange = (value) => {
    if (value === "") {
      setFilters(prev => ({ ...prev, min_price: "", max_price: "" }));
      setShowCustomPriceInputs(false);
    } else if (value === "custom") {
      setShowCustomPriceInputs(true);
    } else {
      setShowCustomPriceInputs(false);
      const parts = value.split("-");
      const min = parts[0] || "";
      const max = parts[1] || "";
      setFilters(prev => ({ ...prev, min_price: min, max_price: max }));
    }
  };

  const getBudgetOptionValue = () => {
    if (showCustomPriceInputs) return "custom";
    const min = filters.min_price || "";
    const max = filters.max_price || "";
    if (!min && !max) return "";
    if (min === "1000" && max === "3000") return "1000-3000";
    if (min === "3000" && max === "7000") return "3000-7000";
    if (!min && max === "10000") return "-10000";
    if (!min && max === "15000") return "-15000";
    if (!min && max === "20000") return "-20000";
    if (!min && max === "30000") return "-30000";
    if (!min && max === "50000") return "-50000";
    if (!min && max === "75000") return "-75000";
    if (!min && max === "100000") return "-100000";
    return "custom";
  };

  // Computed properties
  const displayedProperties = properties.filter(prop => {
    if (drawnPolygon.length >= 3) {
      const pt = [prop.display_lat || prop.exact_lat, prop.display_lng || prop.exact_lng];
      if (!pt[0] || !pt[1]) return false;
      if (!pointInPolygon(pt, drawnPolygon)) return false;
    }

    return true;
  });

  const toggleCompare = (e, prop) => {
    e.preventDefault();
    e.stopPropagation();
    setCompareList(prev => {
      if (prev.find(p => p.id === prop.id)) {
        return prev.filter(p => p.id !== prop.id);
      }
      if (prev.length >= 3) {
        toast.error("You can compare up to 3 properties at a time.");
        return prev;
      }
      return [...prev, prop];
    });
  };

  // Scroll reveal
  useEffect(() => {
    if (viewMode !== "grid") return;

    const applyVisible = () => {
      const cards = gridRef.current?.querySelectorAll(".reveal") ?? [];
      cards.forEach((card) => {
        card.classList.add("visible");
      });
    };

    const timer = setTimeout(applyVisible, 30);

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.05 },
    );
    const cards = gridRef.current?.querySelectorAll(".reveal") ?? [];
    cards.forEach((card) => observer.observe(card));

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [properties, viewMode]);

  const handleSaveSearch = async (forceExecute = false) => {
    if (!filters.city_id) {
      toast.error("Please select a city first to save your search preferences.");
      return;
    }
    
    if (!user && !forceExecute) {
      setShowOtpModal(true);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/saved-searches/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: filters.city_id,
            locality: filters.locality || null,
            property_type: filters.property_type || null,
            min_price: filters.min_price || null,
            max_price: filters.max_price || null,
          }),
          credentials: "include",
        },
      );
      if (res.status === 401 || res.status === 403) {
        setShowOtpModal(true);
      } else if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_URL}/properties/cities/?has_properties=true`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const cityData = Array.isArray(data) ? data : [];
        setCities(cityData);
        if (cityData.length === 1 && !filters.city_id)
          setFilters((p) => ({ ...p, city_id: cityData[0].id.toString() }));
      })
      .catch(err => { if (err.name !== 'AbortError') console.error(err); });
      
    // Fetch platform settings
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setPlatformSettings(data); })
      .catch(err => { if (err.name !== 'AbortError') console.error(err); });
      
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const url = filters.city_id
      ? `${import.meta.env.VITE_API_URL}/properties/cities/${filters.city_id}/localities/?has_properties=true`
      : `${import.meta.env.VITE_API_URL}/properties/cities/localities/?has_properties=true`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setLocalities(Array.isArray(data) ? data : []))
      .catch(err => { if (err.name !== 'AbortError') console.error(err); });

    return () => controller.abort();
  }, [filters.city_id]);

  const fetchProperties = async (pageNum, f, append = false, signal = undefined) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: pageNum.toString() });
      if (f.property_type) q.append("property_type", f.property_type);
      if (f.min_price) q.append("min_price", f.min_price);
      if (f.max_price) q.append("max_price", f.max_price);
      if (f.city_id) q.append("city_id", f.city_id);
      if (f.locality) q.append("locality", f.locality);
      if (f.lat) q.append("lat", f.lat);
      if (f.lng) q.append("lng", f.lng);
      if (f.radius_km) q.append("radius_km", f.radius_km);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/public/?${q}`,
        { signal }
      );
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        setProperties((prev) =>
          append ? [...prev, ...results] : results,
        );
        setHasMore(data.next !== null);
      } else {
        toast.error("Unable to load properties. Please try again.");
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      if (!signal || !signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setPage(1);
    fetchProperties(1, filters, false, controller.signal);
    if (!isFirstRender.current) {
      const p = new URLSearchParams();
      if (filters.property_type) p.append("property_type", filters.property_type);
      if (filters.min_price) p.append("min_price", filters.min_price);
      if (filters.max_price) p.append("max_price", filters.max_price);
      // city_id is hidden from URL for security/cleanliness per user request
      // if (filters.city_id) p.append("city_id", filters.city_id);
      if (filters.locality) p.append("locality", filters.locality);
      if (filters.lat) p.append("lat", filters.lat);
      if (filters.lng) p.append("lng", filters.lng);
      if (filters.radius_km) p.append("radius_km", filters.radius_km);
      setSearchParams(p);
    } else {
      isFirstRender.current = false;
    }
    return () => controller.abort();
  }, [filters, setSearchParams]);

  const loadMore = () => {
    const n = page + 1;
    setPage(n);
    fetchProperties(n, filters, true);
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "city_id") next.locality = "";
      // If user manually changes city/locality, clear the radius search
      if (name === "city_id" || name === "locality") {
        next.lat = "";
        next.lng = "";
        // Do not clear radius_km so user can use distance radius around a city/locality
      }
      return next;
    });
  };

  const handleSearchNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFilters((prev) => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            radius_km: prev.radius_km || "5",
            city_id: "",
            locality: ""
          }));
        },
        (error) => {
          toast.error("Unable to detect location. Please check browser location permissions and try again.");
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser. Please select a city manually.");
    }
  };

  const selectedLocality = localities.find(
    (l) => l.id.toString() === filters.locality,
  )?.name;
  const propertyTypes = [
    "1bhk", "2bhk", "3bhk", "4bhk", "5bhk", "studio",
    "apartment", "house", "builder_floor", "pg", 
    "office", "retail", "warehouse", "coworking", "industrial"
  ];

  const selectStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    border: "1px solid var(--border)",
  };

  return (
    <div
      style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
      className="min-h-screen flex flex-col font-sans"
    >
      <SeoHead
        title="Rentlo — Zero-Brokerage Real Estate Platform | Direct Owner Contact"
        description="Search verified residential 1BHK, 2BHK, 3BHK flats, houses, PGs, and commercial properties directly from owners. Zero brokerage fees."
        keywords="Rentlo, zero brokerage rent, direct owner flat, 2BHK Bangalore, house for rent, commercial space rent"
      />
      <main className="flex-grow">
        {/* 100% Universal Screen Viewport-Fitted Edge-to-Edge Hero Section */}
        <section className="relative w-full overflow-hidden min-h-[85vh] md:min-h-[calc(100vh-72px)] flex items-center justify-center py-8 sm:py-12 md:py-16 px-4 sm:px-6 lg:px-8 transition-all duration-500">
          {/* Background Full-Width Photo Layer */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div
              className="w-full h-full bg-cover bg-center transition-all duration-700 scale-105"
              style={{
                backgroundImage: "var(--hero-img)",
                filter: "brightness(0.92) contrast(1.08) blur(4px)",
              }}
            />

            {/* Rich Dark Vignette Overlay for Crisp Photo Vibrancy & Text Legibility */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(11, 15, 25, 0.4) 0%, rgba(11, 15, 25, 0.7) 50%, #0B0F19 100%)",
                backdropFilter: "blur(2px)",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl mx-auto pt-4 pb-6 sm:py-8">
            {/* Main Headline */}
            <h1 className="font-display font-black leading-[1.15] sm:leading-[1.08] tracking-tight mb-2 sm:mb-3 text-white max-w-3xl text-2xl xs:text-[30px] sm:text-[46px] md:text-[58px] drop-shadow-md">
              Find your next{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-200 to-amber-200">
                perfect place
              </span>.
            </h1>

            {/* Subtitle */}
            <p className="text-[13px] sm:text-base md:text-lg font-medium mb-5 sm:mb-8 max-w-lg text-slate-300 leading-relaxed drop-shadow">
              Direct owner phone numbers • Transparent pricing • 0% Brokerage
            </p>

            {/* Glassmorphic Floating Search Card */}
            <div className="w-full max-w-4xl mx-auto rounded-3xl p-5 sm:p-7 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] text-left transition-all">
              
              {/* Primary Search Fields 2-Column Responsive Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* City */}
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 ml-0.5">
                    {t("home.city", "City")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px] pointer-events-none">location_on</span>
                    <select
                      value={filters.city_id}
                      onChange={(e) => handleFilterChange("city_id", e.target.value)}
                      className="w-full pl-8 sm:pl-9 pr-6 h-11 rounded-xl text-xs sm:text-sm font-extrabold appearance-none cursor-pointer outline-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-900 dark:text-white transition-all truncate"
                    >
                      <option value="">{t("home.anyCity", "Any City")}</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Locality */}
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 ml-0.5">
                    {t("home.localityLabel", "Locality")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px] pointer-events-none">my_location</span>
                    <select
                      value={filters.locality}
                      onChange={(e) => handleFilterChange("locality", e.target.value)}
                      className="w-full pl-8 sm:pl-9 pr-6 h-11 rounded-xl text-xs sm:text-sm font-extrabold appearance-none cursor-pointer outline-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-900 dark:text-white transition-all truncate"
                    >
                      <option value="">{t("home.anyLocality", "Any Locality")}</option>
                      {localities.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Property Type */}
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 ml-0.5">
                    {t("home.type", "Type")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px] pointer-events-none">home_work</span>
                    <select
                      value={filters.property_type}
                      onChange={(e) => handleFilterChange("property_type", e.target.value)}
                      className="w-full pl-8 sm:pl-9 pr-6 h-11 rounded-xl text-xs sm:text-sm font-extrabold appearance-none cursor-pointer outline-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-900 dark:text-white transition-all truncate"
                    >
                      <option value="">{t("home.anyType", "Any Type")}</option>
                      {propertyTypes.map((p) => (
                        <option key={p} value={p}>{t(`home.${p}`)}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Budget Range */}
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 ml-0.5">
                    {t("home.priceRange", "Budget Range")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px] pointer-events-none">payments</span>
                    <select
                      value={getBudgetOptionValue()}
                      onChange={(e) => handleBudgetOptionChange(e.target.value)}
                      className="w-full pl-8 sm:pl-9 pr-6 h-11 rounded-xl text-xs sm:text-sm font-extrabold appearance-none cursor-pointer outline-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-900 dark:text-white transition-all truncate"
                    >
                      <option value="">{t("home.anyBudget", "Any Budget")}</option>
                      <option value="1000-3000">{t("home.1kTo3k", "₹1k to ₹3k")}</option>
                      <option value="3000-7000">{t("home.3kTo7k", "₹3k to ₹7k")}</option>
                      <option value="-10000">{t("home.below10k", "Below ₹10k")}</option>
                      <option value="-15000">{t("home.below15k", "Below ₹15k")}</option>
                      <option value="-20000">{t("home.below20k", "Below ₹20k")}</option>
                      <option value="-30000">{t("home.below30k", "Below ₹30k")}</option>
                      <option value="-50000">{t("home.below50k", "Below ₹50k")}</option>
                      <option value="-75000">{t("home.below75k", "Below ₹75k")}</option>
                      <option value="-100000">{t("home.below1Lakh", "Below ₹1 Lakh")}</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Integrated GPS Location Radius Sub-Bar & Save Search */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSearchNearMe}
                    className={`h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[11px] font-extrabold transition-all border cursor-pointer active:scale-95 ${
                      filters.lat
                        ? "bg-slate-950 text-white border-slate-950 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">my_location</span>
                    <span>{filters.lat ? t("home.gpsActive", "GPS Active") : t("home.useMyLocation", "Near Me (GPS)")}</span>
                  </button>

                  <select
                    value={filters.radius_km}
                    onChange={(e) => handleFilterChange("radius_km", e.target.value)}
                    disabled={!filters.lat && !filters.city_id}
                    className="h-9 px-2.5 rounded-xl text-[11px] font-extrabold outline-none cursor-pointer disabled:opacity-40 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">{t("home.anyDistance", "Any Distance")}</option>
                    <option value="2">Within 2 km</option>
                    <option value="5">Within 5 km</option>
                    <option value="10">Within 10 km</option>
                    <option value="20">Within 20 km</option>
                  </select>
                </div>

                {/* Save Search Button */}
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-[11px] font-extrabold transition-all bg-slate-950 hover:bg-slate-900 text-white shadow-sm active:scale-95 cursor-pointer ml-auto"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {saveSuccess ? "bookmark_added" : "bookmark_add"}
                  </span>
                  <span>{saveSuccess ? t("home.saved", "Saved!") : t("home.saveSearch", "Save Search")}</span>
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* Listings */}
        <div className="max-w-[1600px] mx-auto w-full px-4 md:px-8 pt-8 pb-36 md:py-16">
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 pb-4 border-b"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <h2
              className="font-display font-black tracking-tight"
              style={{ fontSize: "clamp(22px,4vw,38px)", color: "var(--ink)" }}
            >
              {filters.lat 
                ? t("home.propertiesWithinRadius", { radius: filters.radius_km || 5 }, `Properties within ${filters.radius_km || 5}km`) 
                : (selectedLocality 
                    ? t("home.propertiesInLocality", { locality: selectedLocality }, `Properties in ${selectedLocality}`) 
                    : t("home.discoverProperties", "Discover Properties"))}
            </h2>

          {/* Floating Action Pill for Mobile Filters/Map */}
          <div className="md:hidden flex justify-center w-full mb-6 z-30 relative">
            <div 
              className="rounded-full px-3.5 py-1.5 flex items-center gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.2)]  backdrop-blur-xl transition-all"
              style={{ backgroundColor: "#000000", color: "#FFFFFF" }}
            >
              <button 
                onClick={() => setViewMode(viewMode === "grid" ? "map" : "grid")}
                className="flex items-center gap-1.5 text-xs font-extrabold active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {viewMode === "grid" ? "map" : "grid_view"}
                </span>
                {viewMode === "grid" ? "Map View" : "List View"}
              </button>
              <div className="w-[1px] h-3" style={{ backgroundColor: "var(--btn-text, #ffffff)", opacity: 0.3 }}></div>
              <button 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // Focus the first filter input to trigger mobile UI scroll
                  setTimeout(() => {
                    const firstFilter = document.querySelector('select[name="city_id"]');
                    if (firstFilter) firstFilter.focus();
                  }, 400);
                }}
                className="flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[15px]">tune</span>
                Filters
              </button>
            </div>
          </div>
            <div className="flex items-center gap-4">
              {/* Desktop Toggle Switch for View Mode */}
              <div className="hidden md:flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "map"
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">map</span>
                  Map
                </button>
              </div>

              <div className="flex flex-col items-end gap-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
                  {displayedProperties.length} {t("home.listingsCount", "listings")}
                </span>
              </div>
            </div>
          </div>

          {viewMode === "map" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN (5 Cols): Property List (Hidden on Mobile) */}
              <div className="hidden lg:flex lg:col-span-5 flex-col space-y-4 max-h-[750px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm sticky top-0 z-20 backdrop-blur-md">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-600 text-xl">map</span>
                      Listings in Map Area
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                      Showing {displayedProperties.length} property listing{displayedProperties.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {drawnPolygon.length > 0 && (
                    <span className="px-4 py-1 rounded-full text-xs font-extrabold bg-orange-100 text-orange-700 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">draw</span>
                      Custom Area
                    </span>
                  )}
                </div>

                {/* Property Cards List */}
                {displayedProperties.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center">
                    <span className="material-symbols-outlined text-slate-300 text-5xl mb-4">travel_explore</span>
                    <h4 className="font-extrabold text-slate-800 text-base">No properties in selected boundary</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Try using the "Draw Area" tool on the map to outline a broader neighborhood.
                    </p>
                  </div>
                ) : (
                  displayedProperties.map((prop) => (
                    <PropertyCard 
                      key={prop.id} 
                      prop={prop} 
                      layout="list" 
                      t={t} 
                    />
                  ))
                )}
              </div>

              {/* RIGHT COLUMN (7 Cols): Interactive Map */}
              <div className="lg:col-span-7 md:col-span-1 h-[520px] sm:h-[580px] md:h-[600px] lg:h-[750px] rounded-[24px] md:rounded-3xl overflow-hidden shadow-xl relative md:sticky md:top-24 border mb-32 md:mb-0" style={{ borderColor: "var(--border)" }}>
                {/* Top Floating Map Controls Bar with Both State and District Selection */}
                <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl pointer-events-auto">
                  {/* Both State & District Cascading Dropdowns */}
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    {/* 1. State Selector */}
                    <div className="relative flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition-all">
                      <span className="material-symbols-outlined text-slate-500 text-[16px] mr-1.5 pointer-events-none">map</span>
                      <select
                        value={selectedStateKey}
                        onChange={(e) => {
                          const stateKey = e.target.value;
                          setSelectedStateKey(stateKey);
                          const stateData = STATE_CITY_DATA[stateKey];
                          if (stateData) {
                            const firstCity = stateData.cities[0];
                            const newCityId = firstCity ? firstCity.id : "all";
                            setSelectedCityId(newCityId);
                            setMapCenter(firstCity ? firstCity.center : stateData.center);
                            setMapZoom(firstCity ? firstCity.zoom : stateData.zoom);
                          }
                        }}
                        className="w-full text-xs font-bold text-slate-800 bg-transparent appearance-none outline-none cursor-pointer truncate pr-4"
                      >
                        {Object.entries(STATE_CITY_DATA).map(([key, data]) => (
                          <option key={key} value={key}>
                            {data.name.replace(" (All 31 Districts)", "")}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-1.5 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>

                    {/* 2. District / City Selector */}
                    <div className="relative flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition-all">
                      <span className="material-symbols-outlined text-indigo-600 text-[16px] mr-1.5 pointer-events-none">location_on</span>
                      <select
                        value={selectedCityId}
                        onChange={(e) => {
                          const cityId = e.target.value;
                          setSelectedCityId(cityId);
                          const stateData = STATE_CITY_DATA[selectedStateKey];
                          if (stateData) {
                            if (cityId === "all") {
                              setMapCenter(stateData.center);
                              setMapZoom(stateData.zoom);
                            } else {
                              const matchCity = stateData.cities.find((c) => c.id === cityId);
                              if (matchCity) {
                                setMapCenter(matchCity.center);
                                setMapZoom(matchCity.zoom);
                              }
                            }
                          }
                        }}
                        className="w-full text-xs font-bold text-slate-800 bg-transparent appearance-none outline-none cursor-pointer truncate pr-4"
                      >
                        <option value="all">All Districts</option>
                        {STATE_CITY_DATA[selectedStateKey]?.cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-1.5 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  {/* Draw Area Action Buttons */}
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawingMode(!isDrawingMode);
                        if (isDrawingMode) setDrawnPolygon([]);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                        isDrawingMode
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isDrawingMode ? "close" : "polyline"}
                      </span>
                      <span>{isDrawingMode ? "Cancel" : "Draw Area"}</span>
                    </button>
                    {drawnPolygon.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawnPolygon([]);
                          setIsDrawingMode(false);
                        }}
                        className="px-2 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
                        title="Clear Custom Drawn Area"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    )}
                  </div>

                  {isDrawingMode && drawnPolygon.length < 3 && (
                    <div className="w-full bg-slate-900/90 backdrop-blur text-white text-[11px] font-medium py-1.5 px-3 rounded-lg text-center shadow-lg border border-white/10 mt-1">
                      Tap points on the map to outline your custom neighborhood boundary.
                    </div>
                  )}
                </div>

                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ width: "100%", height: "100%", zIndex: 0, cursor: isDrawingMode ? "crosshair" : "" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapFlyToHandler center={mapCenter} zoom={mapZoom} />
                  <MapDrawEvents
                    isDrawingMode={isDrawingMode}
                    drawnPolygon={drawnPolygon}
                    setDrawnPolygon={setDrawnPolygon}
                  />
                  {drawnPolygon.length > 0 && (
                    <Polygon
                      positions={drawnPolygon}
                      pathOptions={{
                        color: "#ea580c",
                        fillColor: "#ea580c",
                        fillOpacity: 0.25,
                        weight: 3,
                        dashArray: isDrawingMode ? "6, 6" : "",
                      }}
                    />
                  )}
                  {isDrawingMode &&
                    drawnPolygon.map((pt, i) => (
                      <Circle
                        key={i}
                        center={pt}
                        radius={30}
                        pathOptions={{ color: "#ea580c", fillColor: "#ea580c", fillOpacity: 1 }}
                      />
                    ))}
                  {filters.lat && filters.lng && (
                    <Circle
                      center={[filters.lat, filters.lng]}
                      radius={Number(filters.radius_km || 5) * 1000}
                      pathOptions={{ color: "#ea580c", fillColor: "#ea580c", fillOpacity: 0.15, weight: 2 }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          ) : (
            <div
              ref={gridRef}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
            >
            {loading && page === 1 ? (
              <>
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
              </>
            ) : properties.length === 0 ? (
              <EmptyState />
            ) : (
              displayedProperties.map((prop, i) => (
                <PropertyCard
                  key={prop.id}
                  prop={prop}
                  compareList={compareList}
                  toggleCompare={toggleCompare}
                  layout="grid"
                  t={t}
                />
              ))
            )}
            </div>
          )}

          

          {hasMore && (
            <div className="mt-12 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="h-12 px-8 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 border border-accent/30 text-accent hover:bg-accent hover:text-white cursor-pointer"
              >
                {loading ? "Loading…" : "Load More Properties"}
              </button>
            </div>
          )}
        </div>
      </main>

      {showOtpModal && (
        <OtpModal
          onSuccess={() => {
            setShowOtpModal(false);
            handleSaveSearch(true);
          }}
          onClose={() => setShowOtpModal(false)}
        />
      )}

      {compareList.length > 0 && (
        <div 
          className="fixed bottom-[90px] md:bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-4 px-6 py-3 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.2)] border animate-fade-in backdrop-blur-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--surface) 85%, transparent)", color: "var(--ink)", borderColor: "var(--border)" }}
        >
          <span className="font-extrabold text-xs tracking-widest uppercase opacity-70">{compareList.length} Selected</span>
          <button 
            onClick={() => setShowCompareModal(true)}
            className="px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-md active:scale-95"
            style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}
          >
            Compare Now
          </button>
          <button 
            onClick={() => setCompareList([])}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: "var(--ink)" }}
            title="Clear all"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
      
      {showCompareModal && (
        <ComparisonModal 
          properties={compareList} 
          onClose={() => setShowCompareModal(false)} 
          onRemove={(id) => setCompareList(prev => prev.filter(p => p.id !== id))} 
        />
      )}
    </div>
  );
};
