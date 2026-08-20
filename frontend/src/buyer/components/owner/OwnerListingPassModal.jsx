import React, { useState, useEffect } from "react";

export const OwnerListingPassModal = ({ isOpen, onClose, onSuccessPass }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("residential");
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
      credentials: "include"
    })
      .then((r) => r.json())
      .then(setSettings)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const resFee = settings?.owner_residential_fee || 99;
  const res3 = settings?.owner_residential_3pack_price || 259;
  const res6 = settings?.owner_residential_6pack_price || 499;
  const res10 = settings?.owner_residential_10pack_price || 859;

  const aptFee = settings?.owner_apt_pg_fee || 149;
  const apt3 = settings?.owner_apt_pg_3pack_price || 349;
  const apt6 = settings?.owner_apt_pg_6pack_price || 649;
  const apt10 = settings?.owner_apt_pg_10pack_price || 999;

  const commFee = settings?.owner_commercial_fee || 199;
  const comm3 = settings?.owner_commercial_3pack_price || 449;
  const comm6 = settings?.owner_commercial_6pack_price || 799;
  const comm10 = settings?.owner_commercial_10pack_price || 1199;

  const pg1Days = settings?.validity_apt_pg_1pack_days || settings?.validity_apt_pg_days || 60;
  const pg3Days = settings?.validity_apt_pg_3pack_days || 60;
  const pg6Days = settings?.validity_apt_pg_6pack_days || 90;
  const pg10Days = settings?.validity_apt_pg_10pack_days || 180;

  const CATEGORY_PACKS = {
    residential: {
      title: "🏡 Residential (1RK, 1BHK, 2BHK, 3BHK, House)",
      packs: [
        { name: "Single Listing", count: 1, price: resFee, badge: null, desc: "1-time property listing · Valid Until Rented (Never Expires)" },
        { name: "3-Listing Pass", count: 3, price: res3, badge: "POPULAR", desc: `₹${Math.round(res3/3)} / listing · Valid Until Rented` },
        { name: "6-Listing Pass", count: 6, price: res6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(res6/6)} / listing · Valid Until Rented` },
        { name: "10-Listing Pass", count: 10, price: res10, badge: "PRO AGENT 👑", desc: `₹${Math.round(res10/10)} / listing · Valid Until Rented` },
      ]
    },
    pg_hostel: {
      title: "🛏️ PG & Hostel & Multi-Bed Rooms",
      packs: [
        { name: "Single Listing", count: 1, price: aptFee, badge: null, desc: `1-time PG/Hostel listing · Live for ${pg1Days} Days` },
        { name: "3-PG & Hostel Pass", count: 3, price: apt3, badge: "POPULAR", desc: `₹${Math.round(apt3/3)} / listing · Live for ${pg3Days} Days each` },
        { name: "6-PG & Hostel Pass", count: 6, price: apt6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(apt6/6)} / listing · Live for ${pg6Days} Days each` },
        { name: "10-PG & Hostel Pass", count: 10, price: apt10, badge: "PRO AGENT 👑", desc: `₹${Math.round(apt10/10)} / listing · Live for ${pg10Days} Days each` },
      ]
    },
    commercial: {
      title: "🏪 Commercial Shop, Office Space & Plot",
      packs: [
        { name: "Single Commercial", count: 1, price: commFee, badge: null, desc: "1 Commercial Shop/Office · Valid Until Rented (Never Expires)" },
        { name: "3-Commercial Pass", count: 3, price: comm3, badge: "POPULAR", desc: `₹${Math.round(comm3/3)} / listing · Valid Until Rented` },
        { name: "6-Commercial Pass", count: 6, price: comm6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(comm6/6)} / listing · Valid Until Rented` },
        { name: "10-Commercial Pass", count: 10, price: comm10, badge: "PRO AGENT 👑", desc: `₹${Math.round(comm10/10)} / listing · Valid Until Rented` },
      ]
    }
  };

  const handleSelectPack = (pack) => {
    alert(`Selected ${pack.name} for ₹${pack.price}. Connecting to payment gateway...`);
    if (onSuccessPass) onSuccessPass(pack);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold uppercase tracking-wider mb-2">
            <span className="material-symbols-outlined text-[16px]">real_estate_agent</span>
            Owner Listing Packs & Passes
          </div>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold text-slate-900 leading-tight">
            Select Your Property Listing Package
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Save up to 40% with listing passes. 100% direct tenant leads with 0% brokerage.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex p-1 rounded-2xl bg-slate-100 mb-6 gap-1 overflow-x-auto">
          {[
            { id: "residential", label: "🏡 Residential" },
            { id: "pg_hostel", label: "🛏️ PG & Hostel" },
            { id: "commercial", label: "🏪 Commercial" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-[12px] font-extrabold transition-all duration-200 ${
                selectedTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Packs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {CATEGORY_PACKS[selectedTab].packs.map((pack, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 bg-white hover:bg-emerald-50/20 transition-all duration-200 flex flex-col justify-between relative group"
            >
              {pack.badge && (
                <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold tracking-wider shadow-sm">
                  {pack.badge}
                </span>
              )}

              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-extrabold text-[16px] text-slate-950">
                    {pack.name}
                  </h3>
                  <span className="text-[20px] font-extrabold text-slate-900">
                    ₹{pack.price}
                  </span>
                </div>

                <p className="text-[12px] text-slate-500 font-medium mb-4">
                  {pack.desc}
                </p>
              </div>

              <button
                onClick={() => handleSelectPack(pack)}
                className="w-full h-10 rounded-xl text-white text-[12px] font-extrabold transition-all shadow-sm flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-[16px]">add_task</span>
                Buy {pack.name} (₹{pack.price})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
