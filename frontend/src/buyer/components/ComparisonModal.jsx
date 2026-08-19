import React from "react";
import { Link } from "react-router-dom";

export const ComparisonModal = ({ properties, onClose, onRemove }) => {
  if (!properties || properties.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gray-900/50">
        <div>
          <h2 className="text-2xl font-bold font-display text-white">Compare Properties</h2>
          <p className="text-sm text-gray-400 mt-1">Comparing {properties.length} {properties.length === 1 ? "property" : "properties"}</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Comparison Table Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-6 md:p-10">
        <div className="flex gap-6 min-w-max">
          {/* Attributes Column (sticky on left side if we want, but simple flex is okay for up to 3 items) */}
          <div className="w-48 flex flex-col font-bold text-gray-400 text-sm uppercase tracking-widest gap-4 pt-60">
            <div className="h-12 flex items-center">Price</div>
            <div className="h-12 flex items-center">Locality</div>
            <div className="h-12 flex items-center">Property Type</div>
            <div className="h-12 flex items-center">BHK</div>
            <div className="h-12 flex items-center">Area (sqft)</div>
            <div className="h-12 flex items-center">Furnishing</div>
            <div className="h-12 flex items-center">Maintenance</div>
          </div>

          {/* Property Columns */}
          {properties.map((prop) => (
            <div key={prop.id} className="w-[300px] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col relative">
              <button 
                onClick={() => onRemove(prop.id)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black text-white flex items-center justify-center z-10 transition-colors"
                title="Remove from comparison"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>

              <div className="h-48 w-full bg-gray-200 relative">
                {prop.media?.length > 0 ? (
                  <img src={prop.media[0].thumbnail_url || prop.media[0].image_url} alt="Property" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl">home</span>
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col gap-4 text-gray-900">
                {/* Attributes corresponding to the left column */}
                <div className="h-12 flex items-center font-display font-bold text-2xl text-orange-600">
                  ₹{parseFloat(prop.price).toLocaleString('en-IN')}
                </div>
                <div className="h-12 flex items-center font-semibold text-sm">
                  {prop.locality_details?.name || "N/A"}, {prop.locality_details?.city_name || ""}
                </div>
                <div className="h-12 flex items-center font-medium text-sm capitalize">
                  {prop.property_type || "N/A"}
                </div>
                <div className="h-12 flex items-center font-medium text-sm">
                  {prop.bhk} BHK
                </div>
                <div className="h-12 flex items-center font-medium text-sm">
                  {prop.area_sqft ? `${prop.area_sqft} sqft` : "N/A"}
                </div>
                <div className="h-12 flex items-center font-medium text-sm capitalize">
                  {prop.furnishing_status || "N/A"}
                </div>
                <div className="h-12 flex items-center font-medium text-sm">
                  {prop.maintenance_charges > 0 ? `₹${prop.maintenance_charges}/mo` : "Included"}
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100">
                  <Link 
                    to={`/property/${prop.id}`}
                    onClick={onClose}
                    className="w-full py-3 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-sm hover:bg-orange-600 transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* Add more placeholder if < 3 */}
          {properties.length < 3 && (
            <div className="w-[300px] rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 gap-3">
              <span className="material-symbols-outlined text-4xl">add_circle</span>
              <p className="font-semibold text-sm">Add another property</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
