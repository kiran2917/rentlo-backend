import React from 'react';
import { Link } from 'react-router-dom';
import { PropertyImageSlideshow } from './PropertyImageSlideshow';
import { Translate } from './Translate';

export const PropertyCard = ({
  prop,
  compareList = [],
  toggleCompare = () => {},
  layout = 'grid',
  t = (key, defaultText) => defaultText
}) => {
  const isGrid = layout === 'grid';
  const isCompared = compareList.some(p => p.id === prop.id);
  const formattedPrice = Number(prop.price || 0).toLocaleString("en-IN");
  const isPg = prop.property_category === 'pg' || prop.property_type?.includes('pg');

  const VerifiedBadge = () => {
    if (!prop.is_verified) return null;
    return (
      <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white shadow-md uppercase tracking-widest z-10">
        <span className="material-symbols-outlined text-[10px]">verified</span>
        Verified
      </div>
    );
  };

  const FavoriteButton = () => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(50);
        toggleCompare(e, prop);
      }}
      className="absolute top-2 right-2 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all z-10 active:scale-90 bg-white/50 backdrop-blur-md hover:bg-white border border-black/5"
      style={{
        color: isCompared ? "#000000" : "#475569",
      }}
    >
      <span className="material-symbols-outlined text-[16px] md:text-[18px]" data-weight={isCompared ? "fill" : "regular"}>
        favorite
      </span>
    </button>
  );

  if (!isGrid) {
    // List layout for Map/Compact
    return (
      <Link
        to={`/property/${prop.id}`}
        target="_blank"
        className="group bg-white rounded-2xl p-2.5 border border-slate-100 hover:border-slate-300 hover:shadow-xl transition-all duration-300 flex gap-3 md:gap-4 items-center"
      >
        <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0">
          <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
          <VerifiedBadge />
        </div>
        <div className="flex-1 min-w-0 py-1">
          <h4 className="font-extrabold text-sm md:text-base text-slate-900 capitalize truncate group-hover:text-black transition-colors">
            {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
          </h4>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5 truncate">
            {prop.locality_details?.name || "Locality"}, {prop.locality_details?.city_name || "City"}
          </p>
          <div className="text-base md:text-xl font-black text-slate-900 mt-1">
            ₹{formattedPrice}
            <span className="text-[10px] font-bold text-slate-400 ml-0.5">{isPg ? '/bed/mo' : '/mo'}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Modern Airbnb-style Grid Layout
  return (
    <Link
      to={`/property/${prop.id}`}
      className="flex flex-col gap-2.5 group cursor-pointer active:scale-[0.98] transition-transform duration-300"
    >
      {/* Image Container (Aspect Square) */}
      <div className="relative aspect-[4/5] sm:aspect-square w-full rounded-[20px] overflow-hidden bg-slate-100 shadow-sm border border-black/5">
        <div className="w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out">
          <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />
        </div>
        
        <VerifiedBadge />
        <FavoriteButton />

        {/* Category Pill */}
        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white">
          {prop.property_type ? t(`home.${prop.property_type}`, prop.property_type.replace('_', ' ')) : 'Property'}
        </div>
      </div>

      {/* Content Details */}
      <div className="px-1 flex flex-col gap-0.5">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate leading-tight">
            {prop.locality_details?.name || "Locality"}, {prop.locality_details?.city_name || "City"}
          </h4>
          <div className="flex items-center gap-0.5 shrink-0 text-slate-900">
            <span className="material-symbols-outlined text-[14px]" data-weight="fill">star</span>
            <span className="text-xs font-bold">New</span>
          </div>
        </div>
        
        <p className="text-xs sm:text-sm text-slate-500 truncate font-medium">
          {prop.display_title || `${prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}${prop.property_type || "Property"}`}
        </p>

        <div className="flex items-center justify-between mt-1 pt-1">
          <div className="font-black text-sm sm:text-lg text-slate-900">
            ₹{formattedPrice}
            <span className="font-semibold text-slate-500 text-[10px] sm:text-xs ml-0.5">{isPg ? '/bed' : '/mo'}</span>
          </div>
          
          <button className="bg-black text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full hover:bg-slate-800 transition-colors">
            Book
          </button>
        </div>
      </div>
    </Link>
  );
};
