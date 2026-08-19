import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";

export const AgentKYCModal = ({ user, onClose, onRefreshUser }) => {
  const [activeStep, setActiveStep] = useState(user?.force_password_change ? "password" : "kyc");
  const [loading, setLoading] = useState(false);
  const [kycData, setKycData] = useState(null);

  // WebCam Camera State
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      toast.error("Could not access camera. Please allow camera permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const captureSelfieSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setFormData((prev) => ({ ...prev, selfie_url: dataUrl }));
    toast.success("Live Selfie captured! 📸");
    stopCamera();
  };

  // Password Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // KYC Form State
  const [formData, setFormData] = useState({
    aadhaar_number: "",
    aadhaar_front_url: "",
    aadhaar_back_url: "",
    pan_number: "",
    pan_card_url: "",
    karnataka_rera_no: "",
    driving_license_no: "",
    selfie_url: "",
    upi_id: "",
    account_holder_name: "",
    bank_account_number: "",
    ifsc_code: "",
    bank_name: "",
  });

  useEffect(() => {
    fetchKYC();
  }, []);

  const fetchKYC = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/agent/kyc/`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setKycData(data);
        setFormData({
          aadhaar_number: data.aadhaar_number || "",
          aadhaar_front_url: data.aadhaar_front_url || "",
          aadhaar_back_url: data.aadhaar_back_url || "",
          pan_number: data.pan_number || "",
          pan_card_url: data.pan_card_url || "",
          karnataka_rera_no: data.karnataka_rera_no || "",
          driving_license_no: data.driving_license_no || "",
          selfie_url: data.selfie_url || "",
          upi_id: data.upi_id || "",
          account_holder_name: data.account_holder_name || "",
          bank_account_number: data.bank_account_number || "",
          ifsc_code: data.ifsc_code || "",
          bank_name: data.bank_name || "",
        });
      }
    } catch (err) {
      console.error("Failed to load KYC details", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (res.ok) {
        toast.success("Password updated successfully!");
        setNewPassword("");
        setConfirmPassword("");
        if (onRefreshUser) onRefreshUser();
        setActiveStep("kyc");
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to update password.");
      }
    } catch (err) {
      toast.error("Network error updating password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleFileUpload = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, [fieldName]: reader.result }));
      toast.info(`Uploaded file for ${fieldName.replace("_url", "").replace(/_/g, " ")}`);
    };
    reader.readAsDataURL(file);
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    if (!formData.aadhaar_number || formData.aadhaar_number.length < 12) {
      toast.error("Please enter a valid 12-digit Aadhaar Card number.");
      return;
    }
    if (!formData.pan_number || formData.pan_number.length < 10) {
      toast.error("Please enter a valid 10-character PAN Card number.");
      return;
    }
    if (!formData.upi_id && !formData.bank_account_number) {
      toast.error("Please provide at least a UPI ID or Bank Account for receiving payouts.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/agent/kyc/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("KYC & Bank details submitted for Admin review!");
        fetchKYC();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to submit KYC details.");
      }
    } catch (err) {
      toast.error("Network error submitting KYC.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 rounded-3xl border shadow-2xl overflow-hidden transition-all" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        
        {/* Header Banner */}
        <div className="p-6 border-b flex items-center justify-between" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: "var(--accent)" }}>
              <span className="material-symbols-outlined text-[26px]">badge</span>
            </div>
            <div>
              <h2 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
                Agent Onboarding &amp; KYC Verification
              </h2>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                Karnataka Partner Compliance • Payout Bank Setup • Identity Audit
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full border flex items-center justify-center hover:opacity-80 transition-all cursor-pointer"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b px-6 pt-3 gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          {user?.force_password_change && (
            <button
              onClick={() => setActiveStep("password")}
              className="px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
              style={{
                borderColor: activeStep === "password" ? "var(--accent)" : "transparent",
                color: activeStep === "password" ? "var(--ink)" : "var(--text-muted)",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              1. Change Password {user?.force_password_change && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
            </button>
          )}
          <button
            onClick={() => setActiveStep("kyc")}
            className="px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
            style={{
              borderColor: activeStep === "kyc" ? "var(--accent)" : "transparent",
              color: activeStep === "kyc" ? "var(--ink)" : "var(--text-muted)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            2. Karnataka KYC &amp; Bank Setup
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          
          {/* STEP 1: CHANGE TEMPORARY PASSWORD */}
          {activeStep === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md mx-auto py-4">
              <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">key</span>
                <div>
                  <h4 className="text-[13px] font-bold text-amber-500">First-Time Login Security Update</h4>
                  <p className="text-[11px] text-amber-400/90 mt-0.5">
                    Your account was provisioned with a temporary password. Please set your new private password before continuing.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  required
                  className="w-full h-11 px-4 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full h-11 px-4 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                />
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full h-11 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white font-extrabold text-[13px] uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {updatingPassword ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Update &amp; Save Password
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: KARNATAKA KYC & BANK SETUP */}
          {activeStep === "kyc" && (
            <div className="space-y-6">
              
              {/* Status Badge Notification */}
              {kycData && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
                  kycData.status === 'verified'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : kycData.status === 'submitted'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : kycData.status === 'rejected'
                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                    : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[24px]">
                      {kycData.status === 'verified' ? 'verified' : kycData.status === 'submitted' ? 'hourglass_top' : kycData.status === 'rejected' ? 'gavel' : 'help_outline'}
                    </span>
                    <div>
                      <h4 className="text-[14px] font-extrabold uppercase tracking-wide">
                        Status: {kycData.status === 'verified' ? 'Verified Partner' : kycData.status === 'submitted' ? 'Under Review' : kycData.status === 'rejected' ? 'Verification Rejected' : 'Action Required'}
                      </h4>
                      <p className="text-[11.5px] opacity-90 mt-0.5">
                        {kycData.status === 'verified'
                          ? 'Your Karnataka Field Partner KYC and Bank details are approved. You can post listings and receive instant payouts.'
                          : kycData.status === 'submitted'
                          ? 'Your documents have been submitted. Super Admin will verify within 24 hours.'
                          : kycData.status === 'rejected'
                          ? `Reason: ${kycData.rejection_reason || 'Information invalid.'}`
                          : 'Please complete Aadhaar, PAN, Selfie, and Payout Bank details to activate earnings.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleKYCSubmit} className="space-y-6">
                
                {/* 1. Identity & Government ID Section */}
                <div className="rounded-2xl p-6 border shadow-sm space-y-4" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[14px] font-extrabold uppercase tracking-widest flex items-center gap-2 border-b pb-3" style={{ color: "var(--ink)", borderColor: "var(--border)" }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--accent)" }}>badge</span>
                    1. Government ID Proofs (Karnataka Partner Compliance)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Aadhaar */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Aadhaar Number (12 Digits) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength="12"
                        value={formData.aadhaar_number}
                        onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                        placeholder="1234 5678 9012"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                        required
                      />
                    </div>

                    {/* PAN Card */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        PAN Card Number (10 Chars) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength="10"
                        value={formData.pan_number}
                        onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm uppercase"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                        required
                      />
                    </div>

                    {/* Karnataka RERA / License */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Karnataka RERA No / Driving License
                      </label>
                      <input
                        type="text"
                        value={formData.karnataka_rera_no}
                        onChange={(e) => setFormData({ ...formData, karnataka_rera_no: e.target.value })}
                        placeholder="PRM/KA/RERA/... or KA-01-..."
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>

                    {/* Driving License optional */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Voter ID / DL Number
                      </label>
                      <input
                        type="text"
                        value={formData.driving_license_no}
                        onChange={(e) => setFormData({ ...formData, driving_license_no: e.target.value })}
                        placeholder="KA0520210012345"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>
                  </div>

                  {/* Image Upload Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    {[
                      { key: "aadhaar_front_url", label: "Aadhaar Front" },
                      { key: "aadhaar_back_url", label: "Aadhaar Back" },
                      { key: "pan_card_url", label: "PAN Photo" },
                      { key: "selfie_url", label: "Live Selfie", isCamera: true },
                    ].map((doc) => (
                      <div key={doc.key} className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
                          {doc.label}
                        </label>

                        {doc.isCamera ? (
                          <div className="relative border-2 border-dashed rounded-xl h-24 flex flex-col items-center justify-center overflow-hidden cursor-pointer group border-orange-400/60 bg-orange-500/5 hover:bg-orange-500/10 transition-all">
                            {formData[doc.key] ? (
                              <div className="relative w-full h-full group">
                                <img src={formData[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                                {kycData?.status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={startCamera}
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-black uppercase transition-all"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                                    Retake Selfie
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={startCamera}
                                disabled={kycData?.status === 'verified'}
                                className="flex flex-col items-center justify-center text-center p-2 w-full h-full cursor-pointer disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[24px] text-orange-600 animate-pulse">photo_camera</span>
                                <span className="text-[10px] font-black text-orange-600 mt-1 uppercase tracking-wider">
                                  📷 Open Camera
                                </span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="relative border-2 border-dashed rounded-xl h-24 flex flex-col items-center justify-center overflow-hidden cursor-pointer group" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                            {formData[doc.key] ? (
                              <img src={formData[doc.key]} alt={doc.label} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center p-2">
                                <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--text-muted)" }}>upload_file</span>
                                <span className="text-[9px] font-bold mt-1" style={{ color: "var(--text-muted)" }}>Upload {doc.label}</span>
                              </div>
                            )}
                            {kycData?.status !== 'verified' && (
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, doc.key)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Instant Admin Payout Details */}
                <div className="rounded-2xl p-6 border shadow-sm space-y-4" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[14px] font-extrabold uppercase tracking-widest flex items-center gap-2 border-b pb-3" style={{ color: "var(--ink)", borderColor: "var(--border)" }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--accent)" }}>account_balance</span>
                    2. Instant Admin Payout Bank &amp; UPI Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* UPI ID */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Default Payout UPI ID (Instant Commission Payouts) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.upi_id}
                        onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                        placeholder="e.g. agentname@okaxis / phonepe@upi"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                        required
                      />
                    </div>

                    {/* Bank Account Holder */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={formData.account_holder_name}
                        onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                        placeholder="Full Name as in Bank Account"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>

                    {/* Bank Account Number */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.bank_account_number}
                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                        placeholder="9120100XXXXXXX"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>

                    {/* IFSC Code */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Bank IFSC Code
                      </label>
                      <input
                        type="text"
                        value={formData.ifsc_code}
                        onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                        placeholder="SBIN0001234"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm uppercase"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>

                    {/* Bank Name */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="HDFC Bank / State Bank of India"
                        disabled={kycData?.status === 'verified'}
                        className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                {kycData?.status !== 'verified' && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white font-extrabold text-[13px] uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">send</span>
                        Submit Verification &amp; Bank Details
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Real-time WebCam Camera Viewfinder Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl flex flex-col items-center animate-in zoom-in duration-200">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-white text-[15px] font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[20px]">photo_camera</span>
                Capture Live Selfie
              </h3>
              <button
                type="button"
                onClick={stopCamera}
                className="text-slate-400 hover:text-white font-extrabold text-[16px] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Video Viewfinder with Face Frame Guide */}
            <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-orange-500/50 shadow-inner flex items-center justify-center mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {/* Oval Face Guide Overlay */}
              <div className="absolute inset-0 border-[3px] border-dashed border-orange-400/70 rounded-full m-8 pointer-events-none flex items-center justify-center">
                <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full">
                  Position Face Inside Oval
                </span>
              </div>
            </div>

            {/* Camera Action Buttons */}
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-extrabold uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureSelfieSnap}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-black uppercase rounded-xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">camera</span>
                Snap Selfie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
