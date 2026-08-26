import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { PrivacyPolicyModal } from "../../shared/components/PrivacyPolicyModal";

export const OtpModal = ({ onSuccess, onClose, intendedRole = "buyer", title, subtitle }) => {
  const { checkAuth } = useAuth();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpStep, setOtpStep] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState("otp_signup"); // "otp_signup" or "password_login"
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [requireOtp, setRequireOtp] = useState(true);
  const [demoCode, setDemoCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [dpdpConsent, setDpdpConsent] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`);
        if (res.ok) {
          const data = await res.json();
          const loginReq = data[`${intendedRole}_require_otp_login`];
          const signupReq = data[`${intendedRole}_require_otp_signup`];
          
          if (loginReq === false && signupReq === false) {
            setRequireOtp(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings for OTP modal", err);
      }
    };
    fetchSettings();
  }, [intendedRole]);

  const handlePhoneSubmit = async () => {
    if (!dpdpConsent) {
      setOtpError("Please agree to the Privacy Policy to continue.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/buyer-otp/request/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, intended_role: intendedRole }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const serverRequiresOtp = data.require_otp;
        setRequireOtp(serverRequiresOtp);
        if (data.demo_code) {
          setDemoCode(data.demo_code);
        }
        
        if (serverRequiresOtp) {
          setOtpStep(2); // Code step
        } else {
          verifyCode("000000", false); // Immediately verify bypass
        }
      } else {
        const data = await res.json();
        setOtpError(data.detail || "Failed to authenticate phone number");
      }
    } catch {
      setOtpError("Network connection error. Please try again.");
    } finally {
      if (otpStep === 1 || requireOtp) setOtpLoading(false);
    }
  };

  const verifyCode = async (codeToVerify, isRequireOtp = requireOtp) => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, code: codeToVerify, intended_role: intendedRole }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.is_new_user) {
          setRegistrationToken(data.registration_token);
          setOtpStep(isRequireOtp ? 3 : 2); // Name step
        } else {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          await checkAuth();
          onSuccess(undefined, phone);
        }
      } else {
        const data = await res.json();
        if (data.is_banned) {
          setOtpStep(isRequireOtp ? 4 : 3); // Banned step
        } else {
          setOtpError(data.detail || "Invalid verification code");
        }
      }
    } catch {
      setOtpError("Network connection error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSetName = async () => {
    if (!buyerName || !buyerName.trim()) {
      setOtpError("Full Name is mandatory for registration.");
      return;
    }
    if (!password || password.length < 6) {
      setOtpError("Password must be at least 6 characters long.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const payload = {
        registration_token: registrationToken,
        first_name: buyerName.trim(),
        password: password,
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete-registration/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        await checkAuth();
        onSuccess(buyerName, phone);
      } else {
        const data = await res.json();
        setOtpError(data.detail || "Failed to complete registration");
      }
    } catch {
      setOtpError("Network connection error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const steps = authMode === "password_login" ? [] : requireOtp ? ["Phone", "Code", "Account"] : ["Phone", "Account"];

  const handlePasswordLogin = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: phone, password: password }),
      });
      if (res.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        await checkAuth();
        onSuccess(undefined, phone);
      } else {
        const data = await res.json();
        setOtpError(data.detail || "Invalid phone number or password.");
      }
    } catch {
      setOtpError("Network connection error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-[28px] p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-slate-950/40 focus:outline-none overflow-hidden transition-all duration-300"
        tabIndex="-1"
      >
        {/* Top Glowing Ambient Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 absolute top-0 left-0 right-0" />

        {/* Ambient Top Glow Effect */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all duration-200 hover:rotate-90 z-10 cursor-pointer shadow-2xs"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Step Stepper Header */}
        {steps.length > 0 && (
          <div className="flex items-center gap-2 mb-6 pr-8 mt-1">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-300 ${
                      i + 1 < otpStep
                        ? "bg-emerald-600 text-white shadow-sm"
                        : i + 1 === otpStep
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {i + 1 < otpStep ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider hidden sm:block ${
                      i + 1 === otpStep ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors duration-300 ${
                      i + 1 < otpStep ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Dynamic Icon Badge */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
          <span className="material-symbols-outlined text-[24px]">
            {otpStep === 1 ? "phone_iphone" : requireOtp && otpStep === 2 ? "mark_email_read" : "person_add"}
          </span>
        </div>

        {/* STEP 1: Phone / Password */}
        {otpStep === 1 && (
          <>
            <h2
              id="otp-modal-title"
              className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1.5"
            >
              {title || (intendedRole === "owner" ? "List Your Property" : "Welcome Back")}
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mb-5 leading-relaxed">
              {subtitle || (intendedRole === "owner" 
                ? "Enter your mobile number to start listing verified properties." 
                : "Sign in or enter your mobile number to continue.")}
            </p>

            <div className="mb-4 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Mobile Number
              </label>
              
              <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 overflow-hidden focus-within:border-indigo-600 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-4 focus-within:ring-indigo-500/15 transition-all shadow-2xs">
                <div className="flex items-center gap-1 px-3.5 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-[13px] select-none flex-shrink-0">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                  placeholder="98765 43210"
                  className="w-full h-11 px-3.5 text-[15px] font-bold text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 placeholder:font-medium tracking-wide"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phone.replace(/[^0-9]/g, "").length >= 10) {
                      if (authMode === "password_login") {
                        if (password) handlePasswordLogin();
                      } else {
                        handlePhoneSubmit();
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {authMode === "password_login" && (
              <div className="mb-4 space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full h-11 rounded-2xl px-3.5 pr-10 text-[14px] font-bold text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/15 outline-none transition-all shadow-2xs placeholder:text-slate-400 placeholder:font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phone.replace(/[^0-9]/g, "").length >= 10 && password) handlePasswordLogin();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* DPDP Act Consent Checkbox */}
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
              <input
                type="checkbox"
                id="dpdp-consent-modal"
                checked={dpdpConsent}
                onChange={(e) => setDpdpConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-600"
              />
              <label htmlFor="dpdp-consent-modal" className="text-[11.5px] font-medium leading-relaxed text-slate-600 dark:text-slate-400 cursor-pointer">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPrivacyModal(true);
                  }}
                  className="font-bold underline text-indigo-600 dark:text-indigo-400 hover:opacity-80 cursor-pointer"
                >
                  Privacy Policy (v1.0)
                </button>{" "}
                and consent to data processing under DPDP Act protocols.
              </label>
            </div>

            {otpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-shake">
                <span className="material-symbols-outlined text-[17px] flex-shrink-0">error</span>
                <span>{otpError}</span>
              </div>
            )}

            <button
              onClick={() => {
                if (!dpdpConsent) {
                  setOtpError("Please agree to the Privacy Policy to continue.");
                  return;
                }
                if (phone.replace(/[^0-9]/g, "").length < 10) {
                  setOtpError("Please enter a valid 10-digit mobile number.");
                  return;
                }
                if (authMode === "password_login" && !password) {
                  setOtpError("Please enter your account password.");
                  return;
                }
                if (authMode === "password_login") {
                  handlePasswordLogin();
                } else {
                  handlePhoneSubmit();
                }
              }}
              disabled={otpLoading}
              className="w-full h-12 rounded-2xl text-[14px] font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer mb-3.5 flex items-center justify-center gap-2 tracking-wide"
            >
              {otpLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
            
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "otp_signup" ? "password_login" : "otp_signup");
                  setOtpError("");
                }}
                className="text-[12px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors"
              >
                {authMode === "otp_signup" 
                  ? "Already have an account? Sign in with password" 
                  : "New user or forgot password? Sign in with OTP"}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Verification Code */}
        {requireOtp && otpStep === 2 && (
          <>
            <h2 id="otp-modal-title" className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1.5">
              Enter Verification Code
            </h2>
            <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mb-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span>Code sent to <strong className="text-slate-900 dark:text-white font-bold">{phone}</strong></span>
                <button 
                  onClick={() => setOtpStep(1)} 
                  className="font-extrabold text-[12px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit Number
                </button>
              </div>
              {demoCode && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">key</span>
                    Dev OTP: <span className="font-black tracking-widest text-slate-900 dark:text-white">{demoCode}</span>
                  </span>
                  <button 
                    onClick={() => setCode(demoCode)}
                    className="text-[11px] font-black px-2.5 py-0.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    Auto-fill
                  </button>
                </div>
              )}
            </div>

            <div className="mb-5 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="••••••"
                maxLength={6}
                autoFocus
                className="w-full h-12 rounded-2xl px-4 text-xl font-black tracking-[0.5em] text-center text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/15 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) verifyCode(code);
                }}
              />
            </div>

            {otpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-bold text-center">
                {otpError}
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => setOtpStep(1)}
                className="w-1/3 h-12 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => verifyCode(code)}
                disabled={code.length < 6 || otpLoading}
                className="w-2/3 h-12 rounded-2xl text-[13px] font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {otpLoading ? "Verifying…" : "Verify & Continue"}
              </button>
            </div>
          </>
        )}

        {/* STEP 3: Full Name & Create Password */}
        {otpStep === (requireOtp ? 3 : 2) && (
          <>
            <h2 id="otp-modal-title" className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1.5">
              Complete Your Profile
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mb-5 leading-relaxed">
              Enter your details to finalize registration and access your account.
            </p>

            <div className="mb-4 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuyerName(val.charAt(0).toUpperCase() + val.slice(1));
                }}
                placeholder="e.g. Rahul Sharma"
                autoFocus
                className="w-full h-11 rounded-2xl px-3.5 text-[14px] font-bold text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/15 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetName();
                }}
              />
            </div>

            <div className="mb-5 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Create Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-11 rounded-2xl px-3.5 pr-10 text-[14px] font-bold text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/15 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetName();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {otpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-bold text-center">
                {otpError}
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => setOtpStep(requireOtp ? 2 : 1)}
                className="w-1/3 h-12 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSetName}
                disabled={!buyerName.trim() || !password.trim() || otpLoading}
                className="w-2/3 h-12 rounded-2xl text-[13px] font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {otpLoading ? "Creating…" : "Complete Registration"}
              </button>
            </div>
          </>
        )}

        {/* STEP 4: Account Suspended / Banned */}
        {otpStep === (requireOtp ? 4 : 3) && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <span className="material-symbols-outlined text-[32px]">block</span>
            </div>
            <h2 className="text-[20px] font-black text-slate-900 dark:text-white mb-2">
              Account Suspended
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Your account has been suspended due to platform policy violations.
            </p>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Privacy Policy & DPDP Act Modal */}
      <PrivacyPolicyModal 
        isOpen={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)} 
      />
    </div>
  );
};
