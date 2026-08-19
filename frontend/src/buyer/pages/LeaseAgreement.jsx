import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";

export const LeaseAgreement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Variables
  const [landlordName, setLandlordName] = useState("");
  const [landlordPhone, setLandlordPhone] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("30");

  // Custom Landlord Rules State
  const [customRules, setCustomRules] = useState([
    "1 Month painting charges will be deducted from security deposit upon vacating (Karnataka Rule).",
    "Subletting or operating paying guest (PG) accommodation is strictly prohibited.",
    "Premises shall be used strictly for residential purposes by the tenant & immediate family.",
    "Day-to-day minor electrical and plumbing repairs under ₹1,000 shall be borne by the tenant."
  ]);
  const [newRuleInput, setNewRuleInput] = useState("");

  const ownerSigRef = useRef();
  const tenantSigRef = useRef();

  const [platformSettings, setPlatformSettings] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const fetchAllDetails = async () => {
      try {
        const [pubRes, myPropsRes, meRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/properties/public/${id}/`, { credentials: "include" }),
          fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, { credentials: "include" }),
          fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, { credentials: "include" })
        ]);

        let propData = null;
        if (pubRes.ok) {
          propData = await pubRes.json();
        }

        let meData = null;
        if (meRes.ok) {
          meData = await meRes.json();
        }

        if (myPropsRes.ok) {
          const myProps = await myPropsRes.json();
          const match = myProps.find((p) => String(p.id) === String(id));
          if (match) {
            propData = { ...propData, ...match };
          }
        }

        if (propData) {
          let resolvedLandlordName = propData.owner_name;
          let resolvedLandlordPhone = propData.owner_phone;

          if (!resolvedLandlordName || resolvedLandlordName.includes("Hidden")) {
            if (meData && (meData.role === "owner" || (meData.roles && meData.roles.includes("owner")))) {
              resolvedLandlordName = meData.first_name ? `${meData.first_name} ${meData.last_name || ""}`.trim() : meData.username;
              resolvedLandlordPhone = meData.phone || "";
            } else {
              resolvedLandlordName = propData.owner?.name || "Property Owner";
              resolvedLandlordPhone = propData.owner?.phone || "";
            }
          }

          setLandlordName(resolvedLandlordName || "Property Owner");
          setLandlordPhone(resolvedLandlordPhone || "");
          setProperty(propData);
          setRentAmount(propData.price || "");
          setDepositAmount(propData.security_deposit || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllDetails();

    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((r) => r.json())
      .then((data) => setPlatformSettings(data))
      .catch((err) => console.error(err));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const clearSignature = (ref) => {
    if (ref.current) {
      ref.current.clear();
    }
  };

  const addCustomRule = () => {
    if (newRuleInput.trim()) {
      setCustomRules([...customRules, newRuleInput.trim()]);
      setNewRuleInput("");
    }
  };

  const removeRule = (index) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const togglePresetRule = (ruleText) => {
    if (customRules.includes(ruleText)) {
      setCustomRules(customRules.filter((r) => r !== ruleText));
    } else {
      setCustomRules([...customRules, ruleText]);
    }
  };

  const startEditRule = (index, currentText) => {
    setEditingIndex(index);
    setEditingText(currentText);
  };

  const saveEditRule = (index) => {
    if (editingText.trim()) {
      const updated = [...customRules];
      updated[index] = editingText.trim();
      setCustomRules(updated);
    }
    setEditingIndex(null);
    setEditingText("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm font-extrabold text-emerald-400 tracking-wider">Generating Legal Lease Agreement...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-black text-lg">
        Property not found.
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const karnatakaPresets = [
    { label: "🎨 1 Month Painting Fee (Karnataka Rule)", text: "1 Month painting charges will be deducted from security deposit upon vacating (Karnataka Rule)." },
    { label: "🚫 No Subletting / PG", text: "Subletting or operating paying guest (PG) accommodation is strictly prohibited." },
    { label: "🐾 No Pets Allowed", text: "No pets of any kind are permitted inside the premises without prior written consent from the landlord." },
    { label: "⏰ ₹500 Fine for Late Rent after 5th", text: "A late payment fee of ₹500 per day shall apply for monthly rent paid after the 5th of the month." },
    { label: "🔒 6 Months Minimum Lock-in", text: "Minimum lock-in period of 6 months. Vacating before lock-in forfeits 1 month rent equivalent from deposit." },
    { label: "🛠️ Minor Repairs (< ₹1k) by Tenant", text: "Day-to-day minor electrical/plumbing repairs under ₹1,000 shall be borne by the tenant." }
  ];

  const docId = `IN-KA${property.id}2026RENT`;

  return (
    <div className="min-h-screen font-sans bg-slate-950 text-slate-100 pb-20 selection:bg-emerald-500 selection:text-slate-950">
      {/* 1-PAGE A4 HIGH-PERFORMANCE PRINT CSS */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 5mm 7mm;
        }
        @media print {
          body, html {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden, nav, header, footer, .no-print {
            display: none !important;
          }
          .printable-document {
            background-color: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            max-height: 285mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
          }
          .print-border-box {
            border: 2px solid #0f172a !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            padding: 10px 14px !important;
            height: 100% !important;
            max-height: 280mm !important;
            box-sizing: border-box !important;
          }
          .print-stamp-header {
            border: 1.5px solid #0f172a !important;
            background-color: #f8fafc !important;
            color: #0f172a !important;
            padding: 6px 10px !important;
            margin-bottom: 8px !important;
          }
        }
      `}</style>

      {/* NO-PRINT STUDIO CONTROL TOOLBAR */}
      <div className="print-hidden w-full bg-slate-900/90 backdrop-blur-xl text-white p-5 shadow-2xl sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                1-Page A4 Sheet Legal Builder
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-emerald-400">description</span>
              Residential Tenancy Agreement Studio
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Edit terms & tenant details below. Automatically formatted for a single A4 legal sheet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-extrabold transition cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer hover:scale-105"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print 1-Page A4 PDF
            </button>
          </div>
        </div>

        {/* Phase 2 E-Stamp Banner */}
        {platformSettings?.enable_e_stamp_agreements && (
          <div className="max-w-6xl mx-auto mt-3 p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[24px] text-emerald-400">verified</span>
              <div>
                <p className="text-[12px] font-bold text-white flex items-center gap-2">
                  Official State Govt E-Stamp Upgrade
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold">Active</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => alert(`Triggering Razorpay payment of ₹${platformSettings.e_stamp_price || 499} for Govt E-Stamp procurement.`)}
              className="px-4 py-1.5 bg-emerald-500 text-slate-950 text-[11px] font-extrabold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Upgrade to Govt E-Stamp (₹{platformSettings.e_stamp_price || 499})
            </button>
          </div>
        )}

        {/* Form Inputs Grid */}
        <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Landlord Name</label>
            <input
              type="text"
              value={landlordName}
              onChange={(e) => setLandlordName(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
              placeholder="e.g., Dhruva"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Landlord Phone</label>
            <input
              type="text"
              value={landlordPhone}
              onChange={(e) => setLandlordPhone(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
              placeholder="e.g., 9902591115"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Tenant Name</label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
              placeholder="e.g., Ramesh Kumar"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Tenant Phone</label>
            <input
              type="text"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
              placeholder="e.g., 9876543210"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Monthly Rent (₹)</label>
            <input
              type="number"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Security Deposit (₹)</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="bg-slate-950 text-white rounded-xl px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 font-semibold"
            />
          </div>
        </div>

        {/* CUSTOM RULES BUILDER */}
        <div className="max-w-6xl mx-auto mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] uppercase font-extrabold text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">gavel</span>
              Karnataka Tenancy Regulations & Special Clauses
            </label>
            <span className="text-[10px] text-slate-400 font-bold">{customRules.length} Clauses Active</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {karnatakaPresets.map((preset, idx) => {
              const active = customRules.includes(preset.text);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => togglePresetRule(preset.text)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                    active
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {preset.label} {active ? "✓" : "+"}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newRuleInput}
              onChange={(e) => setNewRuleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomRule()}
              placeholder="Type custom house rule or clause..."
              className="flex-1 bg-slate-900 rounded-lg px-3 py-1.5 text-xs outline-none border border-slate-700 focus:border-emerald-500 text-white font-medium"
            />
            <button
              type="button"
              onClick={addCustomRule}
              className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-black rounded-lg cursor-pointer hover:bg-emerald-400"
            >
              + Add Clause
            </button>
          </div>
        </div>
      </div>

      {/* PURE WHITE LUXURY LEGAL PAPER DOCUMENT CONTAINER */}
      <div 
        className="max-w-[210mm] mx-auto my-8 printable-document font-serif text-slate-900 leading-tight text-[11px] p-8 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200"
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
      >
        <div 
          className="print-border-box border-2 border-slate-900 p-6 flex flex-col justify-between relative bg-white min-h-[272mm]"
          style={{ border: "2px solid #0f172a", backgroundColor: "#ffffff", color: "#0f172a" }}
        >
          <div>
            {/* AUTHENTIC KARNATAKA E-STAMP CERTIFICATE HEADER BOX */}
            <div 
              className="print-stamp-header p-3 mb-4 rounded-lg font-sans text-[10px]"
              style={{ backgroundColor: "#f8fafc", border: "1.5px solid #0f172a", color: "#0f172a" }}
            >
              <div 
                className="flex items-center justify-between pb-2 mb-2"
                style={{ borderBottom: "1.5px solid #0f172a" }}
              >
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-serif font-black text-[9px] text-center leading-tight shrink-0"
                    style={{ border: "2px solid #0f172a", color: "#0f172a", backgroundColor: "#ffffff" }}
                  >
                    GOVT<br/>KAR
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider" style={{ color: "#0f172a" }}>
                      Government of Karnataka
                    </h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#475569" }}>
                      e-Stamp Non-Judicial Tenancy Certificate
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span 
                    className="px-2.5 py-0.5 rounded font-black text-[10px] tracking-wider inline-block"
                    style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                  >
                    STAMP DUTY: ₹100
                  </span>
                  <p className="text-[9px] font-bold mt-0.5" style={{ color: "#475569" }}>Certificate No: {docId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9.5px]">
                <div><span className="font-bold" style={{ color: "#475569" }}>Issued Date:</span> <strong style={{ color: "#0f172a" }}>{currentDate}</strong></div>
                <div><span className="font-bold" style={{ color: "#475569" }}>Account Ref:</span> <strong style={{ color: "#0f172a" }}>NONACC/ (FI)/ ka-stamp/ KARNATAKA</strong></div>
                <div><span className="font-bold" style={{ color: "#475569" }}>First Party (Landlord):</span> <strong style={{ color: "#0f172a" }}>{landlordName}</strong></div>
                <div><span className="font-bold" style={{ color: "#475569" }}>Second Party (Tenant):</span> <strong style={{ color: "#0f172a" }}>{tenantName || "[Tenant Name]"}</strong></div>
                <div><span className="font-bold" style={{ color: "#475569" }}>Property Location:</span> <strong style={{ color: "#0f172a" }}>{property.locality_details?.name || "Hubli"}, {property.locality_details?.city_name || "Karnataka"}</strong></div>
                <div><span className="font-bold" style={{ color: "#475569" }}>Document Type:</span> <strong style={{ color: "#0f172a" }}>Article 30 Tenancy Agreement (11 Months)</strong></div>
              </div>
            </div>

            {/* DOCUMENT TITLE */}
            <div className="text-center mb-3 pb-2" style={{ borderBottom: "2px solid #0f172a" }}>
              <h1 className="text-lg font-black uppercase tracking-widest mb-0.5" style={{ color: "#0f172a" }}>
                RENTAL LEASE AGREEMENT
              </h1>
              <p className="text-[9.5px] font-sans uppercase tracking-widest font-bold" style={{ color: "#475569" }}>
                Residential Tenancy Contract under Karnataka Rent Control Regulations
              </p>
            </div>

            {/* RECITALS */}
            <p className="mb-3 leading-tight text-justify" style={{ color: "#1e293b" }}>
              This Rental Agreement is made and executed on this <strong>{currentDate}</strong> at{" "}
              <strong>{property.locality_details?.city_name || "Hubli-Dharwad"}</strong>, Karnataka by and between:
            </p>

            {/* PARTIES GRID */}
            <div className="grid grid-cols-2 gap-3 mb-3 font-sans text-[10px]">
              <div 
                className="p-2.5 rounded-lg"
                style={{ backgroundColor: "#f8fafc", borderLeft: "4px solid #0f172a", borderTop: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}
              >
                <p className="font-black text-[10.5px] uppercase tracking-wider" style={{ color: "#0f172a" }}>
                  LANDLORD / LESSOR:
                </p>
                <p className="font-bold text-xs mt-0.5" style={{ color: "#0f172a" }}>
                  {landlordName} {landlordPhone && `(Phone: ${landlordPhone})`}
                </p>
                <p className="text-[9px] font-medium mt-0.5" style={{ color: "#64748b" }}>
                  (Includes heirs, executors, administrators, and legal assigns).
                </p>
              </div>

              <div 
                className="p-2.5 rounded-lg"
                style={{ backgroundColor: "#f8fafc", borderLeft: "4px solid #059669", borderTop: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}
              >
                <p className="font-black text-[10.5px] uppercase tracking-wider" style={{ color: "#059669" }}>
                  TENANT / LESSEE:
                </p>
                <p className="font-bold text-xs mt-0.5" style={{ color: "#0f172a" }}>
                  <span className={!tenantName ? "italic font-bold" : ""} style={{ color: tenantName ? "#0f172a" : "#dc2626" }}>
                    {tenantName || "[Tenant Full Name (Please Enter in Toolbar Above)]"}
                  </span>{" "}
                  {tenantPhone && `(Phone: ${tenantPhone})`}
                </p>
                <p className="text-[9px] font-medium mt-0.5" style={{ color: "#64748b" }}>
                  (Includes heirs, executors, and permitted assigns).
                </p>
              </div>
            </div>

            {/* CLAUSES */}
            <div className="space-y-2 text-justify leading-tight text-[10.5px]" style={{ color: "#1e293b" }}>
              <div>
                <h4 className="font-bold text-xs pb-0.5 mb-1" style={{ borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}>
                  I. PREMISES & TENURE (11 MONTHS)
                </h4>
                <p>
                  Landlord hereby lets out to Tenant the residential property at: <strong style={{ color: "#0f172a" }}>{property.locality_details?.name}, {property.locality_details?.city_name}</strong> (Property ID: #{property.id}). <span className="font-sans text-[9.5px]" style={{ color: "#475569" }}>Type: {property.property_type?.toUpperCase()} | BHK: {property.bhk || property.bedrooms || "N/A"} BHK</span>. Tenancy commences on <strong>{startDate || currentDate}</strong> for a fixed term of <strong>11 Months</strong>.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-xs pb-0.5 mb-1" style={{ borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}>
                  II. RENT & REFUNDABLE DEPOSIT
                </h4>
                <p>
                  Monthly Rent: <strong>₹{rentAmount ? parseFloat(rentAmount).toLocaleString('en-IN') : "0"}</strong> due on or before 5th day of each calendar month. Security Deposit: Refundable <strong>₹{depositAmount ? parseFloat(depositAmount).toLocaleString('en-IN') : "0"}</strong> paid prior to occupancy. Maintenance: {property.maintenance_charges > 0 ? `₹${property.maintenance_charges}/month.` : "Included in monthly rent."}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-xs pb-0.5 mb-1" style={{ borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}>
                  III. NOTICE PERIOD & TERMINATION
                </h4>
                <p>
                  Either party may terminate tenancy with <strong>{noticePeriod} Days</strong> prior written notice. Vacating without notice permits rent adjustment from deposit.
                </p>
              </div>

              {customRules.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs pb-0.5 mb-1" style={{ borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}>
                    IV. HOUSE REGULATIONS & SPECIAL CONDITIONS
                  </h4>
                  <ol className="list-decimal pl-4 space-y-0.5 font-sans text-[10px]" style={{ color: "#334155" }}>
                    {customRules.map((rule, idx) => (
                      <li key={idx} className="leading-snug">
                        {rule}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div>
                <h4 className="font-bold text-xs pb-0.5 mb-1" style={{ borderBottom: "1px solid #cbd5e1", color: "#0f172a" }}>
                  V. GOVERNING LAW & JURISDICTION
                </h4>
                <p className="text-[10px] font-sans" style={{ color: "#475569" }}>
                  Governed by the Laws of India & Karnataka Rent Control regulations. Disputes subject to exclusive jurisdiction of civil courts at {property.locality_details?.city_name || "Hubli-Dharwad"}, Karnataka.
                </p>
              </div>
            </div>

            {/* SIGNATURE SECTION */}
            <div className="mt-4 pt-3 font-sans" style={{ borderTop: "2px solid #0f172a" }}>
              <p className="font-bold text-[9.5px] uppercase tracking-wider mb-2 text-center" style={{ color: "#0f172a" }}>
                IN WITNESS WHEREOF, Landlord and Tenant have signed this agreement on {currentDate}.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Landlord Signature Box */}
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1" }}
                >
                  <div 
                    className="h-16 mb-1 relative rounded flex items-center justify-center"
                    style={{ backgroundColor: "#ffffff", border: "1px border-dashed #cbd5e1", borderBottom: "2px solid #0f172a" }}
                  >
                    <SignatureCanvas
                      ref={ownerSigRef}
                      penColor="#0f172a"
                      canvasProps={{ className: "w-full h-full" }}
                    />
                    <button
                      type="button"
                      onClick={() => clearSignature(ownerSigRef)}
                      className="print-hidden absolute top-1 right-1 text-[9px] bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-800 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[10px] font-black uppercase" style={{ color: "#0f172a" }}>LANDLORD SIGNATURE</p>
                  <p className="text-[9.5px] font-bold" style={{ color: "#1e293b" }}>{landlordName} {landlordPhone && `(${landlordPhone})`}</p>
                </div>

                {/* Tenant Signature Box */}
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1" }}
                >
                  <div 
                    className="h-16 mb-1 relative rounded flex items-center justify-center"
                    style={{ backgroundColor: "#ffffff", border: "1px border-dashed #cbd5e1", borderBottom: "2px solid #0f172a" }}
                  >
                    <SignatureCanvas
                      ref={tenantSigRef}
                      penColor="#0f172a"
                      canvasProps={{ className: "w-full h-full" }}
                    />
                    <button
                      type="button"
                      onClick={() => clearSignature(tenantSigRef)}
                      className="print-hidden absolute top-1 right-1 text-[9px] bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-800 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[10px] font-black uppercase" style={{ color: "#0f172a" }}>TENANT SIGNATURE</p>
                  <p className="text-[9.5px] font-bold" style={{ color: "#1e293b" }}>{tenantName || "____________________"} {tenantPhone && `(${tenantPhone})`}</p>
                </div>
              </div>

              {/* WITNESS SECTION */}
              <div className="grid grid-cols-2 gap-4 mt-3 pt-2 text-[9.5px]" style={{ borderTop: "1px solid #cbd5e1" }}>
                <div>
                  <span className="font-bold" style={{ color: "#1e293b" }}>Witness 1:</span> <span style={{ color: "#94a3b8" }}>__________________________</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: "#1e293b" }}>Witness 2:</span> <span style={{ color: "#94a3b8" }}>__________________________</span>
                </div>
              </div>
            </div>
          </div>

          {/* SINGLE PAGE FOOTER */}
          <div className="mt-3 pt-2 text-center text-[9px] font-sans" style={{ borderTop: "1px solid #cbd5e1", color: "#64748b" }}>
            Generated via Rentlo 1-Sheet Legal Builder on {currentDate}. Certificate Ref: {docId}.
          </div>

        </div>
      </div>
    </div>
  );
};
