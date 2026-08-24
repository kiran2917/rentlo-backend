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
    // --- COMPACT LIST LAYOUT (Map View - Dark BMS Style) ---
    return (
      <Link
        to={`/property/${prop.id}`}
        target="_blank"
        className="group bg-slate-900 rounded-2xl p-3 border border-slate-800 hover:border-accent hover:shadow-2xl hover:shadow-accent/20 transition-all duration-300 flex gap-3 md:gap-4 items-center"
      >
        {/* Thumbnail */}
        <div className="relative w-28 h-32 rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-inner">
          <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
          <StatusBadge />
          <VerifiedBadge />
        </div>

        {/* Card Info */}
        <div className="flex-1 min-w-0 py-1">
          <h4 className="font-bold text-base text-white capitalize mt-1 truncate group-hover:text-accent transition-colors">
            {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
          </h4>
          <div className="text-lg md:text-xl font-black text-white mt-1">
            {isPg && <span className="text-xs font-bold text-slate-400 mr-1">Starting</span>}
            ₹{formattedPrice}
            <span className="text-xs font-normal text-slate-400">{isPg ? '/bed/mo' : '/mo'}</span>
          </div>
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1 mt-1 truncate">
            <span className="material-symbols-outlined text-sm text-accent">location_on</span>
            {prop.locality_details?.name || "Locality"}, {prop.locality_details?.city_name || "City"}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {prop.bedrooms && (
              <span className="px-2 py-1 bg-slate-800/80 border border-slate-700 text-slate-200 text-[10px] uppercase tracking-wider font-bold rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">bed</span>
                {prop.bedrooms} Bed
              </span>
            )}
            {prop.bathrooms && (
              <span className="px-2 py-1 bg-slate-800/80 border border-slate-700 text-slate-200 text-[10px] uppercase tracking-wider font-bold rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">shower</span>
                {prop.bathrooms} Bath
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // --- STANDARD GRID LAYOUT (BMS Movie Poster Style) ---
  return (
    <Link
      to={`/property/${prop.id}`}
      className="reveal group rounded-[20px] overflow-hidden flex flex-col cursor-pointer bg-slate-900 shadow-xl relative active:scale-[0.98] transition-all duration-300 h-full border border-slate-800 hover:border-accent/50 hover:shadow-accent/20"
    >
      {/* Poster Image Section (Aspect Ratio 3:4 for vertical poster look) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
        <div className="w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out">
          <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
        </div>
        
        {/* Deep Gradient Overlay mimicking BMS cards */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-0" />

        <div className="z-10">
          <StatusBadge />
          <VerifiedBadge />
        </div>

        {/* Action Row - Favorite/Compare */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (navigator.vibrate) navigator.vibrate(50);
            toggleCompare(e, prop);
          }}
          className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-10 active:scale-90 shadow-xl cursor-pointer bg-black/40 border border-white/10 hover:bg-accent"
          style={{
            backgroundColor: isCompared ? "var(--accent)" : "",
            color: "white",
          }}
          title={isCompared ? "Remove from compare" : "Add to compare"}
        >
          <span className="material-symbols-outlined text-[20px]" data-weight={isCompared ? "fill" : "regular"}>
            favorite
          </span>
        </button>

        {/* Content Section Overlaid on the Poster Bottom */}
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex flex-col justify-end z-10">
          {/* Title */}
          <h4 className="font-black text-lg text-white capitalize truncate mb-1 leading-tight group-hover:text-accent transition-colors">
            {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
          </h4>
          
          {/* Locality */}
          <div className="flex items-center gap-1 mb-3">
            <span className="material-symbols-outlined text-[14px] text-accent">location_on</span>
            <span className="text-xs font-semibold text-slate-300 truncate tracking-wide uppercase">
              <Translate>
                {prop.locality_details ? `${prop.locality_details.name}, ${prop.locality_details.city_name}` : "Locality"}
              </Translate>
            </span>
          </div>

          {/* Meta Icon Row */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {prop.bedrooms && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/10 backdrop-blur-md text-white border border-white/10 uppercase tracking-widest">
                {prop.bedrooms} BHK
              </span>
            )}
            {prop.bathrooms && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/10 backdrop-blur-md text-white border border-white/10 uppercase tracking-widest">
                {prop.bathrooms} Bath
              </span>
            )}
            {prop.carpet_area && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/10 backdrop-blur-md text-white border border-white/10 uppercase tracking-widest">
                {prop.carpet_area} sqft
              </span>
            )}
          </div>

          {/* Price & Action Button Row */}
          <div className="flex items-end justify-between border-t border-white/10 pt-3">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                {isPg ? 'Starting At' : 'Rent Price'}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-black text-2xl tracking-tighter text-white">
                  ₹{formattedPrice}
                </span>
                <span className="text-xs font-bold text-slate-400">{isPg ? '/bed' : '/mo'}</span>
              </div>
            </div>
            
            <div className="bg-black text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full shadow-lg shadow-black/30 transform group-hover:-translate-y-1 transition-all">
              Book
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
