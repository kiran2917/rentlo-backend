import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";

export const OtpModal = ({ onSuccess, onClose, intendedRole = "buyer" }) => {
  const { checkAuth } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpStep, setOtpStep] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("otp_signup"); // "otp_signup" or "password_login"
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [requireOtp, setRequireOtp] = useState(true);
  const [demoCode, setDemoCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [dpdpConsent, setDpdpConsent] = useState(true);

  // The backend determines if OTP is required for this specific phone/role combo
  // during the /auth/buyer-otp/request/ call.
  // We initialize to true, and if the backend tells us both are disabled on mount, or upon submission it's disabled, we update this state.

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`);
        if (res.ok) {
          const data = await res.json();
          const loginReq = data[`${intendedRole}_require_otp_login`];
          const signupReq = data[`${intendedRole}_require_otp_signup`];
          
          // If both login and signup OTP are explicitly disabled for this role, we can safely hide the Code step upfront.
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
          verifyCode("000000", false); // Immediately verify bypass, passing explicitly false
        }
      } else {
        const data = await res.json();
        setOtpError(data.detail || "Failed to authenticate phone number");
      }
    } catch {
      setOtpError("Network error");
    } finally {
      // Don't disable loading if we're bypassing to verification
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
          setOtpError(data.detail || "Failed to verify code");
        }
      }
    } catch {
      setOtpError("Network error");
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
      setOtpError("Password is mandatory and must be at least 6 characters long.");
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
      setOtpError("Network error");
    } finally {
      setOtpLoading(false);
    }
  };

  const steps = authMode === "password_login" ? [] : requireOtp ? ["Phone", "Code", "Name"] : ["Phone", "Name"];

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
      setOtpError("Network error.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl p-7 sm:p-9 border border-white/50 shadow-2xl shadow-slate-950/30 focus:outline-none overflow-hidden transition-all"
        tabIndex="-1"
      >
        {/* Top Glowing Gradient Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 absolute top-0 left-0 right-0 shadow-sm" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all duration-200 hover:rotate-90 z-10 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>

        {/* Step indicator */}
        {steps.length > 0 && (
          <div className="flex items-center gap-2 mb-6 pr-8 mt-1">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
                      i + 1 < otpStep
                        ? "bg-emerald-600 text-white shadow-sm"
                        : i + 1 === otpStep
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-500/20"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1 < otpStep ? (
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                        check
                      </span>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[12px] font-bold hidden sm:block ${
                      i + 1 === otpStep ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 bg-slate-100 rounded-full" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Icon Header */}
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mb-5 shadow-sm">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            {otpStep === 1 ? "phone_iphone" : requireOtp && otpStep === 2 ? "dialpad" : "badge"}
          </span>
        </div>

        {otpStep === 1 && (
          <>
            <h2
              id="otp-modal-title"
              className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1"
            >
              {intendedRole === "owner" ? "List Your Property" : "Welcome Back"}
            </h2>
            <p className="text-[13px] text-slate-500 font-medium mb-6">
              {intendedRole === "owner" 
                ? "Enter your mobile number to start listing properties." 
                : "Sign in or enter your mobile number to save this search & receive instant property alerts."}
            </p>

            <div className="mb-5 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Mobile Number
              </label>
              
              <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/15 transition-all">
                <div className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-100 border-r border-slate-200 text-slate-700 font-bold text-[13px] flex-shrink-0">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                  placeholder="98765 43210"
                  className="w-full h-12 px-4 text-[15px] font-bold text-slate-900 bg-transparent outline-none placeholder:text-slate-400 placeholder:font-medium"
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
              <div className="mb-5 space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 rounded-2xl px-4 text-[14px] font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phone.replace(/[^0-9]/g, "").length >= 10 && password) handlePasswordLogin();
                  }}
                />
              </div>
            )}

            {/* DPDP Act Consent Checkbox */}
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                id="dpdp-consent-modal"
                checked={dpdpConsent}
                onChange={(e) => setDpdpConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="dpdp-consent-modal" className="text-[11px] font-medium leading-relaxed text-slate-600 cursor-pointer">
                I agree to the <span className="font-extrabold text-slate-900">Privacy Policy (v1.0)</span> and consent to data processing under DPDP Act protocols.
              </label>
            </div>

            {otpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
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
              className="w-full h-12 rounded-2xl text-[14px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:scale-98 cursor-pointer mb-4 flex items-center justify-center gap-2"
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
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "otp_signup" ? "password_login" : "otp_signup");
                  setOtpError("");
                }}
                className="text-[13px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {authMode === "otp_signup" 
                  ? "Already have an account? Sign in with password" 
                  : "New user or forgot password? Sign in with OTP"}
              </button>
            </div>
          </>
        )}

        {requireOtp && otpStep === 2 && (
          <>
            <h2 id="otp-modal-title" className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
              Enter Verification Code
            </h2>
            <div className="text-[13px] text-slate-500 font-medium mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span>Code sent to <strong className="text-slate-900">{phone}</strong></span>
                <button 
                  onClick={() => setOtpStep(1)} 
                  className="font-bold text-emerald-600 hover:underline"
                >
                  Edit Number
                </button>
              </div>
              {demoCode && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                  <span className="text-[12px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">key</span>
                    Dev OTP: <span className="font-extrabold tracking-widest text-emerald-900">{demoCode}</span>
                  </span>
                  <button 
                    onClick={() => setCode(demoCode)}
                    className="text-[11px] font-extrabold px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    Auto-fill
                  </button>
                </div>
              )}
            </div>

            <div className="mb-5 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                maxLength={6}
                className="w-full h-12 rounded-2xl px-4 text-[18px] font-black tracking-[0.5em] text-center text-slate-900 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) verifyCode(code);
                }}
              />
            </div>

            {otpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold text-center">
                {otpError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setOtpStep(1)}
                className="w-1/3 h-12 rounded-2xl text-[14px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => verifyCode(code)}
                disabled={code.length < 6 || otpLoading}
                className="w-2/3 h-12 rounded-2xl text-[14px] font-extrabold bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white shadow-md transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {otpLoading ? "Verifying…" : "Verify & Continue"}
              </button>
            </div>
          </>
        )}

        {otpStep === (requireOtp ? 3 : 2) && (
          <>
            <h2 id="otp-modal-title" className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
              What's your name?
            </h2>
            <p className="text-[13px] text-slate-500 font-medium mb-6">
              Complete registration to start searching or listing properties.
            </p>

            <div className="mb-4 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Your Full Name
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuyerName(val.charAt(0).toUpperCase() + val.slice(1));
                }}
                placeholder="Rahul Sharma"
                className="w-full h-12 rounded-2xl px-4 text-[14px] font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetName();
                }}
              />
            </div>

            <div className="mb-5 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Create Account Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full h-12 rounded-2xl px-4 text-[14px] font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetName();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOtpStep(requireOtp ? 2 : 1)}
                className="w-1/3 h-12 rounded-2xl text-[14px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSetName}
                disabled={!buyerName.trim() || !password.trim() || otpLoading}
                className="w-2/3 h-12 rounded-2xl text-[14px] font-extrabold bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white shadow-md transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {otpLoading ? "Creating Account…" : "Complete Registration"}
              </button>
            </div>
          </>
        )}

        {otpStep === (requireOtp ? 4 : 3) && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <span className="material-symbols-outlined text-[32px]">block</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
              Account Banned
            </h2>
            <p className="text-[14px] text-slate-600 mb-8 leading-relaxed">
              Your account has been permanently suspended due to policy violations. You can no longer access this platform.
            </p>
            <button
              onClick={onClose}
              className="w-full h-12 rounded-2xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
