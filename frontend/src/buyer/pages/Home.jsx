import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  <div className="rounded-3xl overflow-hidden border shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 flex flex-col h-full bg-surface border-border">
    <div className="aspect-[4/3] w-full animate-pulse bg-surface-alt"></div>
    <div className="p-4 flex flex-col flex-grow justify-between gap-4">
      <div className="space-y-3">
        <div className="h-7 w-1/2 rounded-xl animate-pulse bg-surface-alt"></div>
        <div className="h-4 w-3/4 rounded-lg animate-pulse bg-surface-alt"></div>
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-lg animate-pulse bg-surface-alt"></div>
          <div className="h-6 w-16 rounded-lg animate-pulse bg-surface-alt"></div>
        </div>
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
      <h3 className="font-display text-[28px] text-slate-900 font-bold mb-2">{t("home.noPropertiesFound", "No Properties Found")}</h3>
      <p className="text-slate-500 text-[15px] max-w-md">{t("home.noPropertiesDesc", "Try adjusting your filters, searching a different area, or clearing your custom drawn boundary to discover more homes.")}</p>
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
        setCities(data);
        if (data.length === 1 && !filters.city_id)
          setFilters((p) => ({ ...p, city_id: data[0].id.toString() }));
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
      .then(setLocalities)
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
        setProperties((prev) =>
          append ? [...prev, ...data.results] : data.results,
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
      if (filters.city_id) p.append("city_id", filters.city_id);
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
        next.radius_km = "";
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
        <section className="relative w-full overflow-hidden min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-72px)] flex items-center justify-center py-6 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8 transition-all duration-500">
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
                  "linear-gradient(180deg, rgba(15, 23, 42, 0.65) 0%, rgba(15, 23, 42, 0.45) 50%, rgba(15, 23, 42, 0.70) 100%)",
                backdropFilter: "blur(3px)",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center w-full max-w-6xl mx-auto">
            {/* Main Headline */}
            <h1 className="font-display font-extrabold leading-[1.12] sm:leading-[1.08] tracking-tight mb-2 sm:mb-4 text-white max-w-4xl text-[28px] xs:text-[34px] sm:text-[50px] md:text-[64px] drop-shadow-md">
              {t("home.heroTitle", "Find your next perfect place.")}
            </h1>

            {/* Subtitle */}
            <p className="text-[14px] sm:text-[17px] md:text-[19px] font-medium mb-6 sm:mb-10 max-w-xl text-slate-100/95 leading-relaxed drop-shadow">
              {t("home.heroSubtitle", "Discover verified rental properties with transparent pricing and direct owner access.")}
            </p>

            {/* Glassmorphic Floating Search Card */}
            <div
              className="w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl text-left transition-all border glass-card shadow-card-hover"
            >
              {/* Primary Search Fields Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* City */}
                <div className="lg:col-span-2 flex flex-col gap-1 sm:gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest ml-1 text-slate-600">
                    {t("home.city", "City")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">location_on</span>
                    <select
                      value={filters.city_id}
                      onChange={(e) => handleFilterChange("city_id", e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold appearance-none cursor-pointer outline-none bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-900 transition-all"
                    >
                      <option value="">{t("home.anyCity", "Any City")}</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Locality */}
                <div className="lg:col-span-2 flex flex-col gap-1 sm:gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest ml-1 text-slate-600">
                    {t("home.localityLabel", "Locality")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">my_location</span>
                    <select
                      value={filters.locality}
                      onChange={(e) => handleFilterChange("locality", e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold appearance-none cursor-pointer outline-none bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-900 transition-all"
                    >
                      <option value="">{t("home.anyLocality", "Any Locality")}</option>
                      {localities.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Property Type */}
                <div className="lg:col-span-2 flex flex-col gap-1 sm:gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest ml-1 text-slate-600">
                    {t("home.type", "Type")}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">home_work</span>
                    <select
                      value={filters.property_type}
                      onChange={(e) => handleFilterChange("property_type", e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold appearance-none cursor-pointer outline-none bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-900 transition-all"
                    >
                      <option value="">{t("home.anyType", "Any Type")}</option>
                      {propertyTypes.map((p) => (
                        <option key={p} value={p}>{t(`home.${p}`)}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none text-slate-400">expand_more</span>
                  </div>
                </div>

                {/* Price Range / Budget */}
                <div className="lg:col-span-4 flex flex-col gap-1 sm:gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest ml-1 flex justify-between items-center text-slate-600">
                    <span>{t("home.priceRange", "Budget Range")}</span>
                    {showCustomPriceInputs && (
                      <button
                        type="button"
                        onClick={() => { setShowCustomPriceInputs(false); setFilters(prev => ({ ...prev, min_price: "", max_price: "" })); }}
                        className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">list</span>
                        {t("home.useDropdown", "Use Dropdown")}
                      </button>
                    )}
                  </label>

                  {showCustomPriceInputs ? (
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">payments</span>
                        <input
                          type="number"
                          placeholder={t("home.minPrice", "Min Price ₹")}
                          value={filters.min_price}
                          onChange={(e) => setFilters(prev => ({ ...prev, min_price: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold outline-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 text-slate-900 transition-all"
                        />
                      </div>
                      <span className="text-slate-400 font-extrabold text-[14px]">-</span>
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">payments</span>
                        <input
                          type="number"
                          placeholder={t("home.maxPrice", "Max Price ₹")}
                          value={filters.max_price}
                          onChange={(e) => setFilters(prev => ({ ...prev, max_price: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold outline-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 text-slate-900 transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none text-emerald-600">payments</span>
                      <select
                        value={getBudgetOptionValue()}
                        onChange={(e) => handleBudgetOptionChange(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 sm:py-3 h-11 sm:h-12 rounded-xl text-[12px] sm:text-[13px] font-bold appearance-none cursor-pointer outline-none bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-900 transition-all"
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
                        <option value="custom" style={{ fontWeight: "bold" }}>{t("home.customMinMax", "✏️ Custom Min - Max...")}</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none text-slate-400">expand_more</span>
                    </div>
                  )}
                </div>

                {/* Save Search Button */}
                <div className="lg:col-span-2 flex flex-col justify-end">
                  <button
                    onClick={handleSaveSearch}
                    className="h-11 sm:h-12 rounded-xl flex items-center justify-center gap-2 text-[12px] sm:text-[13px] font-extrabold transition-all duration-200 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {saveSuccess ? "bookmark_added" : "bookmark_add"}
                    </span>
                    {saveSuccess ? t("home.saved", "Saved!") : t("home.saveSearch", "Save Search")}
                  </button>
                </div>
              </div>

              {/* Integrated GPS Location Radius Sub-Bar */}
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{t("home.gpsFilter", "GPS Filter:")}</span>
                  <button
                    onClick={handleSearchNearMe}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold transition-all border cursor-pointer ${
                      filters.lat
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">my_location</span>
                    {filters.lat ? t("home.gpsActive", "GPS Active") : t("home.useMyLocation", "Use My Location")}
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{t("home.distanceRadius", "Distance Radius:")}</span>
                  <select
                    value={filters.radius_km}
                    onChange={(e) => handleFilterChange("radius_km", e.target.value)}
                    disabled={!filters.lat}
                    className="px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold outline-none cursor-pointer disabled:opacity-40 bg-slate-50 border border-slate-200 text-slate-900"
                  >
                    <option value="">{t("home.anyDistance", "Any Distance")}</option>
                    <option value="2">{t("home.within2km", "Within 2 km")}</option>
                    <option value="5">{t("home.within5km", "Within 5 km")}</option>
                    <option value="10">{t("home.within10km", "Within 10 km")}</option>
                    <option value="20">{t("home.within20km", "Within 20 km")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Listings */}
        <div className="max-w-[1600px] mx-auto w-full px-4 md:px-10 py-16">
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10 pb-5 border-b"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(22px,4vw,38px)", color: "var(--ink)" }}
            >
              {filters.lat 
                ? t("home.propertiesWithinRadius", { radius: filters.radius_km || 5 }, `Properties within ${filters.radius_km || 5}km`) 
                : (selectedLocality 
                    ? t("home.propertiesInLocality", { locality: selectedLocality }, `Properties in ${selectedLocality}`) 
                    : t("home.discoverProperties", "Discover Properties"))}
            </h2>
            <div className="flex flex-col items-end gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {displayedProperties.length} {t("home.listingsCount", "listings")}
              </span>
            </div>
          </div>

          {viewMode === "map" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN (5 Cols): Property List (Hidden on Mobile) */}
              <div className="hidden lg:flex lg:col-span-5 flex-col space-y-4 max-h-[750px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm sticky top-0 z-20 backdrop-blur-md">
                  <div>
                    <h3 className="font-extrabold text-[15px] text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-600 text-[20px]">map</span>
                      Listings in Map Area
                    </h3>
                    <p className="text-[12px] font-medium text-slate-500 mt-0.5">
                      Showing {displayedProperties.length} property listing{displayedProperties.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {drawnPolygon.length > 0 && (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-700 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">draw</span>
                      Custom Area
                    </span>
                  )}
                </div>

                {/* Property Cards List */}
                {displayedProperties.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center">
                    <span className="material-symbols-outlined text-slate-300 text-5xl mb-3">travel_explore</span>
                    <h4 className="font-extrabold text-slate-800 text-[15px]">No properties in selected boundary</h4>
                    <p className="text-[12px] text-slate-500 mt-1 max-w-xs">
                      Try using the "Draw Area" tool on the map to outline a broader neighborhood.
                    </p>
                  </div>
                ) : (
                  displayedProperties.map((prop) => (
                    <Link
                      key={prop.id}
                      to={`/property/${prop.id}`}
                      target="_blank"
                      className="group bg-white rounded-2xl p-3.5 border border-slate-200/80 hover:border-orange-400 hover:shadow-xl transition-all duration-300 flex gap-4 items-center"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-32 h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
                        {prop.status === 'under_negotiation' ? (
                          <div className="absolute top-2 left-2 bg-purple-600/90 backdrop-blur-md text-white text-[9px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-md">
                            ⏸️ Under Negotiation
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {prop.property_type ? t(`home.${prop.property_type}`, prop.property_type.replace('_', ' ')) : 'Property'}
                          </div>
                        )}
                      </div>

                      {/* Card Info */}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="text-lg font-extrabold text-slate-900">
                          {(prop.property_category === 'pg' || prop.property_type?.includes('pg')) ? (
                            <>
                              <span className="text-[11px] font-bold text-slate-500 mr-1">Starting</span>
                              ₹{Number(prop.price || 0).toLocaleString("en-IN")}
                              <span className="text-[11px] font-normal text-slate-500">/bed/mo</span>
                            </>
                          ) : (
                            <>
                              ₹{Number(prop.price || 0).toLocaleString("en-IN")}
                              <span className="text-[11px] font-normal text-slate-500">/mo</span>
                            </>
                          )}
                        </div>
                        <h4 className="font-bold text-[13px] text-slate-800 capitalize mt-0.5 truncate">
                          {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mt-1 truncate">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                          {prop.locality_details?.name || "Locality"}, {prop.locality_details?.city_name || "City"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {prop.bedrooms && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
                              {prop.bedrooms} Bed
                            </span>
                          )}
                          {prop.bathrooms && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
                              {prop.bathrooms} Bath
                            </span>
                          )}
                          {prop.food_preference && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">
                              {prop.food_preference}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* RIGHT COLUMN (7 Cols): Interactive Map */}
              <div className="lg:col-span-7 md:col-span-1 h-[75vh] md:h-[600px] lg:h-[750px] rounded-3xl overflow-hidden border border-slate-200/80 shadow-2xl relative sticky top-24">
                {/* FLOATING LOCATION ZOOM SELECTOR TOOLBAR */}
                <div className="absolute top-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-2xl shadow-2xl flex flex-wrap items-center gap-2 max-w-[calc(100%-12rem)]">
                  <div className="flex items-center gap-1.5 px-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    <span className="hidden sm:inline">Zoom To</span>
                  </div>

                  {/* State Selector Dropdown */}
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
                    className="bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-extrabold py-1.5 px-2.5 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    {Object.entries(STATE_CITY_DATA).map(([key, data]) => (
                      <option key={key} value={key}>
                        State: {data.name}
                      </option>
                    ))}
                  </select>

                  {/* City Selector Dropdown */}
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
                    className="bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-extrabold py-1.5 px-2.5 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    <option value="all">All {STATE_CITY_DATA[selectedStateKey]?.name} Cities</option>
                    {STATE_CITY_DATA[selectedStateKey]?.cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        📍 {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Map Controls Floating Toolbar */}
                <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsDrawingMode(!isDrawingMode);
                      if (isDrawingMode) setDrawnPolygon([]);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-[12px] flex items-center gap-2 shadow-xl transition-all ${
                      isDrawingMode
                        ? "bg-orange-600 text-white shadow-orange-500/30 scale-105"
                        : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isDrawingMode ? "close" : "draw"}
                    </span>
                    {isDrawingMode ? "Cancel Drawing" : "Draw Area"}
                  </button>
                  {drawnPolygon.length > 0 && (
                    <button
                      onClick={() => {
                        setDrawnPolygon([]);
                        setIsDrawingMode(false);
                      }}
                      className="px-4 py-2 rounded-xl font-bold text-[12px] flex items-center gap-2 shadow-lg bg-white text-red-600 hover:bg-red-50 border border-red-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Clear Area
                    </button>
                  )}
                  {isDrawingMode && drawnPolygon.length < 3 && (
                    <div className="bg-slate-900/90 backdrop-blur text-white text-[11px] font-medium p-3 rounded-xl text-center shadow-xl border border-white/10">
                      Click points on map to draw area.<br />(Min 3 points)
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
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
                <Link
                  key={prop.id}
                  to={`/property/${prop.id}`}
                  className="reveal group rounded-3xl overflow-hidden flex flex-col cursor-pointer border border-border bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] transition-all duration-300 h-full"
                >
                  <div
                    className="relative aspect-[4/3] w-full overflow-hidden"
                    style={{ backgroundColor: "var(--surface-alt)" }}
                  >
                    <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />

                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/70 to-transparent pointer-events-none" />

                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-slate-950/80 backdrop-blur-md text-white border border-slate-700/50 shadow-md">
                      {prop.property_type ? t(`home.${prop.property_type}`, prop.property_type.replace('_', ' ')) : 'Property'}
                    </div>

                    {prop.is_verified && (
                      <div className="absolute top-[42px] left-3 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/90 backdrop-blur-md text-white border border-emerald-400 shadow-[0_4px_12px_rgb(0,0,0,0.1)]">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        Verified
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (navigator.vibrate) navigator.vibrate(50);
                        toggleCompare(e, prop);
                      }}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-10 active:scale-90 shadow-[0_4px_12px_rgb(0,0,0,0.1)] cursor-pointer"
                      style={{
                        backgroundColor: compareList.find(p => p.id === prop.id) ? "var(--accent)" : "rgba(255, 255, 255, 0.2)",
                        color: compareList.find(p => p.id === prop.id) ? "white" : "var(--ink)",
                        border: "1px solid rgba(255,255,255,0.4)"
                      }}
                      title={compareList.find(p => p.id === prop.id) ? "Remove from compare" : "Add to compare"}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {compareList.find(p => p.id === prop.id) ? "favorite" : "favorite"}
                      </span>
                    </button>
                  </div>

                  <div className="p-5 flex flex-col flex-grow justify-between gap-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-extrabold text-[24px] tracking-tight leading-none"
                            style={{ color: "var(--ink)" }}
                          >
                            &#8377;{parseFloat(prop.price).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>/ mo</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500">location_on</span>
                        <span
                          className="text-[13px] font-bold truncate"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Translate>
                            {prop.locality_details
                              ? `${prop.locality_details.name}, ${prop.locality_details.city_name}`
                              : "Karnataka"}
                          </Translate>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {prop.bedrooms && (
                          <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">bed</span>
                            {prop.bedrooms} BHK
                          </span>
                        )}
                        {prop.bathrooms && (
                          <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">shower</span>
                            {prop.bathrooms} Bath
                          </span>
                        )}
                        {prop.carpet_area && (
                          <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">aspect_ratio</span>
                            {prop.carpet_area} sqft
                          </span>
                        )}
                      </div>
                    </div>


                  </div>
                </Link>
              ))
            )}
            </div>
          )}

          {/* Floating Action Pill for Mobile Filters/Map */}
          <div className="md:hidden sticky bottom-[80px] z-40 flex justify-center pointer-events-none pb-4">
            <div className="bg-slate-900 text-white rounded-full px-5 py-2.5 flex items-center gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] pointer-events-auto backdrop-blur-md">
              <button 
                onClick={() => setViewMode(viewMode === "grid" ? "map" : "grid")}
                className="flex items-center gap-2 text-[13px] font-bold active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {viewMode === "grid" ? "map" : "grid_view"}
                </span>
                {viewMode === "grid" ? "Map View" : "List View"}
              </button>
              <div className="w-[1px] h-4 bg-white/20"></div>
              <button 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // Focus the first filter input to trigger mobile UI scroll
                  setTimeout(() => {
                    const firstFilter = document.querySelector('select[name="city_id"]');
                    if (firstFilter) firstFilter.focus();
                  }, 400);
                }}
                className="flex items-center gap-2 text-[13px] font-bold active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Filters
              </button>
            </div>
          </div>

          {hasMore && (
            <div className="mt-12 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="h-12 px-8 rounded-xl text-[12px] font-extrabold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 border border-accent/30 text-accent hover:bg-accent hover:text-white cursor-pointer"
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 animate-fade-in">
          <span className="font-bold text-sm tracking-wide">{compareList.length} Selected</span>
          <button 
            onClick={() => setShowCompareModal(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-full font-bold text-xs transition-colors shadow-lg"
          >
            Compare Now
          </button>
          <button 
            onClick={() => setCompareList([])}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="Clear all"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
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
