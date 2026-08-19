import React from "react";

/**
 * SkeletonCard — animated placeholder while property cards load.
 * Respects current CSS theme variables automatically.
 */
export const SkeletonCard = () => (
  <div
    className="rounded-2xl overflow-hidden animate-pulse"
    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
  >
    {/* Image placeholder */}
    <div className="h-48 w-full" style={{ backgroundColor: "var(--surface-alt)" }} />

    {/* Content placeholders */}
    <div className="p-4 space-y-3">
      {/* Title */}
      <div
        className="h-4 rounded-full w-3/4"
        style={{ backgroundColor: "var(--surface-alt)" }}
      />
      {/* Subtitle */}
      <div
        className="h-3 rounded-full w-1/2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      />
      {/* Price row */}
      <div className="flex items-center justify-between pt-1">
        <div
          className="h-5 rounded-full w-1/3"
          style={{ backgroundColor: "var(--surface-alt)" }}
        />
        <div
          className="h-8 rounded-xl w-1/4"
          style={{ backgroundColor: "var(--surface-alt)" }}
        />
      </div>
    </div>
  </div>
);

/**
 * SkeletonList — renders N skeleton cards in a grid
 */
export const SkeletonGrid = ({ count = 6, className = "" }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

/**
 * SkeletonText — inline text placeholder
 */
export const SkeletonText = ({ width = "w-32", height = "h-4" }) => (
  <div
    className={`rounded-full animate-pulse ${width} ${height}`}
    style={{ backgroundColor: "var(--surface-alt)" }}
  />
);
