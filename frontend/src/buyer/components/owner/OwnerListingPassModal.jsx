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

  const res1Days = Number(settings?.validity_residential_1pack_days ?? settings?.validity_residential_days ?? 0);
  const res3Days = Number(settings?.validity_residential_3pack_days ?? 0);
  const res6Days = Number(settings?.validity_residential_6pack_days ?? 0);
  const res10Days = Number(settings?.validity_residential_10pack_days ?? 0);

  const pg1Days = Number(settings?.validity_apt_pg_1pack_days ?? settings?.validity_apt_pg_days ?? 60);
  const pg3Days = Number(settings?.validity_apt_pg_3pack_days ?? 60);
  const pg6Days = Number(settings?.validity_apt_pg_6pack_days ?? 90);
  const pg10Days = Number(settings?.validity_apt_pg_10pack_days ?? 180);

  const comm1Days = Number(settings?.validity_commercial_1pack_days ?? settings?.validity_commercial_days ?? 0);
  const comm3Days = Number(settings?.validity_commercial_3pack_days ?? 0);
  const comm6Days = Number(settings?.validity_commercial_6pack_days ?? 0);
  const comm10Days = Number(settings?.validity_commercial_10pack_days ?? 0);

  const valDesc = (days) => (days > 0 ? `Live for ${days} Days each` : "Valid Until Rented (Never Expires)");
  const singleValDesc = (days) => (days > 0 ? `Live for ${days} Days` : "Valid Until Rented (Never Expires)");

  const cRes1 = Number(settings?.count_residential_1pack) || 1;
  const cRes3 = Number(settings?.count_residential_3pack) || 3;
  const cRes6 = Number(settings?.count_residential_6pack) || 6;
  const cRes10 = Number(settings?.count_residential_10pack) || 10;

  const cPg1 = Number(settings?.count_apt_pg_1pack) || 1;
  const cPg3 = Number(settings?.count_apt_pg_3pack) || 3;
  const cPg6 = Number(settings?.count_apt_pg_6pack) || 6;
  const cPg10 = Number(settings?.count_apt_pg_10pack) || 10;

  const cComm1 = Number(settings?.count_commercial_1pack) || 1;
  const cComm3 = Number(settings?.count_commercial_3pack) || 3;
  const cComm6 = Number(settings?.count_commercial_6pack) || 6;
  const cComm10 = Number(settings?.count_commercial_10pack) || 10;

  const CATEGORY_PACKS = {
    residential: {
      title: "🏡 Residential (1RK, 1BHK, 2BHK, 3BHK, House)",
      packs: [
        { name: `${cRes1} Listing`, count: cRes1, price: resFee, badge: null, desc: `${cRes1}-time property listing · ${singleValDesc(res1Days)}` },
        { name: `${cRes3}-Listing Pass`, count: cRes3, price: res3, badge: "POPULAR", desc: `₹${Math.round(res3/cRes3)} / listing · ${valDesc(res3Days)}` },
        { name: `${cRes6}-Listing Pass`, count: cRes6, price: res6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(res6/cRes6)} / listing · ${valDesc(res6Days)}` },
        { name: `${cRes10}-Listing Pass`, count: cRes10, price: res10, badge: "PRO AGENT 👑", desc: `₹${Math.round(res10/cRes10)} / listing · ${valDesc(res10Days)}` },
      ]
    },
    pg_hostel: {
      title: "🛏️ PG & Hostel & Multi-Bed Rooms",
      packs: [
        { name: `${cPg1} Listing`, count: cPg1, price: aptFee, badge: null, desc: `${cPg1}-time PG/Hostel listing · ${singleValDesc(pg1Days)}` },
        { name: `${cPg3}-PG & Hostel Pass`, count: cPg3, price: apt3, badge: "POPULAR", desc: `₹${Math.round(apt3/cPg3)} / listing · ${valDesc(pg3Days)}` },
        { name: `${cPg6}-PG & Hostel Pass`, count: cPg6, price: apt6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(apt6/cPg6)} / listing · ${valDesc(pg6Days)}` },
        { name: `${cPg10}-PG & Hostel Pass`, count: cPg10, price: apt10, badge: "PRO AGENT 👑", desc: `₹${Math.round(apt10/cPg10)} / listing · ${valDesc(pg10Days)}` },
      ]
    },
    commercial: {
      title: "🏪 Commercial Shop, Office Space & Plot",
      packs: [
        { name: `${cComm1} Commercial`, count: cComm1, price: commFee, badge: null, desc: `${cComm1} Commercial Space · ${singleValDesc(comm1Days)}` },
        { name: `${cComm3}-Commercial Pass`, count: cComm3, price: comm3, badge: "POPULAR", desc: `₹${Math.round(comm3/cComm3)} / listing · ${valDesc(comm3Days)}` },
        { name: `${cComm6}-Commercial Pass`, count: cComm6, price: comm6, badge: "BEST VALUE ⭐", desc: `₹${Math.round(comm6/cComm6)} / listing · ${valDesc(comm6Days)}` },
        { name: `${cComm10}-Commercial Pass`, count: cComm10, price: comm10, badge: "PRO AGENT 👑", desc: `₹${Math.round(comm10/cComm10)} / listing · ${valDesc(comm10Days)}` },
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
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold uppercase tracking-wider mb-2">
            <span className="material-symbols-outlined text-base">real_estate_agent</span>
            Owner Listing Packs & Passes
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
            Select Your Property Listing Package
          </h2>
          <p className="text-sm text-slate-500 mt-1">
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
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 ${
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
              className="p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-600 bg-white hover:bg-emerald-50/20 transition-all duration-200 flex flex-col justify-between relative group"
            >
              {pack.badge && (
                <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-black text-white text-xs font-extrabold tracking-wider shadow-sm">
                  {pack.badge}
                </span>
              )}

              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-extrabold text-base text-slate-950">
                    {pack.name}
                  </h3>
                  <span className="text-xl font-extrabold text-slate-900">
                    ₹{pack.price}
                  </span>
                </div>

                <p className="text-xs text-slate-500 font-medium mb-4">
                  {pack.desc}
                </p>
              </div>

              <button
                onClick={() => handleSelectPack(pack)}
                className="w-full h-10 rounded-xl text-white text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-base">add_task</span>
                Buy {pack.name} (₹{pack.price})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
