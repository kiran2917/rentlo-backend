import React, { useState, useEffect } from "react";
import { useAuth } from "../../shared/context/AuthContext";
import { handleApiError } from "../../shared/utils/errorHandler";
import { loadRazorpayScript } from "../../shared/utils/razorpayLoader";
import { toast } from "react-toastify";

export const PlanSelectionModal = ({
  isOpen,
  onClose,
  propertyId,
  onSuccessUnlock
}) => {
  const { user, checkAuth } = useAuth();
  const [sub, setSub] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("smart_79");
  const [settings, setSettings] = useState(null);

  // Inline Auth State Machine: 'IDLE' | 'ENTER_PHONE' | 'ENTER_PASSWORD' | 'FORGOT_PASSWORD' | 'ENTER_OTP' | 'COMPLETE_REGISTRATION' | 'ACTIVE_PASS_DETECTED'
  const [authStep, setAuthStep] = useState("IDLE");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authedUser, setAuthedUser] = useState(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAuthStep("IDLE");
      setAuthError("");
      setAuthedUser(null);
      setIsExistingUser(false);
      setNewPassword("");
      return;
    }
    setLoadingSub(true);

    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`).then(r => r.ok ? r.json() : null)
    ]).then(([subData, settingsData]) => {
      if (subData) setSub(subData);
      if (settingsData) setSettings(settingsData);
    }).catch(err => console.error(err))
    .finally(() => setLoadingSub(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const singleFee = settings?.buyer_unlock_fee || 14;
  const starterFee = settings?.buyer_pass_starter_price || 39;
  const smartFee = settings?.buyer_pass_smart_price || 79;
  const proFee = settings?.buyer_pass_pro_price || 129;

  const PLANS = [
    {
      id: "single_14",
      name: "Single Unlock",
      price: singleFee,
      unlocks: 1,
      agreements: 0,
      badge: null,
      description: "1-time single contact lookup",
      tag: "Basic"
    },
    {
      id: "starter_39",
      name: "Starter Pass",
      price: starterFee,
      unlocks: 3,
      agreements: 0,
      badge: null,
      description: "Ideal for quick local search",
      tag: "Popular"
    },
    {
      id: "smart_79",
      name: "Smart Pass",
      price: smartFee,
      unlocks: 6,
      agreements: 1,
      badge: "BEST SELLER ⭐",
      description: "6 Unlocks + 1 Free Legal Rental Agreement",
      tag: "Best Value"
    },
    {
      id: "pro_129",
      name: "Pro Hunter Pass",
      price: proFee,
      unlocks: 10,
      agreements: 3,
      badge: "VIP VALUE 👑",
      description: "10 Unlocks + 3 Free Agreements + 45d Validity & Free Extension",
      tag: "VIP"
    }
  ];

  const handleInstantUnlock = async (activeUser = user || authedUser) => {
    if (!activeUser) {
      setAuthStep("ENTER_PHONE");
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/${propertyId}/unlock/initiate/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        }
      );
      const data = await res.json();
      if (res.ok && data.instant_unlocked) {
        toast.success("Contact details unlocked successfully!");
        onSuccessUnlock(data);
        onClose();
        window.location.reload();
      } else {
        handleApiError(res, data, "Failed to unlock property. Please check your credit balance.");
      }
    } catch (err) {
      handleApiError(null, err, "Unable to connect to server. Please check your connection.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleBuyPass = async (planId, activeUser = user || authedUser) => {
    if (!activeUser) {
      setAuthStep("ENTER_PHONE");
      return;
    }

    setPurchasing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/pass/initiate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pass_type: planId })
      });
      const orderData = await res.json();

      if (!res.ok) {
        handleApiError(res, orderData, "Failed to initiate payment gateway.");
        setPurchasing(false);
        return;
      }

      // If server returned bypass mode (dev mode / payment bypass or stacked)
      if (orderData.bypassed) {
        handleInstantUnlock(activeUser);
        return;
      }

      await loadRazorpayScript();
      if (!window.Razorpay) {
        toast.error("Unable to load Razorpay SDK. Please check your internet connection.");
        setPurchasing(false);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Rentlo Property Hub",
        description: `Purchase ${planId.replace('_', ' ').toUpperCase()} Pass`,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/pass/verify/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                pass_type: planId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              toast.success("Payment verified! Unlocking property...");
              handleInstantUnlock(activeUser);
            } else {
              handleApiError(verifyRes, verifyData, "Payment verification failed. If money was deducted, credits will apply automatically.");
              setPurchasing(false);
            }
          } catch (err) {
            handleApiError(null, err, "Verification error. Please contact support if money was deducted.");
            setPurchasing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPurchasing(false);
          }
        },
        theme: { color: "#c77d3b" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      handleApiError(null, err, "Failed to connect to payment gateway.");
      setPurchasing(false);
    }
  };

  // --- INLINE AUTH HANDLERS ---

  // Step 1: Check phone → route to password (existing) or OTP (new)
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setAuthError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);

    try {
      // First check if the number is already registered
      const checkRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, intended_role: "buyer", action: "signup" })
      });
      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        // 400 with "already registered" means existing user → show password step
        if (checkRes.status === 400 && checkData.detail?.includes("already registered")) {
          setIsExistingUser(true);
          setAuthStep("ENTER_PASSWORD");
        } else {
          setAuthError(checkData.detail || "Failed to verify phone number.");
        }
        setAuthLoading(false);
        return;
      }

      // If backend says is_new_user or OTP was requested → show OTP step for new user
      setIsExistingUser(false);
      if (checkData.require_otp) {
        setAuthStep("ENTER_OTP");
      } else {
        // OTP bypassed by admin → auto-verify
        const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, code: "000000", intended_role: "buyer" })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.is_new_user) {
          setRegistrationToken(verifyData.registration_token);
          setAuthStep("COMPLETE_REGISTRATION");
        } else if (verifyRes.ok) {
          const authenticatedUser = verifyData.user || { phone };
          setAuthedUser(authenticatedUser);
          await checkAuth();
          const subRes = await fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
          if (subRes?.has_active_pass && subRes.credits_remaining > 0) {
            setSub(subRes);
            setAuthStep("ACTIVE_PASS_DETECTED");
          } else {
            setAuthStep("IDLE");
            handleBuyPass(selectedPlan, authenticatedUser);
          }
        } else {
          setAuthError(verifyData.detail || "Auto-verification failed.");
        }
      }
    } catch (err) {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2a: Login with password (existing user)
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!password) {
      setAuthError("Please enter your password.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: phone, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Incorrect password. Please try again or use Forgot Password.");
        setAuthLoading(false);
        return;
      }
      const authenticatedUser = data.user || data;
      setAuthedUser(authenticatedUser);
      await checkAuth();
      const subRes = await fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
      if (subRes?.has_active_pass && subRes.credits_remaining > 0) {
        setSub(subRes);
        setAuthStep("ACTIVE_PASS_DETECTED");
      } else {
        setAuthStep("IDLE");
        handleBuyPass(selectedPlan, authenticatedUser);
      }
    } catch (err) {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2b: Forgot password → send OTP for reset
  const handleForgotPassword = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthStep("FORGOT_PASSWORD");
        setOtpCode("");
        setPassword("");
      } else {
        setAuthError(data.detail || "Failed to send reset OTP.");
      }
    } catch (err) {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2b-2: Verify OTP + reset password
  const handleForgotPasswordReset = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) { setAuthError("Please enter the 6-digit OTP."); return; }
    if (!newPassword || newPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, code: otpCode, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.detail || "Reset failed."); setAuthLoading(false); return; }
      // Auto-login after reset
      const loginRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: phone, password: newPassword })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        const authenticatedUser = loginData.user || loginData;
        setAuthedUser(authenticatedUser);
        await checkAuth();
        const subRes = await fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
        if (subRes?.has_active_pass && subRes.credits_remaining > 0) {
          setSub(subRes);
          setAuthStep("ACTIVE_PASS_DETECTED");
        } else {
          setAuthStep("IDLE");
          handleBuyPass(selectedPlan, authenticatedUser);
        }
      } else {
        setAuthStep("ENTER_PASSWORD");
        setPassword("");
        setAuthError("Password reset successful! Please sign in with your new password.");
      }
    } catch (err) {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2c: OTP verify (new user path)
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      setAuthError("Please enter the 6-digit OTP code.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, code: otpCode, intended_role: "buyer" })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Invalid OTP code.");
        setAuthLoading(false);
        return;
      }

      if (data.is_new_user) {
        setRegistrationToken(data.registration_token);
        setAuthStep("COMPLETE_REGISTRATION");
      } else {
        const authenticatedUser = data.user || { id: 999, phone };
        setAuthedUser(authenticatedUser);

        const [subRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
          checkAuth()
        ]);

        if (subRes && subRes.has_active_pass && subRes.credits_remaining > 0) {
          setSub(subRes);
          setAuthStep("ACTIVE_PASS_DETECTED");
        } else {
          setAuthStep("IDLE");
          handleBuyPass(selectedPlan, authenticatedUser);
        }
      }
    } catch (err) {
      setAuthError("Verification error.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !password) {
      setAuthError("Full Name and Password are both mandatory!");
      return;
    }
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete-registration/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          registration_token: registrationToken,
          first_name: firstName.trim(),
          password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Registration failed.");
        setAuthLoading(false);
        return;
      }

      const authenticatedUser = data.user || { first_name: firstName, phone };
      setAuthedUser(authenticatedUser);
      await checkAuth();
      setAuthStep("IDLE");
      handleBuyPass(selectedPlan, authenticatedUser);
    } catch (err) {
      setAuthError("Registration error.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="rounded-3xl p-6 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative border"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--ink)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* ACTIVE PASS DETECTED FOR RETURNING USER */}
        {authStep === "ACTIVE_PASS_DETECTED" && sub && (
          <div className="py-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <span className="material-symbols-outlined text-[32px]">verified_user</span>
            </div>

            <h3 className="text-[22px] font-extrabold text-slate-900 mb-1">
              Welcome Back{user?.first_name ? `, ${user.first_name}` : ""}!
            </h3>
            <p className="text-[13px] text-slate-600 font-medium mb-6">
              You already have an active pass with <strong className="text-emerald-700">{sub.credits_remaining} Unlocks Remaining</strong>.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleInstantUnlock(user || authedUser)}
                disabled={purchasing}
                className="w-full h-13 py-3 rounded-2xl text-white font-extrabold text-[14px] shadow-lg transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-[20px]">bolt</span>
                {purchasing ? "Unlocking..." : "Use 1 Existing Credit (₹0 Payment Needed)"}
              </button>

              <button
                onClick={() => handleBuyPass(selectedPlan, user || authedUser)}
                disabled={purchasing}
                className="w-full h-13 py-3 rounded-2xl text-white font-extrabold text-[13px] transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                Buy Selected {PLANS.find(p => p.id === selectedPlan)?.name} (Stack +{PLANS.find(p => p.id === selectedPlan)?.unlocks} Credits)
              </button>
            </div>
          </div>
        )}

        {/* INLINE AUTH STEPS */}
        {authStep === "ENTER_PHONE" && (
          <div className="py-4">
            <button
              onClick={() => setAuthStep("IDLE")}
              className="text-[12px] font-bold text-amber-700 hover:underline flex items-center gap-1 mb-4"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Plan Selection
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-200">
                <span className="material-symbols-outlined text-[26px]">phone_iphone</span>
              </div>
              <h3 className="text-[20px] font-extrabold text-slate-900">Enter Your Mobile Number</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Enter mobile number to continue payment for your selected plan (₹{PLANS.find(p => p.id === selectedPlan)?.price}).
              </p>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold border border-red-200 text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">Mobile Number *</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus-within:bg-white focus-within:border-amber-500">
                  <span className="text-[13px] font-extrabold text-slate-500">+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile"
                    maxLength={10}
                    className="w-full bg-transparent outline-none font-bold text-[14px] text-slate-900"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-xl text-white font-extrabold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {authLoading ? "Checking Account..." : "Continue to Payment"}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </form>
          </div>
        )}

        {/* ENTER PASSWORD (Existing User) */}
        {authStep === "ENTER_PASSWORD" && (
          <div className="py-4">
            <button
              onClick={() => { setAuthStep("ENTER_PHONE"); setPassword(""); setAuthError(""); }}
              className="text-[12px] font-bold text-amber-700 hover:underline flex items-center gap-1 mb-4"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Change Mobile Number
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-200">
                <span className="material-symbols-outlined text-[26px]">lock</span>
              </div>
              <h3 className="text-[20px] font-extrabold text-slate-900">Welcome Back!</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Your number <strong className="text-slate-800">+91 {phone}</strong> is already registered. Please sign in with your password.
              </p>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold border border-red-200 text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13px] font-bold outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-xl text-white font-extrabold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {authLoading ? "Signing In..." : "Sign In & Continue"}
                <span className="material-symbols-outlined text-[18px]">login</span>
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={authLoading}
                className="w-full text-[12px] font-bold text-blue-600 hover:underline text-center mt-1 cursor-pointer"
              >
                Forgot Password? Reset via OTP
              </button>
            </form>
          </div>
        )}

        {/* FORGOT PASSWORD – OTP + New Password */}
        {authStep === "FORGOT_PASSWORD" && (
          <div className="py-4">
            <button
              onClick={() => { setAuthStep("ENTER_PASSWORD"); setOtpCode(""); setNewPassword(""); setAuthError(""); }}
              className="text-[12px] font-bold text-amber-700 hover:underline flex items-center gap-1 mb-4"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Sign In
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-2 border border-orange-200">
                <span className="material-symbols-outlined text-[26px]">key</span>
              </div>
              <h3 className="text-[20px] font-extrabold text-slate-900">Reset Password</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                An OTP has been sent to <strong className="text-slate-800">+91 {phone}</strong>. Enter it below and set a new password.
              </p>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold border border-red-200 text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleForgotPasswordReset} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">6-Digit OTP *</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-12 text-center text-[20px] font-extrabold tracking-widest rounded-xl border border-slate-200 outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set new password (min 6 chars)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13px] font-bold outline-none focus:border-orange-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-xl text-white font-extrabold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#ea580c" }}
              >
                {authLoading ? "Resetting..." : "Reset Password & Sign In"}
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              </button>
            </form>
          </div>
        )}

        {authStep === "ENTER_OTP" && (
          <div className="py-4">
            <button
              onClick={() => setAuthStep("ENTER_PHONE")}
              className="text-[12px] font-bold text-amber-700 hover:underline flex items-center gap-1 mb-4"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Change Mobile Number
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-200">
                <span className="material-symbols-outlined text-[26px]">mark_email_read</span>
              </div>
              <h3 className="text-[20px] font-extrabold text-slate-900">Verify OTP Code</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Enter the verification code sent to <strong className="text-slate-900">+91 {phone}</strong>
              </p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[11px]">
                Demo Mode Code: 000000
              </span>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold border border-red-200 text-center">
                {authError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">6-Digit OTP *</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-12 text-center text-[20px] font-extrabold tracking-widest rounded-xl border border-slate-200 outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-xl text-white font-extrabold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {authLoading ? "Verifying..." : "Verify & Continue"}
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </button>
            </form>
          </div>
        )}

        {authStep === "COMPLETE_REGISTRATION" && (
          <div className="py-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                <span className="material-symbols-outlined text-[26px]">person_add</span>
              </div>
              <h3 className="text-[20px] font-extrabold text-slate-900">Create Buyer Account</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Welcome to Rentlo! Please enter your name and set a password to complete your account.
              </p>
            </div>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold border border-red-200 text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">Full Name (Mandatory) *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Mohith Kumar"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13px] font-bold outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">Set Password (Mandatory) *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set your account password"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13px] font-bold outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-xl text-white font-extrabold text-[13px] shadow-lg transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {authLoading ? "Creating Account..." : "Complete & Open Payment Gateway"}
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
              </button>
            </form>
          </div>
        )}

        {/* DEFAULT PLAN SELECTION STEP */}
        {authStep === "IDLE" && (
          <>
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2 border shadow-sm"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                  color: "var(--accent)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">stars</span>
                Choose Your Unlock Plan
              </div>
              <h2 className="text-[22px] sm:text-[26px] font-extrabold leading-tight" style={{ color: "var(--ink)" }}>
                Unlock Direct Owner Contacts
              </h2>
              <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                Get instant owner phone numbers, exact location pin, &amp; legal rental agreements.
              </p>
            </div>

            {/* 1-Click Instant Unlock Banner if user has active pass credits */}
            {sub && sub.has_active_pass && sub.credits_remaining > 0 && (
              <div
                className="mb-6 p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
                  borderColor: "var(--accent)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-[18px] shadow-md"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {sub.credits_remaining}
                  </div>
                  <div className="text-left">
                    <h4 className="font-extrabold text-[14px]" style={{ color: "var(--ink)" }}>
                      You have {sub.credits_remaining} Active Credit{sub.credits_remaining === 1 ? "" : "s"}!
                    </h4>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                      Use 1 credit to unlock this owner instantly (₹0 Payment Needed)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleInstantUnlock(user)}
                  disabled={purchasing}
                  className="w-full sm:w-auto h-11 px-5 rounded-xl font-extrabold text-[13px] transition-all shadow-md hover:scale-[1.02] flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--btn-text, #ffffff)",
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  {purchasing ? "Unlocking..." : "1-Click Instant Unlock"}
                </button>
              </div>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between relative ${
                      isSelected ? "shadow-lg scale-[1.01]" : "hover:opacity-90"
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                        : "var(--surface-alt)",
                      borderColor: isSelected ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    {plan.badge && (
                      <span
                        className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-white text-[10px] font-extrabold tracking-wider shadow-md"
                        style={{ backgroundColor: "var(--accent)" }}
                      >
                        {plan.badge}
                      </span>
                    )}

                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-extrabold uppercase" style={{ color: "var(--text-muted)" }}>
                          {plan.tag}
                        </span>
                        <span className="text-[22px] font-extrabold" style={{ color: "var(--ink)" }}>
                          ₹{plan.price}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-[16px] mb-1" style={{ color: "var(--ink)" }}>
                        {plan.name}
                      </h3>

                      <p className="text-[12px] font-medium mb-3 leading-snug" style={{ color: "var(--text-muted)" }}>
                        {plan.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-between text-[12px]" style={{ borderColor: "var(--border)" }}>
                      <span className="font-extrabold flex items-center gap-1" style={{ color: "var(--accent)" }}>
                        <span className="material-symbols-outlined text-[16px]">lock_open</span>
                        {plan.unlocks} {plan.unlocks === 1 ? "Unlock" : "Unlocks"}
                      </span>
                      {plan.agreements > 0 && (
                        <span
                          className="font-bold text-[11px] px-2 py-0.5 rounded-md border"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                            borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                            color: "var(--accent)",
                          }}
                        >
                          +{plan.agreements} Free Agreement
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Plan Checkout Button */}
            <button
              onClick={() => handleBuyPass(selectedPlan, user)}
              disabled={purchasing}
              className="w-full h-14 rounded-2xl text-[15px] font-extrabold transition-all shadow-xl hover:scale-[1.01] flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--btn-text, #ffffff)",
              }}
            >
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              {purchasing
                ? "Processing Payment..."
                : `Pay ₹${PLANS.find((p) => p.id === selectedPlan)?.price} & Get ${PLANS.find((p) => p.id === selectedPlan)?.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
