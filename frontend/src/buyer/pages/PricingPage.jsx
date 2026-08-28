import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../shared/context/AuthContext";
import { OtpModal } from "../components/OtpModal";
import { loadRazorpayScript } from "../../shared/utils/razorpayLoader";
import { toast } from "react-toastify";

export const PricingPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState(null);
  const [purchasingPlanId, setPurchasingPlanId] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);

  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.error("Failed to fetch settings on pricing page", err));
  }, []);

  const singleFee = settings?.buyer_unlock_fee || 14;
  const starterFee = settings?.buyer_pass_starter_price || 39;
  const smartFee = settings?.buyer_pass_smart_price || 79;
  const proFee = settings?.buyer_pass_pro_price || 129;

  const starterSavings = (3 * singleFee) - starterFee;
  const smartSavings = (6 * singleFee) - smartFee;
  const proSavings = (10 * singleFee) - proFee;

  const PLANS = [
    {
      id: "single_14",
      name: t("pricing.plans.single_14.name", "Single Unlock"),
      price: singleFee,
      unlocks: 1,
      agreements: 0,
      badge: null,
      validity: t("pricing.plans.single_14.validity", "Instant Access"),
      description: t("pricing.plans.single_14.description", "1-time contact lookup for a specific property listing"),
      features: [
        t("pricing.plans.single_14.features.0", "1 Direct Owner Contact Unlock"),
        t("pricing.plans.single_14.features.1", "Exact Location Coordinates & Maps"),
        t("pricing.plans.single_14.features.2", "WhatsApp Direct Chat Access")
      ]
    },
    {
      id: "starter_39",
      name: t("pricing.plans.starter_39.name", "Starter Pass"),
      price: starterFee,
      unlocks: 3,
      agreements: 0,
      badge: t("pricing.plans.starter_39.badge", "POPULAR"),
      validity: t("pricing.plans.starter_39.validity", "3 Credits Pack"),
      description: t("pricing.plans.starter_39.description", "Ideal for casual house hunters exploring a locality"),
      features: [
        `3 Direct Contact Unlocks${starterSavings > 0 ? ` (Save ₹${starterSavings})` : ""}`,
        t("pricing.plans.starter_39.features.1", "1-Click Instant Unlock (No Gateway PIN)"),
        t("pricing.plans.starter_39.features.2", "WhatsApp & Google Maps Navigation")
      ]
    },
    {
      id: "smart_79",
      name: t("pricing.plans.smart_79.name", "Smart Pass"),
      price: smartFee,
      unlocks: 6,
      agreements: 1,
      badge: t("pricing.plans.smart_79.badge", "BEST SELLER ⭐"),
      validity: t("pricing.plans.smart_79.validity", "6 Credits Pack"),
      description: t("pricing.plans.smart_79.description", "Best for active tenants comparing multiple properties"),
      features: [
        `6 Direct Contact Unlocks${smartSavings > 0 ? ` (Save ₹${smartSavings})` : ""}`,
        t("pricing.plans.smart_79.features.1", "1 Free Legal Rental Lease Agreement (Value ₹299)"),
        t("pricing.plans.smart_79.features.2", "1-Click Instant Unlock Speed"),
        t("pricing.plans.smart_79.features.3", "WhatsApp & Google Maps Pin Access")
      ]
    },
    {
      id: "pro_129",
      name: t("pricing.plans.pro_129.name", "Pro Hunter Pass"),
      price: proFee,
      unlocks: 10,
      agreements: 3,
      badge: t("pricing.plans.pro_129.badge", "VIP VALUE 👑"),
      validity: t("pricing.plans.pro_129.validity", "10 Credits Pack"),
      description: t("pricing.plans.pro_129.description", "VIP pass for families & urgent movers needing top choices"),
      features: [
        `10 Direct Contact Unlocks${proSavings > 0 ? ` (Save ₹${proSavings})` : ""}`,
        t("pricing.plans.pro_129.features.1", "3 Free Legal Rental Lease Agreements (Value ₹899)"),
        t("pricing.plans.pro_129.features.2", "VIP Early Access Listing Alerts (2 Hours Early)")
      ]
    }
  ];

  const executePurchase = async (planId) => {
    setPurchasingPlanId(planId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/pass/initiate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pass_type: planId })
      });
      const orderData = await res.json();

      if (!res.ok) {
        toast.error(orderData.detail || "Failed to initiate payment");
        setPurchasingPlanId(null);
        return;
      }

      // Bypass Mode (Dev fallback or bypass payment enabled in settings)
      if (orderData.bypassed) {
        toast.success(orderData.detail || "Pass activated successfully!");
        setPurchasingPlanId(null);
        navigate("/my-unlocks");
        return;
      }

      // Direct UPI Flow
      if (orderData.payment_gateway === 'upi') {
        setUpiOrderData(orderData);
        setShowUpiModal(true);
        setPurchasingPlanId(null);
        return;
      }

      // Razorpay Payment Gateway
      await loadRazorpayScript();
      if (!window.Razorpay) {
        toast.error("Unable to load Razorpay SDK. Please check your internet connection.");
        setPurchasingPlanId(null);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Rentlo Property Hub",
        description: `Purchase ${planId.replace(/_/g, ' ').toUpperCase()} Pass`,
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
              toast.success(verifyData.detail || "Pass activated successfully!");
              navigate("/my-unlocks");
            } else {
              toast.error(verifyData.detail || "Payment verification failed");
            }
          } catch (err) {
            toast.error("Verification error: " + err.message);
          } finally {
            setPurchasingPlanId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPurchasingPlanId(null);
          }
        },
        theme: { color: "#059669" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error("Network error: " + err.message);
      setPurchasingPlanId(null);
    }
  };

  const handleSelectPass = (planId) => {
    if (!user) {
      setPendingPlanId(planId);
      setShowLoginModal(true);
      return;
    }
    executePurchase(planId);
  };

  // Auto trigger if URL has ?pass=plan_id
  useEffect(() => {
    const passFromUrl = searchParams.get("pass");
    if (passFromUrl) {
      if (user) {
        executePurchase(passFromUrl);
      } else {
        setPendingPlanId(passFromUrl);
        setShowLoginModal(true);
      }
    }
  }, []);

  const handleUpiSubmit = async (e) => {
    e.preventDefault();
    if (!utrNumber || utrNumber.length < 8) {
      toast.error("Please enter a valid UTR number.");
      return;
    }
    setIsVerifyingUtr(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/pass/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pass_type: upiOrderData.pass_type,
          payment_method: 'upi',
          utr: utrNumber
        })
      });
      const verifyData = await res.json();
      if (res.ok) {
        toast.success(verifyData.detail || "Pass activated successfully!");
        setShowUpiModal(false);
        navigate("/my-unlocks");
      } else {
        toast.error(verifyData.detail || "Payment verification failed");
      }
    } catch (err) {
      toast.error("Verification error: " + err.message);
    } finally {
      setIsVerifyingUtr(false);
    }
  };

  return (
    <div className="min-h-screen font-sans py-16 px-4 sm:px-8 transition-colors duration-300" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <div className="max-w-6xl mx-auto text-center">
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-extrabold uppercase tracking-widest mb-4 border"
          style={{ 
            backgroundColor: "rgba(0,0,0,0.06)", 
            borderColor: "rgba(0,0,0,0.15)",
            color: "#000000"
          }}
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          {t("pricing.transparentPricing", "Transparent Pricing · Zero Brokerage")}
        </div>

        <h1 className="font-display font-extrabold text-[36px] sm:text-[56px] leading-tight tracking-tight mb-4" style={{ color: "var(--ink)" }}>
          {t("pricing.heroTitle", "Unlock Direct Owner Contacts & Save Brokerage")}
        </h1>

        <p className="text-[16px] max-w-2xl mx-auto mb-16" style={{ color: "var(--text-muted)" }}>
          {t("pricing.heroSubtitle", "Skip 1-month brokerage fees (₹15,000+). Pay a tiny fee to connect directly with verified property owners on Rentlo.")}
        </p>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between relative shadow-sm hover:shadow-xl ${
                plan.badge
                  ? "scale-[1.02]"
                  : ""
              }`}
              style={{
                backgroundColor: "var(--surface)",
                borderColor: plan.badge ? "#000000" : "var(--border)",
                boxShadow: plan.badge ? "0 10px 30px -10px rgba(0,0,0,0.2)" : undefined
              }}
            >
              {plan.badge && (
                <span 
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider shadow-md"
                  style={{ backgroundColor: "#000000", color: "#FFFFFF" }}
                >
                  {plan.badge}
                </span>
              )}

              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
                  {plan.validity}
                </span>

                <h3 className="font-extrabold text-[22px] mb-2" style={{ color: "var(--ink)" }}>
                  {plan.name}
                </h3>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-extrabold text-[40px] leading-none" style={{ color: "var(--ink)" }}>
                    ₹{plan.price}
                  </span>
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
                    / {plan.unlocks} {plan.unlocks === 1 ? t("pricing.unlock", "unlock") : t("pricing.unlocks", "unlocks")}
                  </span>
                </div>

                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: "#000000" }}>
                        check_circle
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled={purchasingPlanId !== null}
                onClick={() => handleSelectPass(plan.id)}
                className={`w-full h-12 rounded-xl text-[14px] font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  purchasingPlanId === plan.id
                    ? "opacity-75 cursor-not-allowed"
                    : "hover:opacity-90"
                }`}
                style={{ backgroundColor: "#000000", color: "#FFFFFF" }}
              >
                {purchasingPlanId === plan.id ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    {t("pricing.processing", "Processing...")}
                  </>
                ) : (
                  t("pricing.getPlan", "Get {{name}}", { name: plan.name })
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showUpiModal && upiOrderData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col p-6 animate-in zoom-in-95">
            <button
              onClick={() => setShowUpiModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <div className="text-center mb-6 mt-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">{t("pricing.upi.scanPay", "Scan & Pay via UPI")}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {t("pricing.upi.scanDesc", "Please scan the QR code below using any UPI app (GPay, PhonePe, Paytm) to pay ₹{{amount}}.", { amount: upiOrderData.amount })}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `upi://pay?pa=${upiOrderData.upi_merchant_id || 'merchant@upi'}&pn=Rentlo&am=${upiOrderData.amount}&cu=INR`
                  )}`}
                  alt="UPI QR Code"
                  className="w-48 h-48 rounded-lg"
                />
              </div>
              <a
                href={`upi://pay?pa=${upiOrderData.upi_merchant_id || 'merchant@upi'}&pn=Rentlo&am=${upiOrderData.amount}&cu=INR`}
                className="w-full max-w-[240px] h-11 bg-slate-950 hover:bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md cursor-pointer no-underline"
              >
                <span className="material-symbols-outlined text-[18px]">touch_app</span>
                Pay ₹{upiOrderData.amount} via GPay / PhonePe
              </a>
            </div>

            <form onSubmit={handleUpiSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-600 uppercase block mb-1 text-left">{t("pricing.upi.enterUtr", "Enter 12-Digit UPI Reference / UTR Number *")}</label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                  placeholder={t("pricing.upi.utrPlaceholder", "e.g. 12-digit number from GPay / PhonePe / Paytm")}
                  maxLength={20}
                  required
                  className="w-full h-12 px-4 text-center tracking-widest text-lg font-bold rounded-xl border border-slate-200 outline-none focus:border-indigo-600 transition-all"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1.5 text-left">
                  Check your payment app receipt for 12-digit <strong>UPI Ref No.</strong> or <strong>UTR</strong>.
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifyingUtr}
                className="w-full h-14 rounded-xl text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer bg-black"
              >
                {isVerifyingUtr ? t("pricing.upi.verifying", "Verifying...") : t("pricing.upi.submitBtn", "Submit UTR & Activate")}
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {showLoginModal && (
        <OtpModal
          title={t("pricing.loginModal.title", "Sign in to Continue")}
          subtitle={t("pricing.loginModal.subtitle", "Enter your mobile number to purchase your pass and activate contact unlocks.")}
          onSuccess={() => {
            setShowLoginModal(false);
            if (pendingPlanId) {
              const planToExecute = pendingPlanId;
              setPendingPlanId(null);
              executePurchase(planToExecute);
            }
          }}
          onClose={() => {
            setShowLoginModal(false);
            setPendingPlanId(null);
          }}
        />
      )}
    </div>
  );
};
