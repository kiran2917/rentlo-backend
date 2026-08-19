import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { OtpModal } from "../components/OtpModal";
import { loadRazorpayScript } from "../../shared/utils/razorpayLoader";
import { toast } from "react-toastify";

export const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState(null);
  const [purchasingPlanId, setPurchasingPlanId] = useState(null);

  const PLANS = [
    {
      id: "single_14",
      name: "Single Unlock",
      price: 14,
      unlocks: 1,
      agreements: 0,
      badge: null,
      validity: "Instant Access",
      description: "1-time contact lookup for a specific property listing",
      features: [
        "1 Direct Owner Contact Unlock",
        "Exact Location Coordinates & Maps",
        "WhatsApp Direct Chat Access"
      ]
    },
    {
      id: "starter_39",
      name: "Starter Pass",
      price: 39,
      unlocks: 3,
      agreements: 0,
      badge: "POPULAR",
      validity: "3 Credits Pack",
      description: "Ideal for casual house hunters exploring a locality",
      features: [
        "3 Contact Unlocks (Save ₹3)",
        "1-Click Instant Unlock (No Gateway PIN)",
        "WhatsApp & Google Maps Navigation"
      ]
    },
    {
      id: "smart_79",
      name: "Smart Pass",
      price: 79,
      unlocks: 6,
      agreements: 1,
      badge: "BEST SELLER ⭐",
      validity: "6 Credits Pack",
      description: "Best for active tenants comparing multiple properties",
      features: [
        "6 Contact Unlocks (Save ₹5)",
        "1 Free Legal Rental Lease Agreement (Value ₹299)",
        "1-Click Instant Unlock Speed",
        "WhatsApp & Google Maps Pin Access"
      ]
    },
    {
      id: "pro_129",
      name: "Pro Hunter Pass",
      price: 129,
      unlocks: 10,
      agreements: 3,
      badge: "VIP VALUE 👑",
      validity: "10 Credits Pack",
      description: "VIP pass for families & urgent movers needing top choices",
      features: [
        "10 Contact Unlocks (Save ₹11)",
        "3 Free Legal Rental Lease Agreements (Value ₹899)",
        "VIP Early Access Listing Alerts (2 Hours Early)"
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

  return (
    <div className="min-h-screen font-sans py-16 px-4 sm:px-8 transition-colors duration-300" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <div className="max-w-6xl mx-auto text-center">
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-extrabold uppercase tracking-widest mb-4 border"
          style={{ 
            backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", 
            borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
            color: "var(--accent)"
          }}
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          Transparent Pricing · Zero Brokerage
        </div>

        <h1 className="font-display font-extrabold text-[36px] sm:text-[56px] leading-tight tracking-tight mb-4" style={{ color: "var(--ink)" }}>
          Unlock Direct Owner Contacts & Save Brokerage
        </h1>

        <p className="text-[16px] max-w-2xl mx-auto mb-16" style={{ color: "var(--text-muted)" }}>
          Skip 1-month brokerage fees (₹15,000+). Pay a tiny fee to connect directly with verified property owners on Rentlo.
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
                borderColor: plan.badge ? "var(--accent)" : "var(--border)",
                boxShadow: plan.badge ? "0 10px 30px -10px color-mix(in srgb, var(--accent) 30%, transparent)" : undefined
              }}
            >
              {plan.badge && (
                <span 
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider shadow-md"
                  style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}
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
                    / {plan.unlocks} {plan.unlocks === 1 ? "unlock" : "unlocks"}
                  </span>
                </div>

                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: "var(--accent)" }}>
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
                style={
                  plan.badge
                    ? { backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }
                    : { backgroundColor: "var(--ink)", color: "var(--surface)" }
                }
              >
                {purchasingPlanId === plan.id ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Processing...
                  </>
                ) : (
                  `Get ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showLoginModal && (
        <OtpModal
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
