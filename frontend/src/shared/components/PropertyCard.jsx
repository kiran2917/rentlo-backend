import React from 'react';
import { Link } from 'react-router-dom';
import { PropertyImageSlideshow } from './PropertyImageSlideshow';
import { Translate } from './Translate';

export const PropertyCard = ({
  prop,
  compareList = [],
  toggleCompare = () => {},
  layout = 'grid', // 'grid' | 'list'
  t = (key, defaultText) => defaultText // Fallback translation
}) => {
  const isGrid = layout === 'grid';
  const isCompared = compareList.some(p => p.id === prop.id);
  const formattedPrice = Number(prop.price || 0).toLocaleString("en-IN");
  const isPg = prop.property_category === 'pg' || prop.property_type?.includes('pg');

  // Unified Badge Render
  const StatusBadge = () => {
    if (prop.status === 'under_negotiation') {
      return (
        <div className="absolute top-2 left-2 bg-purple-600/90 backdrop-blur-md text-white text-xs font-extrabold px-2 py-1 rounded-md uppercase tracking-wider shadow-md">
          ⏸️ Under Negotiation
        </div>
      );
    }
    return (
      <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-xs font-extrabold px-2 py-1 rounded-md uppercase tracking-wider shadow-sm">
        {prop.property_type ? t(`home.${prop.property_type}`, prop.property_type.replace('_', ' ')) : 'Property'}
      </div>
    );
  };

  const VerifiedBadge = () => {
    if (!prop.is_verified) return null;
    return (
      <div className={`absolute ${isGrid ? 'top-11' : 'bottom-2'} left-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-extrabold bg-emerald-500/90 backdrop-blur-md text-white shadow-md`}>
        <span className="material-symbols-outlined text-sm">verified</span>
        Verified
      </div>
    );
  };

  if (!isGrid) {
    // --- COMPACT LIST LAYOUT (Map View) ---
    return (
      <Link
        to={`/property/${prop.id}`}
        target="_blank"
        className="group bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-emerald-500 hover:shadow-xl transition-all duration-300 flex gap-4 items-center"
      >
        {/* Thumbnail */}
        <div className="relative w-32 h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
          <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
          <StatusBadge />
          <VerifiedBadge />
        </div>

        {/* Card Info */}
        <div className="flex-1 min-w-0 py-1">
          <div className="text-lg font-extrabold text-emerald-600">
            {isPg && <span className="text-xs font-bold text-slate-500 mr-1">Starting</span>}
            ₹{formattedPrice}
            <span className="text-xs font-normal text-slate-500">{isPg ? '/bed/mo' : '/mo'}</span>
          </div>
          <h4 className="font-bold text-sm text-slate-800 capitalize mt-1 truncate">
            {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
          </h4>
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1 truncate">
            <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
            {prop.locality_details?.name || "Locality"}, {prop.locality_details?.city_name || "City"}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {prop.bedrooms && (
              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">bed</span>
                {prop.bedrooms} Bed
              </span>
            )}
            {prop.bathrooms && (
              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">shower</span>
                {prop.bathrooms} Bath
              </span>
            )}
            {prop.food_preference && (
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md">
                {prop.food_preference}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // --- STANDARD GRID LAYOUT ---
  return (
    <Link
      to={`/property/${prop.id}`}
      className="reveal group rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-emerald-500 active:scale-[0.98] transition-all duration-300 h-full"
    >
      {/* Image Section (Fixed Aspect Ratio 4:3) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/70 to-transparent pointer-events-none" />

        <StatusBadge />
        <VerifiedBadge />

        {/* Action Row - Favorite/Compare */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (navigator.vibrate) navigator.vibrate(50);
            toggleCompare(e, prop);
          }}
          className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-10 active:scale-90 shadow-sm cursor-pointer"
          style={{
            backgroundColor: isCompared ? "var(--emerald-600, #059669)" : "rgba(255, 255, 255, 0.9)",
            color: isCompared ? "white" : "#1e293b",
          }}
          title={isCompared ? "Remove from compare" : "Add to compare"}
        >
          <span className="material-symbols-outlined text-lg" data-weight={isCompared ? "fill" : "regular"}>
            favorite
          </span>
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-4">
        <div>
          {/* Price */}
          {/* FIX: Applied missing PG pricing logic from map view to grid view */}
          <div className="flex items-baseline gap-1 mb-2">
            {isPg && <span className="text-xs font-bold text-slate-500 mr-1">Starting</span>}
            <span className="font-extrabold text-xl tracking-tight text-emerald-600">
              ₹{formattedPrice}
            </span>
            <span className="text-xs font-bold text-slate-500">{isPg ? '/bed/mo' : '/mo'}</span>
          </div>

          {/* Title & Locality */}
          <h4 className="font-bold text-sm text-slate-800 capitalize truncate mb-1">
            {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
          </h4>
          <div className="flex items-center gap-1 mb-4">
            <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
            <span className="text-xs font-semibold text-slate-500 truncate">
              <Translate>
                {prop.locality_details ? `${prop.locality_details.name}, ${prop.locality_details.city_name}` : "Locality"}
              </Translate>
            </span>
          </div>

          {/* Meta Icon Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {prop.bedrooms && (
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-50 text-slate-600 flex items-center gap-1 border border-slate-100">
                <span className="material-symbols-outlined text-sm">bed</span>
                {prop.bedrooms} BHK
              </span>
            )}
            {prop.bathrooms && (
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-50 text-slate-600 flex items-center gap-1 border border-slate-100">
                <span className="material-symbols-outlined text-sm">shower</span>
                {prop.bathrooms} Bath
              </span>
            )}
            {prop.carpet_area && (
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-50 text-slate-600 flex items-center gap-1 border border-slate-100">
                <span className="material-symbols-outlined text-sm">aspect_ratio</span>
                {prop.carpet_area} sqft
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
