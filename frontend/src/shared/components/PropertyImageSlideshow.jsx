import React, { useState, useEffect } from "react";

export const PropertyImageSlideshow = ({ media = [], propertyType = "", altText = "Property" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!media || media.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % media.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [media]);

  if (!media || media.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 bg-slate-900">
        <span className="material-symbols-outlined text-[42px] opacity-40">home_work</span>
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider opacity-60">Rentlo Verified</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 group">
      {/* Stacked Images for Buttery-Smooth 1-Second Cross-Fade Animation */}
      {media.map((item, idx) => {
        const imgSrc = item?.thumbnail_url || item?.medium_url || item?.image_url;
        const isActive = idx === currentIndex;

        return (
          <img
            key={item.id || item.image_url || idx}
            src={imgSrc}
            alt={`${altText} - Image ${idx + 1}`}
            loading={idx === 0 ? "eager" : "lazy"}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f1f5f9'/%3E%3Cpath d='M200 120 l-40 40 v40 h80 v-40 z' fill='%23cbd5e1'/%3E%3Ctext x='50%25' y='65%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2394a3b8'%3EImage Not Available%3C/text%3E%3C/svg%3E";
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
              isActive
                ? "opacity-100 scale-100 z-1"
                : "opacity-0 scale-105 pointer-events-none z-0"
            }`}
          />
        );
      })}

      {/* Slide Indicators Bar / Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 z-10 flex items-center justify-center gap-1.5 pointer-events-none">
          {media.slice(0, 6).map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-500 ease-in-out ${
                idx === currentIndex
                  ? "w-5 bg-white shadow-lg shadow-black/40"
                  : "w-1.5 bg-white/50 backdrop-blur-xs"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
