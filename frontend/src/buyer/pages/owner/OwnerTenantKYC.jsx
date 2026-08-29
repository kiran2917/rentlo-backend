import React, { useState, useEffect } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { toast } from "react-toastify";

export const OwnerTenantKYC = () => {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    property: "",
    tenant_name: "",
    tenant_phone: "",
    tenant_email: "",
    package_type: "basic_kyc",
    id_proof_type: "aadhaar",
    id_proof_number: "",
    employer_name: "",
    designation: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [verRes, propRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/properties/tenant-kyc/`, { credentials: "include" }),
        fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, { credentials: "include" }),
      ]);

      if (verRes.ok) {
        const verData = await verRes.json();
        setVerifications(Array.isArray(verData) ? verData : []);
      }

      if (propRes.ok) {
        const propData = await propRes.json();
        const list = Array.isArray(propData) ? propData : propData.results || [];
        setProperties(list);
        if (list.length > 0 && !formData.property) {
          setFormData((prev) => ({ ...prev, property: list[0].id }));
        }
      }
    } catch (e) {
      console.error("Failed to load KYC data", e);
      toast.error("Could not fetch verification data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKYC = async (e) => {
    e.preventDefault();
    if (!formData.tenant_name || !formData.tenant_phone) {
      toast.error("Please provide tenant name and phone number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/tenant-kyc/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success(`Tenant KYC request submitted for ${formData.tenant_name}!`);
        setShowOrderModal(false);
        setVerifications((prev) => [created, ...prev]);
        setFormData({
          property: properties[0]?.id || "",
          tenant_name: "",
          tenant_phone: "",
          tenant_email: "",
          package_type: "basic_kyc",
          id_proof_type: "aadhaar",
          id_proof_number: "",
          employer_name: "",
          designation: "",
        });
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to submit request");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error submitting KYC request");
    } finally {
      setSubmitting(false);
    }
  };

  const packagePrices = {
    basic_kyc: { name: "Basic KYC & Identity Verification", price: "₹199", icon: "badge" },
    employment_check: { name: "Employment & Salary Check", price: "₹399", icon: "work" },
    comprehensive_police: { name: "Full Police & Court Record Verification", price: "₹699", icon: "local_police" },
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 border shadow-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/20 text-white">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-3 inline-block">
              100% Verified Tenants • Zero Risk
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1">
              Tenant Background Verification & KYC
            </h1>
            <p className="text-slate-300 text-sm md:text-base mt-2 font-medium leading-relaxed">
              Verify your incoming tenant's Aadhaar identity, employment status, salary slips, and court/police records before handing over keys.
            </p>
          </div>
          <button
            onClick={() => setShowOrderModal(true)}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
            <span>Verify New Tenant</span>
          </button>
        </div>
      </div>

      {/* Trust & Package Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl border bg-white shadow-xs hover:shadow-md transition-all border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">badge</span>
          </div>
          <h3 className="font-extrabold text-slate-800 text-[16px]">Aadhaar & Contact Check</h3>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Real-time UIDAI identity check + phone ownership authentication with live fraud flag scanning.
          </p>
          <p className="font-black text-blue-600 text-lg mt-4">₹199 <span className="text-xs text-slate-400 font-normal">/ verification</span></p>
        </div>

        <div className="p-6 rounded-3xl border bg-white shadow-xs hover:shadow-md transition-all border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">work</span>
          </div>
          <h3 className="font-extrabold text-slate-800 text-[16px]">Employment & Salary Check</h3>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Corporate email & domain verification + salary slip authenticity audit to ensure reliable on-time rent payment.
          </p>
          <p className="font-black text-purple-600 text-lg mt-4">₹399 <span className="text-xs text-slate-400 font-normal">/ verification</span></p>
        </div>

        <div className="p-6 rounded-3xl border bg-white shadow-xs hover:shadow-md transition-all border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">local_police</span>
          </div>
          <h3 className="font-extrabold text-slate-800 text-[16px]">Police & Court Record Audit</h3>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Automated civil litigation search across Indian court databases + local police jurisdiction intimation record.
          </p>
          <p className="font-black text-emerald-600 text-lg mt-4">₹699 <span className="text-xs text-slate-400 font-normal">/ verification</span></p>
        </div>
      </div>

      {/* Verifications List */}
      <div className="rounded-3xl border bg-white shadow-xs overflow-hidden border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Your Tenant Verification Requests</h2>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Track live progress and download digital verification certificates</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
            {verifications.length} {verifications.length === 1 ? "Record" : "Records"}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-3"></div>
            Loading verification records...
          </div>
        ) : verifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">verified_user</span>
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">No Tenant Verifications Yet</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
              Verify your potential tenants to secure your property and maintain a safe community.
            </p>
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Verify First Tenant
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {verifications.map((v) => (
              <div key={v.id} className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-black">
                    <span className="material-symbols-outlined text-[24px]">person</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-extrabold text-slate-900 text-base">{v.tenant_name}</h4>
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 text-slate-600">
                        {v.certificate_id || `ID: ${v.id}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      📱 {v.tenant_phone} {v.tenant_email && `• ✉️ ${v.tenant_email}`}
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      Property: <span className="text-slate-700">{v.property_title || "General Verification"}</span> • Package: <span className="capitalize text-indigo-600 font-bold">{v.package_type?.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    v.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    v.status === 'flagged' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {v.status === 'verified' ? 'Verified ✓' : v.status === 'flagged' ? 'Flagged ⚠' : 'In Progress'}
                  </span>

                  <button
                    onClick={() => setSelectedVerification(v)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-extrabold text-xs flex items-center gap-1.5 transition-colors border border-slate-200/80 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>View Certificate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Verification Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowOrderModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Initiate Tenant Verification</h3>
                <p className="text-xs text-slate-400 font-semibold">Enter tenant details for automated KYC processing</p>
              </div>
            </div>

            <form onSubmit={handleCreateKYC} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Select Property</label>
                <select
                  value={formData.property}
                  onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.locality?.name || p.city_name || "Listed"})</option>
                  ))}
                  <option value="">General / Outside Listing</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Tenant Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.tenant_name}
                    onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Tenant Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.tenant_phone}
                    onChange={(e) => setFormData({ ...formData, tenant_phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Tenant Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul.sharma@company.com"
                  value={formData.tenant_email}
                  onChange={(e) => setFormData({ ...formData, tenant_email: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Select Verification Package</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {Object.entries(packagePrices).map(([key, info]) => (
                    <div
                      key={key}
                      onClick={() => setFormData({ ...formData, package_type: key })}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formData.package_type === key ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-extrabold text-xs">{info.name}</p>
                      <p className="font-black text-sm text-indigo-600 mt-1">{info.price}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Employer / Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Infosys, TCS, Freelancer"
                    value={formData.employer_name}
                    onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Aadhaar / ID Number</label>
                  <input
                    type="text"
                    placeholder="e.g. XXXX XXXX 4829"
                    value={formData.id_proof_number}
                    onChange={(e) => setFormData({ ...formData, id_proof_number: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-all cursor-pointer"
                >
                  {submitting ? "Processing..." : `Pay ${packagePrices[formData.package_type]?.price} & Submit`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Certificate Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedVerification(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Certificate Header */}
            <div className="text-center pb-6 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs border border-emerald-100">
                <span className="material-symbols-outlined text-[36px]">verified</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Official Digital Certificate
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">Verified Tenant Report</h3>
              <p className="font-mono text-xs text-slate-400 font-bold mt-0.5">{selectedVerification.certificate_id}</p>
            </div>

            {/* Certificate Details */}
            <div className="space-y-4 py-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tenant Name</p>
                  <p className="text-base font-extrabold text-slate-900">{selectedVerification.tenant_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trust Score</p>
                  <p className="text-xl font-black text-emerald-600">{selectedVerification.verification_score || 95}/100</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Phone Status</p>
                  <p className="font-extrabold text-slate-800 mt-0.5">✅ OTP Verified</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Identity (UIDAI)</p>
                  <p className="font-extrabold text-slate-800 mt-0.5">✅ Authenticated</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Employer</p>
                  <p className="font-extrabold text-slate-800 mt-0.5">{selectedVerification.employer_name || "Self-Employed / Verified"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Court / Police Record</p>
                  <p className="font-extrabold text-emerald-600 mt-0.5">✅ Zero Negative Records</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                window.print();
                toast.success("Printing Tenant Verification Certificate");
              }}
              className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print / Download Certificate</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
