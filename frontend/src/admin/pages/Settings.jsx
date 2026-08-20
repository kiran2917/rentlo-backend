import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../../shared/context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
const THEME_OPTIONS = [
  // Minimal Style
  {
    id: "emerald_minimal",
    label: "Emerald Minimal",
    styleGroup: "Minimal Style",
    desc: "Pure Slate & Lush Emerald Growth (Clean & Crisp)",
    cardBg: "#FFFFFF",
    borderColor: "#CBD5E1",
    accentColor: "#059669",
    titleColor: "#0F172A",
    descColor: "#475569",
  },
  {
    id: "sapphire_luxury",
    label: "Royal Sapphire Indigo",
    styleGroup: "Minimal Style",
    desc: "High-end Sapphire Blue with Indigo Accents",
    cardBg: "#F5F7FF",
    borderColor: "#C7D2FE",
    accentColor: "#4F46E5",
    titleColor: "#1E1B4B",
    descColor: "#3730A3",
  },
  {
    id: "midnight_cyber",
    label: "Obsidian Cyber Dark",
    styleGroup: "Minimal Style",
    desc: "Dark Mode Cyberpunk Obsidian with Neon Cyan Glow",
    cardBg: "#090D16",
    borderColor: "#1E293B",
    accentColor: "#06B6D4",
    titleColor: "#F8FAFC",
    descColor: "#94A3B8",
  },
  // Bento Grid Style
  {
    id: "bento_cyber",
    label: "Cyber Obsidian Bento",
    styleGroup: "Bento Grid Style",
    desc: "Dark mode bento layout with electric cyan borders and active glows",
    cardBg: "#0e1322",
    borderColor: "#1e293b",
    accentColor: "#06b6d4",
    titleColor: "#ffffff",
    descColor: "#94a3b8",
  },
  {
    id: "bento_slate",
    label: "Soft Slate Bento",
    styleGroup: "Bento Grid Style",
    desc: "Light mode clean bento layout with slate borders and teal details",
    cardBg: "#ffffff",
    borderColor: "#e2e8f0",
    accentColor: "#0d9488",
    titleColor: "#0f172a",
    descColor: "#64748b",
  },
  {
    id: "bento_amber",
    label: "Royal Amber Bento",
    styleGroup: "Bento Grid Style",
    desc: "Dark mode bento layout with deep amber accents and gold borders",
    cardBg: "#15171e",
    borderColor: "#27272a",
    accentColor: "#f59e0b",
    titleColor: "#ffffff",
    descColor: "#a1a1aa",
  },
  // Luxury Typography Style
  {
    id: "luxury_champagne",
    label: "Classic Champagne",
    styleGroup: "Luxury Typography Style",
    desc: "Elegant display serif typeface headers on a cream sand base",
    cardBg: "#ffffff",
    borderColor: "#e8e2d9",
    accentColor: "#c5a880",
    titleColor: "#1a1a1a",
    descColor: "#7d6e5a",
  },
  {
    id: "luxury_forest",
    label: "Forest Regency",
    styleGroup: "Luxury Typography Style",
    desc: "Deep emerald green luxury serif headers with warm bronze outlines",
    cardBg: "#ffffff",
    borderColor: "#d1fae5",
    accentColor: "#047857",
    titleColor: "#064e3b",
    descColor: "#34d399",
  },
  {
    id: "luxury_terracotta",
    label: "Warm Terracotta",
    styleGroup: "Luxury Typography Style",
    desc: "Earthy terracotta orange display titles with charcoal body print",
    cardBg: "#ffffff",
    borderColor: "#fed7aa",
    accentColor: "#c2410c",
    titleColor: "#431407",
    descColor: "#9a3412",
  },
  // Neo-Brutalism Style
  {
    id: "brutal_pink",
    label: "Retro Pop Pink",
    styleGroup: "Neo-Brutalism Style",
    desc: "Solid pink cards with thick 3px black outlines and flat shadows",
    cardBg: "#ffffff",
    borderColor: "#000000",
    accentColor: "#db2777",
    titleColor: "#000000",
    descColor: "#374151",
  },
  {
    id: "brutal_citrus",
    label: "Cyber Citrus",
    styleGroup: "Neo-Brutalism Style",
    desc: "High-contrast geometric panels with lime accents and pitch black borders",
    cardBg: "#ffffff",
    borderColor: "#000000",
    accentColor: "#84cc16",
    titleColor: "#000000",
    descColor: "#1e293b",
  },
  {
    id: "brutal_violet",
    label: "Electric Violet",
    styleGroup: "Neo-Brutalism Style",
    desc: "Deep purple neobrutalist cards backed by rigid black drop shadows",
    cardBg: "#ffffff",
    borderColor: "#000000",
    accentColor: "#7c3aed",
    titleColor: "#000000",
    descColor: "#1f2937",
  },
  // Cyberpunk Style
  {
    id: "cyber_magenta",
    label: "Cyber Magenta",
    styleGroup: "Cyberpunk Style",
    desc: "Deep dark cyberspace base with glowing hot pink text & lines",
    cardBg: "#0e0817",
    borderColor: "rgba(236, 72, 153, 0.4)",
    accentColor: "#ec4899",
    titleColor: "#ffffff",
    descColor: "#d946ef",
  },
  {
    id: "cyber_cyan",
    label: "Cyber Cyan",
    styleGroup: "Cyberpunk Style",
    desc: "Midnight grid system with electric neon cyan elements",
    cardBg: "#080f17",
    borderColor: "rgba(6, 182, 212, 0.4)",
    accentColor: "#06b6d4",
    titleColor: "#ffffff",
    descColor: "#38bdf8",
  },
  {
    id: "cyber_sunset",
    label: "Synthwave Sunset",
    styleGroup: "Cyberpunk Style",
    desc: "Deep sunset violet canvas highlighted by neon orange glows",
    cardBg: "#13071d",
    borderColor: "rgba(249, 115, 22, 0.4)",
    accentColor: "#f97316",
    titleColor: "#ffffff",
    descColor: "#fb7185",
  },
  // Neumorphism Style
  {
    id: "neumorphic_pearl",
    label: "Soft Pearl Neumorphic",
    styleGroup: "Neumorphic Style",
    desc: "Extruded double-shadow soft light grey pearl buttons & cells",
    cardBg: "#e0e5ec",
    borderColor: "#d1d8e6",
    accentColor: "#4f46e5",
    titleColor: "#2d3748",
    descColor: "#718096",
  },
  {
    id: "neumorphic_obsidian",
    label: "Obsidian Neumorphic",
    styleGroup: "Neumorphic Style",
    desc: "Extruded soft dark shadows on deep obsidian background tiles",
    cardBg: "#1e222b",
    borderColor: "#161920",
    accentColor: "#06b6d4",
    titleColor: "#f8fafc",
    descColor: "#94a3b8",
  },
  {
    id: "neumorphic_sage",
    label: "Sage Neumorphic",
    styleGroup: "Neumorphic Style",
    desc: "Extruded soft dusty-green shadows on a peaceful sage green canvas",
    cardBg: "#e2e7e4",
    borderColor: "#d3dad6",
    accentColor: "#15803d",
    titleColor: "#1f2937",
    descColor: "#4b5563",
  },
];

export const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab State ("pricing", "gateways", "estamp", "auth", "theme")
  const [activeTab, setActiveTab] = useState("pricing");

  const [upiId, setUpiId] = useState("");
  const [buyerUnlockFee, setBuyerUnlockFee] = useState("14");
  const [buyerPassStarter, setBuyerPassStarter] = useState("39");
  const [buyerPassSmart, setBuyerPassSmart] = useState("79");
  const [buyerPassPro, setBuyerPassPro] = useState("129");

  // Owner Pricing States
  const [ownerResFee, setOwnerResFee] = useState("99");
  const [ownerRes3Pack, setOwnerRes3Pack] = useState("259");
  const [ownerRes6Pack, setOwnerRes6Pack] = useState("499");
  const [ownerRes10Pack, setOwnerRes10Pack] = useState("859");

  const [ownerAptPgFee, setOwnerAptPgFee] = useState("149");
  const [ownerAptPg3Pack, setOwnerAptPg3Pack] = useState("349");
  const [ownerAptPg6Pack, setOwnerAptPg6Pack] = useState("649");
  const [ownerAptPg10Pack, setOwnerAptPg10Pack] = useState("999");

  const [ownerCommFee, setOwnerCommFee] = useState("199");
  const [ownerComm3Pack, setOwnerComm3Pack] = useState("449");
  const [ownerComm6Pack, setOwnerComm6Pack] = useState("799");
  const [ownerComm10Pack, setOwnerComm10Pack] = useState("1199");

  const [ownerComboDiscount, setOwnerComboDiscount] = useState("15");

  // Validity Duration States (in Days) for PG / Apartment Plans
  const [validityAptPg1Pack, setValidityAptPg1Pack] = useState("60");
  const [validityAptPg3Pack, setValidityAptPg3Pack] = useState("60");
  const [validityAptPg6Pack, setValidityAptPg6Pack] = useState("90");
  const [validityAptPg10Pack, setValidityAptPg10Pack] = useState("180");

  const [ownerOnboardingFee, setOwnerOnboardingFee] = useState("0");
  const [bypassBuyer, setBypassBuyer] = useState(false);
  const [bypassOwner, setBypassOwner] = useState(false);
  const [buyerTheme, setBuyerTheme] = useState(() => localStorage.getItem("rentlo_buyer_theme") || "emerald_minimal");
  const [dashboardTheme, setDashboardTheme] = useState(() => localStorage.getItem("rentlo_dashboard_theme") || "emerald_minimal");
  const [buyerGateway, setBuyerGateway] = useState("razorpay");
  const [ownerGateway, setOwnerGateway] = useState("upi");
  const [agentGateway, setAgentGateway] = useState("upi");
  const [adminGateway, setAdminGateway] = useState("upi");
  
  // OTP Verification settings
  const [buyerOtpLogin, setBuyerOtpLogin] = useState(false);
  const [buyerOtpSignup, setBuyerOtpSignup] = useState(true);
  const [ownerOtpLogin, setOwnerOtpLogin] = useState(false);
  const [ownerOtpSignup, setOwnerOtpSignup] = useState(true);
  const [agentOtpLogin, setAgentOtpLogin] = useState(false);
  const [agentOtpSignup, setAgentOtpSignup] = useState(true);
  const [adminOtpLogin, setAdminOtpLogin] = useState(false);
  const [adminOtpSignup, setAdminOtpSignup] = useState(true);
  const [otpBypassEnabled, setOtpBypassEnabled] = useState(false);

  // Owner Listing Verification Method: 'otp' | 'selfie'
  const [ownerListingVerificationMethod, setOwnerListingVerificationMethod] = useState("otp");

  // E-Stamp Phase 2 Settings
  const [enableEStamp, setEnableEStamp] = useState(false);
  const [eStampPrice, setEStampPrice] = useState("499");
  const [eStampProvider, setEStampProvider] = useState("digio");
  const [eStampApiKey, setEStampApiKey] = useState("");
  const [eStampApiSecret, setEStampApiSecret] = useState("");

  // ─── Razorpay Credentials ───────────────────────────────────────────────
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpKeySecret, setRzpKeySecret] = useState("");
  const [rzpWebhookSecret, setRzpWebhookSecret] = useState("");
  const [rzpKeySecretSet, setRzpKeySecretSet] = useState(false);
  const [rzpWebhookSet, setRzpWebhookSet] = useState(false);
  const [showRzpSecret, setShowRzpSecret] = useState(false);
  const [showRzpWebhook, setShowRzpWebhook] = useState(false);

  // ─── SMS / OTP Provider ────────────────────────────────────────────────
  const [smsProvider, setSmsProvider] = useState("none");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsApiSecret, setSmsApiSecret] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("");
  const [smsTemplateId, setSmsTemplateId] = useState("");
  const [smsFromNumber, setSmsFromNumber] = useState("");
  const [smsApiSecretSet, setSmsApiSecretSet] = useState(false);
  const [showSmsSecret, setShowSmsSecret] = useState(false);
  const [smsTestLoading, setSmsTestLoading] = useState(false);

  // Change Password state
  const [changePassNew, setChangePassNew] = useState("");
  const [changePassConfirm, setChangePassConfirm] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!changePassNew || changePassNew.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (changePassNew !== changePassConfirm) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    setChangePassLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_password: changePassNew }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.detail || "Password updated successfully!");
        setChangePassNew("");
        setChangePassConfirm("");
      } else {
        toast.error(data.detail || "Failed to update password.");
      }
    } catch (err) {
      toast.error("Network error updating password.");
    } finally {
      setChangePassLoading(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/audit-logs/`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all audit log history?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/audit-logs/`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        toast.success("Audit log history cleared.");
        setAuditLogs([]);
      } else {
        toast.error("Failed to clear audit logs.");
      }
    } catch (err) {
      toast.error("Network error clearing audit logs.");
    }
  };

  useEffect(() => {
    const roles = user?.roles || [user?.role];
    if (user && !roles.includes("admin")) {
      toast.error("Access denied. Global settings are restricted to Super Admin only.");
      navigate("/admin");
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setUpiId(data.default_upi_id || "");
        setBuyerUnlockFee(data.buyer_unlock_fee != null ? data.buyer_unlock_fee : "14");
        setBuyerPassStarter(data.buyer_pass_starter_price != null ? data.buyer_pass_starter_price : "39");
        setBuyerPassSmart(data.buyer_pass_smart_price != null ? data.buyer_pass_smart_price : "79");
        setBuyerPassPro(data.buyer_pass_pro_price != null ? data.buyer_pass_pro_price : "129");

        setOwnerResFee(data.owner_residential_fee != null ? data.owner_residential_fee : "99");
        setOwnerRes3Pack(data.owner_residential_3pack_price != null ? data.owner_residential_3pack_price : "259");
        setOwnerRes6Pack(data.owner_residential_6pack_price != null ? data.owner_residential_6pack_price : "499");
        setOwnerRes10Pack(data.owner_residential_10pack_price != null ? data.owner_residential_10pack_price : "859");

        setOwnerAptPgFee(data.owner_apt_pg_fee != null ? data.owner_apt_pg_fee : "149");
        setOwnerAptPg3Pack(data.owner_apt_pg_3pack_price != null ? data.owner_apt_pg_3pack_price : "349");
        setOwnerAptPg6Pack(data.owner_apt_pg_6pack_price != null ? data.owner_apt_pg_6pack_price : "649");
        setOwnerAptPg10Pack(data.owner_apt_pg_10pack_price != null ? data.owner_apt_pg_10pack_price : "999");

        setOwnerCommFee(data.owner_commercial_fee != null ? data.owner_commercial_fee : "199");
        setOwnerComm3Pack(data.owner_commercial_3pack_price != null ? data.owner_commercial_3pack_price : "449");
        setOwnerComm6Pack(data.owner_commercial_6pack_price != null ? data.owner_commercial_6pack_price : "799");
        setOwnerComm10Pack(data.owner_commercial_10pack_price != null ? data.owner_commercial_10pack_price : "1199");

        setOwnerComboDiscount(data.owner_combo_discount_percent != null ? data.owner_combo_discount_percent : "15");

        setOwnerOnboardingFee(data.owner_onboarding_fee != null ? data.owner_onboarding_fee : "0");
        setValidityAptPg1Pack(data.validity_apt_pg_1pack_days != null ? data.validity_apt_pg_1pack_days.toString() : (data.validity_apt_pg_days != null ? data.validity_apt_pg_days.toString() : "60"));
        setValidityAptPg3Pack(data.validity_apt_pg_3pack_days != null ? data.validity_apt_pg_3pack_days.toString() : "60");
        setValidityAptPg6Pack(data.validity_apt_pg_6pack_days != null ? data.validity_apt_pg_6pack_days.toString() : "90");
        setValidityAptPg10Pack(data.validity_apt_pg_10pack_days != null ? data.validity_apt_pg_10pack_days.toString() : "180");
        setBypassBuyer(data.bypass_buyer_payment || false);
        setBypassOwner(data.bypass_owner_payment || false);
        
        if (data.buyer_theme) {
          setBuyerTheme(data.buyer_theme);
          localStorage.setItem("rentlo_buyer_theme", data.buyer_theme);
        }
        if (data.dashboard_theme) {
          setDashboardTheme(data.dashboard_theme);
          localStorage.setItem("rentlo_dashboard_theme", data.dashboard_theme);
        }
        setBuyerGateway(data.buyer_payment_gateway || "razorpay");
        setOwnerGateway(data.owner_payment_gateway || "upi");
        setAgentGateway(data.agent_payment_gateway || "upi");
        setAdminGateway(data.admin_payment_gateway || "upi");
        setBuyerOtpLogin(data.buyer_require_otp_login || false);
        setBuyerOtpSignup(data.buyer_require_otp_signup ?? true);
        setOwnerOtpLogin(data.owner_require_otp_login || false);
        setOwnerOtpSignup(data.owner_require_otp_signup ?? true);
        setAgentOtpLogin(data.agent_require_otp_login || false);
        setAgentOtpSignup(data.agent_require_otp_signup ?? true);
        setAdminOtpLogin(data.admin_require_otp_login || false);
        setAdminOtpSignup(data.admin_require_otp_signup ?? true);
        setOtpBypassEnabled(data.otp_bypass_enabled || false);
        setOwnerListingVerificationMethod(data.owner_listing_verification_method || "otp");

        // E-Stamp settings
        setEnableEStamp(data.enable_e_stamp_agreements || false);
        setEStampPrice(data.e_stamp_price != null ? data.e_stamp_price : "499");
        setEStampProvider(data.e_stamp_provider || "digio");
        setEStampApiKey(data.e_stamp_api_key || "");
        setEStampApiSecret(data.e_stamp_api_secret || "");

        // Razorpay credentials
        setRzpKeyId(data.razorpay_key_id || "");
        setRzpKeySecretSet(data.razorpay_key_secret_set || false);
        setRzpWebhookSet(data.razorpay_webhook_secret_set || false);
        // Show masked value in the input so user knows it's set
        setRzpKeySecret(data.razorpay_key_secret_masked || "");
        setRzpWebhookSecret("");

        // SMS / OTP provider
        setSmsProvider(data.sms_provider || "none");
        setSmsApiKey(data.sms_api_key || "");
        setSmsApiSecretSet(data.sms_api_secret_set || false);
        setSmsApiSecret(data.sms_api_secret_masked || "");
        setSmsSenderId(data.sms_sender_id || "");
        setSmsTemplateId(data.sms_template_id || "");
        setSmsFromNumber(data.sms_from_number || "");
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!upiId.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g. name@bank)");
      return;
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          default_upi_id: upiId,
          buyer_unlock_fee: parseFloat(buyerUnlockFee) || 14,
          buyer_pass_starter_price: parseFloat(buyerPassStarter) || 39,
          buyer_pass_smart_price: parseFloat(buyerPassSmart) || 79,
          buyer_pass_pro_price: parseFloat(buyerPassPro) || 129,

          owner_residential_fee: parseFloat(ownerResFee) || 99,
          owner_residential_3pack_price: parseFloat(ownerRes3Pack) || 259,
          owner_residential_6pack_price: parseFloat(ownerRes6Pack) || 499,
          owner_residential_10pack_price: parseFloat(ownerRes10Pack) || 859,

          owner_apt_pg_fee: parseFloat(ownerAptPgFee) || 149,
          owner_apt_pg_3pack_price: parseFloat(ownerAptPg3Pack) || 349,
          owner_apt_pg_6pack_price: parseFloat(ownerAptPg6Pack) || 649,
          owner_apt_pg_10pack_price: parseFloat(ownerAptPg10Pack) || 999,

          owner_commercial_fee: parseFloat(ownerCommFee) || 199,
          owner_commercial_3pack_price: parseFloat(ownerComm3Pack) || 449,
          owner_commercial_6pack_price: parseFloat(ownerComm6Pack) || 799,
          owner_commercial_10pack_price: parseFloat(ownerComm10Pack) || 1199,

          owner_combo_discount_percent: parseFloat(ownerComboDiscount) || 15,

          owner_onboarding_fee: parseFloat(ownerOnboardingFee) || 0,
          validity_residential_days: 0,
          validity_apt_pg_days: parseInt(validityAptPg1Pack) || 60,
          validity_apt_pg_1pack_days: parseInt(validityAptPg1Pack) || 60,
          validity_apt_pg_3pack_days: parseInt(validityAptPg3Pack) || 60,
          validity_apt_pg_6pack_days: parseInt(validityAptPg6Pack) || 90,
          validity_apt_pg_10pack_days: parseInt(validityAptPg10Pack) || 180,
          validity_commercial_days: 0,
          bypass_buyer_payment: bypassBuyer,
          bypass_owner_payment: bypassOwner,
          buyer_theme: buyerTheme,
          dashboard_theme: dashboardTheme,
          buyer_payment_gateway: buyerGateway,
          owner_payment_gateway: ownerGateway,
          agent_payment_gateway: agentGateway,
          admin_payment_gateway: adminGateway,
          buyer_require_otp_login: buyerOtpLogin,
          buyer_require_otp_signup: buyerOtpSignup,
          owner_require_otp_login: ownerOtpLogin,
          owner_require_otp_signup: ownerOtpSignup,
          agent_require_otp_login: agentOtpLogin,
          agent_require_otp_signup: agentOtpSignup,
          admin_require_otp_login: adminOtpLogin,
          admin_require_otp_signup: adminOtpSignup,
          otp_bypass_enabled: otpBypassEnabled,
          owner_listing_verification_method: ownerListingVerificationMethod,

          buyer_theme: buyerTheme,
          dashboard_theme: dashboardTheme,

          // E-Stamp Settings
          enable_e_stamp_agreements: enableEStamp,
          e_stamp_price: parseFloat(eStampPrice) || 499,
          e_stamp_provider: eStampProvider,
          e_stamp_api_key: eStampApiKey,
          e_stamp_api_secret: eStampApiSecret,

          // Razorpay credentials (masked values are skipped server-side)
          razorpay_key_id: rzpKeyId,
          razorpay_key_secret: rzpKeySecret,
          razorpay_webhook_secret: rzpWebhookSecret,

          // SMS / OTP provider
          sms_provider: smsProvider,
          sms_api_key: smsApiKey,
          sms_api_secret: smsApiSecret,
          sms_sender_id: smsSenderId,
          sms_template_id: smsTemplateId,
          sms_from_number: smsFromNumber,
        })
      });
      if (res.ok) {
        toast.success("Settings saved successfully!");
        if (buyerTheme) {
          localStorage.setItem("rentlo_buyer_theme", buyerTheme);
        }
        if (dashboardTheme) {
          localStorage.setItem("rentlo_dashboard_theme", dashboardTheme);
        }
        window.dispatchEvent(new Event("themeChange"));
      } else {
        toast.error("Failed to save settings");
      }
    } catch (err) {
      toast.error("Network error saving settings");
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="settings">
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="settings">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        hideProgressBar
      />

      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        {/* Header Title + Subtitle + Top Save Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              Platform Settings
            </h1>
            <p className="text-[14px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configure global pricing, payment gateways, legal e-stamp APIs, and authentication rules.
            </p>
          </div>
          <button
            onClick={handleSave}
            className="h-11 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save All Settings
          </button>
        </div>

        {/* Horizontal Tab Navigation Bar (Matching Reference Design) */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl border mb-8 overflow-x-auto custom-scrollbar shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          {[
                      { id: "pricing", label: "General & Pricing", icon: "payments" },
            { id: "gateways", label: "Payment Gateways", icon: "account_balance" },
            { id: "credentials", label: "API Credentials", icon: "vpn_key" },
            { id: "estamp", label: "E-Stamp & Legal", icon: "verified" },
            { id: "auth", label: "Auth & Security", icon: "security" },
            { id: "theme", label: "Theme & Branding", icon: "palette" },
            { id: "audit", label: "Audit Log Trail", icon: "history" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all cursor-pointer shadow-sm flex-shrink-0"
              style={{
                backgroundColor: activeTab === tab.id ? "var(--accent)" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "var(--text-muted)",
                borderColor: activeTab === tab.id ? "var(--accent)" : "transparent"
              }}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: GENERAL & PRICING */}
        {activeTab === "pricing" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Platform UPI & Default */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-4 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: "var(--accent)" }}>
                  payments
                </span>
                Payment Collection &amp; Deposit UPI
              </h2>
              <div className="max-w-md">
                <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
                  Default Platform UPI ID
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. rentlo@ybl"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                  className="w-full h-12 px-4 rounded-xl border outline-none text-[14px] font-bold shadow-sm transition-all focus:border-orange-500"
                />
                <p className="text-[12px] mt-2 font-medium" style={{ color: "var(--text-muted)" }}>
                  Used for direct UPI payments, QR code generations, and offline bank settlements.
                </p>
              </div>
            </div>

            {/* Buyer Unlock & Pass Pricing */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-blue-500 text-[22px]">
                  shopping_cart
                </span>
                Buyer Contact Unlock & Pass Pricing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-2 text-text-muted">
                    Single Contact Unlock (₹)
                  </label>
                  <input
                    type="number"
                    value={buyerUnlockFee}
                    onChange={(e) => setBuyerUnlockFee(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-surface-alt text-ink font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-2 text-text-muted">
                    Starter Pass (₹)
                  </label>
                  <input
                    type="number"
                    value={buyerPassStarter}
                    onChange={(e) => setBuyerPassStarter(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-surface-alt text-ink font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-2 text-text-muted">
                    Smart Pass (₹)
                  </label>
                  <input
                    type="number"
                    value={buyerPassSmart}
                    onChange={(e) => setBuyerPassSmart(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-surface-alt text-ink font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-2 text-text-muted">
                    Pro Unlimited Pass (₹)
                  </label>
                  <input
                    type="number"
                    value={buyerPassPro}
                    onChange={(e) => setBuyerPassPro(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-surface-alt text-ink font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Owner Listing Packages */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-emerald-500 text-[22px]">
                  storefront
                </span>
                Owner Property Listing Packages
              </h2>
              
              {/* Residential */}
              <div className="mb-6 p-5 rounded-2xl border border-border bg-surface-alt">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-[14px] font-extrabold text-ink">🏠 Independent House / Villa / Plot Pricing</h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-extrabold uppercase tracking-wider self-start sm:self-auto">
                    <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                    Valid Until Rented (Never Expires)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">1 Listing (₹)</label>
                    <input type="number" value={ownerResFee} onChange={(e) => setOwnerResFee(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">3 Pack (₹)</label>
                    <input type="number" value={ownerRes3Pack} onChange={(e) => setOwnerRes3Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">6 Pack (₹)</label>
                    <input type="number" value={ownerRes6Pack} onChange={(e) => setOwnerRes6Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">10 Pack (₹)</label>
                    <input type="number" value={ownerRes10Pack} onChange={(e) => setOwnerRes10Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                </div>
              </div>

              {/* Apartment / PG */}
              <div className="mb-6 p-5 rounded-2xl border-2 border-orange-500/20 bg-orange-500/[0.02]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-[14px] font-extrabold text-ink flex items-center gap-2">
                    🏢 Apartment / Flat / PG Co-Living Pricing & Validity
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-[11px] font-extrabold uppercase tracking-wider self-start sm:self-auto">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Custom Expiration Per Pack
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Single Listing */}
                  <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-3">
                    <div className="font-extrabold text-[12px] text-ink pb-2 border-b border-border flex items-center justify-between">
                      <span>1 Single Listing</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">Standard</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Price (₹)</label>
                      <input type="number" value={ownerAptPgFee} onChange={(e) => setOwnerAptPgFee(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface-alt font-bold text-ink" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600 block mb-1">Validity (Days)</label>
                      <input type="number" value={validityAptPg1Pack} onChange={(e) => setValidityAptPg1Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-orange-500/30 bg-orange-500/5 font-black text-orange-500" />
                    </div>
                  </div>

                  {/* 3-Pack */}
                  <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-3">
                    <div className="font-extrabold text-[12px] text-ink pb-2 border-b border-border flex items-center justify-between">
                      <span>3-Pack Pass</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">Popular</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Price (₹)</label>
                      <input type="number" value={ownerAptPg3Pack} onChange={(e) => setOwnerAptPg3Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface-alt font-bold text-ink" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600 block mb-1">Validity (Days)</label>
                      <input type="number" value={validityAptPg3Pack} onChange={(e) => setValidityAptPg3Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-orange-500/30 bg-orange-500/5 font-black text-orange-500" />
                    </div>
                  </div>

                  {/* 6-Pack */}
                  <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-3">
                    <div className="font-extrabold text-[12px] text-ink pb-2 border-b border-border flex items-center justify-between">
                      <span>6-Pack Pass</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">VIP Value</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Price (₹)</label>
                      <input type="number" value={ownerAptPg6Pack} onChange={(e) => setOwnerAptPg6Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface-alt font-bold text-ink" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600 block mb-1">Validity (Days)</label>
                      <input type="number" value={validityAptPg6Pack} onChange={(e) => setValidityAptPg6Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-orange-500/30 bg-orange-500/5 font-black text-orange-500" />
                    </div>
                  </div>

                  {/* 10-Pack */}
                  <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-3">
                    <div className="font-extrabold text-[12px] text-ink pb-2 border-b border-border flex items-center justify-between">
                      <span>10-Pack Pass</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">Hostel</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Price (₹)</label>
                      <input type="number" value={ownerAptPg10Pack} onChange={(e) => setOwnerAptPg10Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface-alt font-bold text-ink" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600 block mb-1">Validity (Days)</label>
                      <input type="number" value={validityAptPg10Pack} onChange={(e) => setValidityAptPg10Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-orange-500/30 bg-orange-500/5 font-black text-orange-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Commercial */}
              <div className="p-5 rounded-2xl border border-border bg-surface-alt">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-[14px] font-extrabold text-ink">🏬 Commercial Space / Office / Warehouse Pricing</h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-extrabold uppercase tracking-wider self-start sm:self-auto">
                    <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                    Valid Until Rented (Never Expires)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">1 Listing (₹)</label>
                    <input type="number" value={ownerCommFee} onChange={(e) => setOwnerCommFee(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">3 Pack (₹)</label>
                    <input type="number" value={ownerComm3Pack} onChange={(e) => setOwnerComm3Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">6 Pack (₹)</label>
                    <input type="number" value={ownerComm6Pack} onChange={(e) => setOwnerComm6Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">10 Pack (₹)</label>
                    <input type="number" value={ownerComm10Pack} onChange={(e) => setOwnerComm10Pack(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-bold text-ink" />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Bypasses Card */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-purple-500 text-[22px]">
                  admin_panel_settings
                </span>
                Development & Testing Payment Bypass Rules
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start justify-between p-5 rounded-2xl border bg-surface-alt border-border">
                  <div>
                    <h3 className="font-bold text-[14px] text-ink">Bypass Buyer Payments</h3>
                    <p className="text-[12px] text-text-muted mt-1">Allow buyers to unlock contact details for free without payment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassBuyer(!bypassBuyer)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      bypassBuyer ? 'bg-emerald-500' : 'bg-slate-500/50'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bypassBuyer ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between p-5 rounded-2xl border bg-surface-alt border-border">
                  <div>
                    <h3 className="font-bold text-[14px] text-ink">Bypass Owner Listing Fees</h3>
                    <p className="text-[12px] text-text-muted mt-1">Allow owners to post listings for free without buying packages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassOwner(!bypassOwner)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      bypassOwner ? 'bg-emerald-500' : 'bg-slate-500/50'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bypassOwner ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENT GATEWAYS & BYPASSES */}
        {activeTab === "gateways" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Role-Based Payment Gateways */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-green-500 text-[22px]">
                  account_balance
                </span>
                Role-Based Payment Gateways
              </h2>
              <p className="text-[13px] mb-6 font-medium" style={{ color: "var(--text-muted)" }}>
                Configure exactly how each user role pays fees across the platform.
              </p>
              
              {(() => {
                const renderToggle = (title, desc, stateVal, setFn) => (
                  <div className="mb-6 p-5 border border-border rounded-2xl bg-surface-alt">
                    <div className="mb-4">
                      <h3 className="font-bold text-[15px] text-ink">{title}</h3>
                      <p className="text-[12px] text-text-muted mt-1">{desc}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setFn('upi')}
                        className="p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 shadow-sm"
                        style={{
                          backgroundColor: stateVal === 'upi' ? "var(--surface-alt)" : "var(--surface)",
                          borderColor: stateVal === 'upi' ? "var(--accent)" : "var(--border)",
                          color: "var(--ink)"
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: stateVal === 'upi' ? "var(--accent)" : "var(--text-muted)" }}>qr_code_2</span>
                        <div className="text-left">
                          <p className="text-[13px] font-bold leading-tight">Direct UPI</p>
                          <p className="text-[10px] opacity-70">Manual QR Scan</p>
                        </div>
                      </div>
                      <div
                        onClick={() => setFn('razorpay')}
                        className="p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 shadow-sm"
                        style={{
                          backgroundColor: stateVal === 'razorpay' ? "var(--surface-alt)" : "var(--surface)",
                          borderColor: stateVal === 'razorpay' ? "var(--accent)" : "var(--border)",
                          color: "var(--ink)"
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: stateVal === 'razorpay' ? "var(--accent)" : "var(--text-muted)" }}>credit_card</span>
                        <div className="text-left">
                          <p className="text-[13px] font-bold leading-tight">Razorpay</p>
                          <p className="text-[10px] opacity-70">Automated Cards / UPI</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div>
                    {renderToggle("Buyer Unlock Payment Engine", "Used when buyers purchase unlock passes or pay single contact unlock fees.", buyerGateway, setBuyerGateway)}
                    {renderToggle("Owner Listing Payment Engine", "Used when landlords purchase property listing packs.", ownerGateway, setOwnerGateway)}
                    {renderToggle("Agent Commission Engine", "Used for agent property verification fees.", agentGateway, setAgentGateway)}
                    {renderToggle("Admin Platform Engine", "Used for system administrative billing.", adminGateway, setAdminGateway)}
                  </div>
                );
              })()}
            </div>

            {/* Payment Bypasses */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-purple-500 text-[22px]">
                  admin_panel_settings
                </span>
                Development & Testing Payment Bypass Rules
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start justify-between p-5 rounded-2xl border bg-amber-500/10 border-amber-500/30">
                  <div>
                    <h3 className="font-extrabold text-[14px] text-amber-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      OTP Bypass Mode (Use 123456)
                    </h3>
                    <p className="text-[11.5px] text-amber-800/80 mt-1">
                      Bypass SMS OTP verification across all roles. Allows using <strong>123456</strong> for instant login &amp; signup.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpBypassEnabled(!otpBypassEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      otpBypassEnabled ? 'bg-amber-600' : 'bg-slate-500/50'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${otpBypassEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between p-5 rounded-2xl border bg-surface-alt border-border">
                  <div>
                    <h3 className="font-bold text-[14px] text-ink">Bypass Buyer Payments</h3>
                    <p className="text-[12px] text-text-muted mt-1">Allow buyers to unlock contact details without payment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassBuyer(!bypassBuyer)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      bypassBuyer ? 'bg-emerald-500' : 'bg-slate-500/50'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bypassBuyer ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between p-5 rounded-2xl border bg-surface-alt border-border">
                  <div>
                    <h3 className="font-bold text-[14px] text-ink">Bypass Owner Listing Fees</h3>
                    <p className="text-[12px] text-text-muted mt-1">Allow owners to post listings for free without buying packages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassOwner(!bypassOwner)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      bypassOwner ? 'bg-emerald-500' : 'bg-slate-500/50'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bypassOwner ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password Card */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-2 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-orange-500 text-[22px]">
                  key
                </span>
                Update Password &amp; Account Security Credentials
              </h2>
              <p className="text-[13px] mb-6 font-medium" style={{ color: "var(--text-muted)" }}>
                Update your account password. Changes take effect immediately across all sessions.
              </p>

              <form onSubmit={handleChangePasswordSubmit} className="max-w-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      New Password (min 6 chars)
                    </label>
                    <input
                      type="password"
                      value={changePassNew}
                      onChange={(e) => setChangePassNew(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full h-12 px-4 rounded-2xl border text-[14px] font-bold outline-none focus:border-orange-500 transition-all"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={changePassConfirm}
                      onChange={(e) => setChangePassConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full h-12 px-4 rounded-2xl border text-[14px] font-bold outline-none focus:border-orange-500 transition-all"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changePassLoading || !changePassNew || !changePassConfirm}
                  className="h-12 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[13px] flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {changePassLoading ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB: API CREDENTIALS — Razorpay & SMS/OTP */}
        {activeTab === "credentials" && (() => {
          const inputCls = "w-full h-11 px-4 rounded-xl border text-[13px] font-mono outline-none focus:border-blue-500 transition-all";
          const inputStyle = { backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" };
          const labelCls = "text-[11px] font-bold uppercase tracking-widest block mb-1.5";
          const labelStyle = { color: "var(--text-muted)" };

          const isRzpLive = rzpKeyId.startsWith("rzp_live_");
          const isRzpConfigured = rzpKeyId && rzpKeySecretSet;

          const SMS_PROVIDERS = [
            { value: "none", label: "None — Demo Mode (000000)", icon: "block" },
            { value: "fast2sms", label: "Fast2SMS", icon: "sms" },
            { value: "msg91", label: "MSG91", icon: "sms" },
            { value: "exotel", label: "Exotel", icon: "call" },
            { value: "twilio", label: "Twilio", icon: "sms" },
            { value: "textlocal", label: "TextLocal", icon: "sms" },
          ];

          const handleTestSms = async () => {
            setSmsTestLoading(true);
            try {
              // First save current config, then trigger a test
              await fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
                method: "PUT", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sms_provider: smsProvider, sms_api_key: smsApiKey, sms_api_secret: smsApiSecret,
                  sms_sender_id: smsSenderId, sms_template_id: smsTemplateId, sms_from_number: smsFromNumber,
                })
              });
              toast.success("SMS config saved. Test OTP (000000) will be sent on next login attempt.");
            } catch { toast.error("Failed to save SMS config."); }
            finally { setSmsTestLoading(false); }
          };

          return (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* ── Razorpay Card ── */}
              <div className="rounded-3xl p-8 border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between mb-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-[16px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                      <span className="material-symbols-outlined text-[22px]" style={{ color: "#2563EB" }}>credit_card</span>
                      Razorpay Payment Gateway
                    </h2>
                    <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                      Keys saved here override environment variables and take effect immediately — no server restart needed.
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold ${
                    isRzpConfigured
                      ? isRzpLive ? "bg-green-500/15 text-green-700 border border-green-500/30" : "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                      : "bg-red-500/15 text-red-700 border border-red-500/30"
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">{isRzpConfigured ? (isRzpLive ? "check_circle" : "warning") : "cancel"}</span>
                    {isRzpConfigured ? (isRzpLive ? "Live Mode" : "Test Mode") : "Not Configured"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Key ID */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Razorpay Key ID</label>
                    <input
                      type="text"
                      value={rzpKeyId}
                      onChange={(e) => { setRzpKeyId(e.target.value); setRzpKeySecretSet(false); }}
                      placeholder="rzp_test_... or rzp_live_..."
                      className={inputCls} style={inputStyle}
                    />
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Public key — safe to expose to frontend checkout.</p>
                  </div>

                  {/* Key Secret */}
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Key Secret {rzpKeySecretSet && <span className="text-green-600 font-bold ml-1">✓ Set</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showRzpSecret ? "text" : "password"}
                        value={rzpKeySecret}
                        onChange={(e) => { setRzpKeySecret(e.target.value); setRzpKeySecretSet(false); }}
                        onFocus={() => { if (rzpKeySecret.includes("•")) setRzpKeySecret(""); }}
                        placeholder="Paste new secret here"
                        className={inputCls + " pr-12"} style={inputStyle}
                      />
                      <button type="button" onClick={() => setShowRzpSecret(!showRzpSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[18px] cursor-pointer"
                        style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined">{showRzpSecret ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Never exposed in API responses. Click to clear & enter new value.</p>
                  </div>

                  {/* Webhook Secret */}
                  <div className="md:col-span-2">
                    <label className={labelCls} style={labelStyle}>
                      Webhook Secret {rzpWebhookSet && <span className="text-green-600 font-bold ml-1">✓ Set</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showRzpWebhook ? "text" : "password"}
                        value={rzpWebhookSecret}
                        onChange={(e) => setRzpWebhookSecret(e.target.value)}
                        placeholder={rzpWebhookSet ? "(already set — paste to update)" : "Paste webhook secret here"}
                        className={inputCls + " pr-12"} style={inputStyle}
                      />
                      <button type="button" onClick={() => setShowRzpWebhook(!showRzpWebhook)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[18px] cursor-pointer"
                        style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined">{showRzpWebhook ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Used to verify Razorpay webhook signatures. Never exposed in API responses.</p>
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-blue-500">info</span>
                    Get your keys from{" "}
                    <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" className="text-blue-500 underline font-bold">Razorpay Dashboard → Settings → API Keys</a>.
                    {" "}Use <strong>rzp_test_*</strong> for testing (no real charges) and <strong>rzp_live_*</strong> for production.
                  </p>
                </div>
              </div>

              {/* ── SMS / OTP Provider Card ── */}
              <div className="rounded-3xl p-8 border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between mb-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-[16px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                      <span className="material-symbols-outlined text-[22px] text-purple-500">sms</span>
                      SMS / OTP Provider
                    </h2>
                    <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                      Configure a real SMS gateway to deliver OTPs to users. Until configured, <strong>000000</strong> works as demo code.
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold ${
                    smsProvider !== "none"
                      ? "bg-green-500/15 text-green-700 border border-green-500/30"
                      : "bg-slate-500/15 text-slate-600 border border-slate-500/30"
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">{smsProvider !== "none" ? "check_circle" : "developer_mode"}</span>
                    {smsProvider !== "none" ? `Live — ${SMS_PROVIDERS.find(p=>p.value===smsProvider)?.label || smsProvider}` : "Demo Mode (000000)"}
                  </div>
                </div>

                {/* Provider selector */}
                <div className="mb-6">
                  <label className={labelCls} style={labelStyle}>SMS Provider</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SMS_PROVIDERS.map(p => (
                      <button key={p.value} type="button"
                        onClick={() => setSmsProvider(p.value)}
                        className={`p-3 rounded-xl border text-[12px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          smsProvider === p.value ? "border-purple-500 bg-purple-500/10 text-purple-700" : "border-border bg-surface-alt"
                        }`} style={{ color: smsProvider === p.value ? undefined : "var(--text-muted)" }}>
                        <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {smsProvider !== "none" && (
                  <div className="space-y-5">
                    {/* API Key / Account SID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={labelCls} style={labelStyle}>
                          {smsProvider === "twilio" ? "Account SID" : "API Key"}
                        </label>
                        <input type="text" value={smsApiKey} onChange={(e) => setSmsApiKey(e.target.value)}
                          placeholder={smsProvider === "exotel" ? "API Key (Account SID)" : smsProvider === "twilio" ? "ACxxxxxxxx" : "Your API Key"}
                          className={inputCls} style={inputStyle} />
                      </div>

                      {/* API Secret / Auth Token */}
                      <div>
                        <label className={labelCls} style={labelStyle}>
                          {smsProvider === "twilio" || smsProvider === "exotel" ? "Auth Token" : "API Secret"}
                          {smsApiSecretSet && <span className="text-green-600 font-bold ml-1">✓ Set</span>}
                        </label>
                        <div className="relative">
                          <input type={showSmsSecret ? "text" : "password"} value={smsApiSecret}
                            onChange={(e) => { setSmsApiSecret(e.target.value); setSmsApiSecretSet(false); }}
                            onFocus={() => { if (smsApiSecret.includes("•")) setSmsApiSecret(""); }}
                            placeholder="Paste secret here"
                            className={inputCls + " pr-12"} style={inputStyle} />
                          <button type="button" onClick={() => setShowSmsSecret(!showSmsSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ color: "var(--text-muted)" }}>
                            <span className="material-symbols-outlined text-[18px]">{showSmsSecret ? "visibility_off" : "visibility"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Sender ID — not needed for Twilio */}
                      {smsProvider !== "twilio" && (
                        <div>
                          <label className={labelCls} style={labelStyle}>Sender ID</label>
                          <input type="text" value={smsSenderId} onChange={(e) => setSmsSenderId(e.target.value)}
                            placeholder="RENTLO" maxLength={6}
                            className={inputCls} style={inputStyle} />
                          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>6-char DLT registered sender ID. Required in India.</p>
                        </div>
                      )}

                      {/* DLT Template ID — MSG91 / Fast2SMS only */}
                      {(smsProvider === "msg91" || smsProvider === "fast2sms") && (
                        <div>
                          <label className={labelCls} style={labelStyle}>DLT Template ID</label>
                          <input type="text" value={smsTemplateId} onChange={(e) => setSmsTemplateId(e.target.value)}
                            placeholder="1707XXXXXXXXXXXXXXXXX"
                            className={inputCls} style={inputStyle} />
                          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Required by TRAI. Register at DLT portal.</p>
                        </div>
                      )}

                      {/* From Number — Twilio only */}
                      {smsProvider === "twilio" && (
                        <div>
                          <label className={labelCls} style={labelStyle}>From Number</label>
                          <input type="text" value={smsFromNumber} onChange={(e) => setSmsFromNumber(e.target.value)}
                            placeholder="+1XXXXXXXXXX"
                            className={inputCls} style={inputStyle} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={handleTestSms} disabled={smsTestLoading}
                        className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-extrabold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50">
                        {smsTestLoading
                          ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-[18px]">send</span>}
                        Save & Apply Config
                      </button>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Config is applied immediately. Real OTPs will be sent on next login attempt.</p>
                    </div>
                  </div>
                )}

                {smsProvider === "none" && (
                  <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                    <p className="text-[12px] font-semibold text-amber-700">
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
                      Demo mode is active. All OTP fields will accept <strong>000000</strong>. Select a provider above to enable real SMS delivery.
                    </p>
                  </div>
                )}
              </div>

              <button onClick={handleSave}
                className="h-11 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Credentials
              </button>
            </div>
          );
        })()}

        {/* TAB 3: E-STAMP & LEGAL */}
        {activeTab === "estamp" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-2 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-emerald-500 text-[22px]">
                  verified
                </span>
                Govt E-Stamp & Aadhaar E-Sign Feature Flag (Phase 2 Market Upgrade)
              </h2>
              <p className="text-[13px] mb-6 font-medium" style={{ color: "var(--text-muted)" }}>
                Turn ON to offer paid official State Government E-Stamp & Aadhaar E-Sign agreements to users. When OFF, users access the standard free digital agreement generator.
              </p>

              <div className="flex items-center justify-between p-5 rounded-2xl border mb-6 bg-surface-alt border-border">
                <div>
                  <h3 className="font-bold text-[15px]" style={{ color: "var(--ink)" }}>
                    Enable Paid Govt E-Stamping Upgrade
                  </h3>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    {enableEStamp ? "🟢 ACTIVE — Users can choose ₹499 Govt E-Stamp Upgrade" : "⚪ INACTIVE — Defaulting to Free Digital Lease Drafts"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableEStamp(!enableEStamp)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${
                    enableEStamp ? 'bg-emerald-600' : 'bg-slate-400'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      enableEStamp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                    E-Stamp Upgrade Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={eStampPrice}
                    onChange={(e) => setEStampPrice(e.target.value)}
                    className="h-11 px-3.5 rounded-xl border border-border bg-surface text-ink text-[13px] font-bold outline-none"
                    placeholder="499"
                  />
                  <span className="text-[11px] text-text-muted">Price charged to owner/tenant per agreement.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                    E-Stamp API Provider
                  </label>
                  <select
                    value={eStampProvider}
                    onChange={(e) => setEStampProvider(e.target.value)}
                    className="h-11 px-3.5 rounded-xl border border-border bg-surface text-ink text-[13px] font-bold outline-none cursor-pointer"
                  >
                    <option value="digio">Digio API (Recommended)</option>
                    <option value="signzy">Signzy API</option>
                    <option value="leegality">Leegality API</option>
                  </select>
                  <span className="text-[11px] text-text-muted">Active Govt E-Stamp & Aadhaar ESP provider.</span>
                </div>
              </div>

              {/* API Credentials Input Fields */}
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-4">
                <h4 className="text-[13px] font-extrabold text-ink flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-500">key</span>
                  {eStampProvider.toUpperCase()} Provider API Credentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      API Client ID / Key
                    </label>
                    <input
                      type="text"
                      value={eStampApiKey}
                      onChange={(e) => setEStampApiKey(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-border bg-surface text-ink text-[12.5px] font-mono outline-none"
                      placeholder={`Enter your ${eStampProvider.toUpperCase()} API Client ID...`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      API Client Secret
                    </label>
                    <input
                      type="password"
                      value={eStampApiSecret}
                      onChange={(e) => setEStampApiSecret(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-border bg-surface text-ink text-[12.5px] font-mono outline-none"
                      placeholder={`Enter your ${eStampProvider.toUpperCase()} API Client Secret...`}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-text-muted">
                  🔒 API credentials are stored securely in backend and used to procure ₹100 State Govt e-stamp paper & Aadhaar OTP signatures.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUTH & SECURITY */}
        {activeTab === "auth" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-blue-500 text-[22px]">
                  security
                </span>
                Role-Based Authentication Settings
              </h2>
              <p className="text-[13px] mb-6 font-medium" style={{ color: "var(--text-muted)" }}>
                Configure whether an SMS OTP is required for logging in or signing up for each role.
              </p>

              {(() => {
                const renderAuthToggleRow = (roleName, loginState, setLoginState, signupState, setSignupState) => (
                  <div className="flex items-center justify-between p-4 rounded-xl border mb-4 bg-surface-alt border-border">
                    <div className="w-1/3">
                      <h3 className="font-bold text-[14px] text-ink">{roleName}</h3>
                    </div>
                    <div className="w-1/3 flex flex-col items-center justify-center gap-2 border-l border-r border-border px-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Login OTP</span>
                      <button
                        type="button"
                        onClick={() => setLoginState(!loginState)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          loginState ? 'bg-emerald-500' : 'bg-slate-500/50'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loginState ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="w-1/3 flex flex-col items-center justify-center gap-2 pl-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Signup OTP</span>
                      <button
                        type="button"
                        onClick={() => setSignupState(!signupState)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          signupState ? 'bg-emerald-500' : 'bg-slate-500/50'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${signupState ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                );

                return (
                  <div>
                    {renderAuthToggleRow("Buyer", buyerOtpLogin, setBuyerOtpLogin, buyerOtpSignup, setBuyerOtpSignup)}
                    {renderAuthToggleRow("Owner", ownerOtpLogin, setOwnerOtpLogin, ownerOtpSignup, setOwnerOtpSignup)}
                    {renderAuthToggleRow("Agent", agentOtpLogin, setAgentOtpLogin, agentOtpSignup, setAgentOtpSignup)}
                    {renderAuthToggleRow("Admin", adminOtpLogin, setAdminOtpLogin, adminOtpSignup, setAdminOtpSignup)}
                  </div>
                );
              })()}
            </div>

            {/* Owner Listing Verification Method Card */}
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-2 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-orange-500 text-[22px]">verified_user</span>
                Owner Listing Verification Method
              </h2>
              <p className="text-[13px] mb-6 font-medium" style={{ color: "var(--text-muted)" }}>
                Choose how staff must verify the owner's identity when registering a property on their behalf.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* OTP Card */}
                <button
                  type="button"
                  onClick={() => setOwnerListingVerificationMethod("otp")}
                  className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    ownerListingVerificationMethod === "otp"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[28px] mt-0.5 ${
                      ownerListingVerificationMethod === "otp" ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    sms
                  </span>
                  <div>
                    <p className={`font-extrabold text-[13px] mb-1 ${
                      ownerListingVerificationMethod === "otp" ? "text-emerald-700" : "text-slate-700"
                    }`}>OTP Verification <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">RECOMMENDED</span></p>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      A 6-digit code is sent to the owner's phone. Staff can only proceed after the owner confirms.
                    </p>
                  </div>
                </button>

                {/* Selfie Card */}
                <button
                  type="button"
                  onClick={() => setOwnerListingVerificationMethod("selfie")}
                  className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    ownerListingVerificationMethod === "selfie"
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[28px] mt-0.5 ${
                      ownerListingVerificationMethod === "selfie" ? "text-orange-600" : "text-slate-400"
                    }`}
                  >
                    face_retouching_natural
                  </span>
                  <div>
                    <p className={`font-extrabold text-[13px] mb-1 ${
                      ownerListingVerificationMethod === "selfie" ? "text-orange-700" : "text-slate-700"
                    }`}>Live Selfie Capture</p>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Staff captures a live photo of the owner on-site. Stored as proof against the listing.
                    </p>
                  </div>
                </button>
              </div>

              <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-[11px] font-semibold ${
                ownerListingVerificationMethod === "otp"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-orange-50 text-orange-700 border border-orange-200"
              }`}>
                <span className="material-symbols-outlined text-[15px]">
                  {ownerListingVerificationMethod === "otp" ? "check_circle" : "camera_alt"}
                </span>
                {ownerListingVerificationMethod === "otp"
                  ? "Active: OTP will be sent to the owner's phone during staff-initiated listings."
                  : "Active: Staff must capture a live selfie of the owner during listing."
                }
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: THEME & BRANDING */}
        {activeTab === "theme" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-extrabold tracking-tight flex items-center gap-2 mb-6 border-b pb-4"
                style={{ color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-purple-500 text-[22px]">
                  palette
                </span>
                Platform Theme & Design System
              </h2>
              <div className="space-y-8">
                {/* 1. BUYER MARKETPLACE THEME SELECTION */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]">storefront</span>
                    <h3 className="text-[15px] font-extrabold text-ink">1. Buyer Marketplace Theme</h3>
                    <span className="text-[11px] font-medium text-text-muted">(Applies to public property search & tenant web portal)</span>
                  </div>
                  <div className="space-y-6">
                    {["Minimal Style", "Bento Grid Style", "Luxury Typography Style", "Neo-Brutalism Style", "Cyberpunk Style", "Neumorphic Style"].map((groupName) => {
                      const groupThemes = THEME_OPTIONS.filter((t) => t.styleGroup === groupName);
                      return (
                        <div key={groupName} className="p-4 rounded-2xl bg-surface-alt/40 border border-border/60">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-500 mb-3 border-l-2 border-indigo-500 pl-2">
                            {groupName}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {groupThemes.map((opt) => {
                              const isSelected = buyerTheme === opt.id;
                              return (
                                <div
                                  key={`buyer-${opt.id}`}
                                  onClick={() => {
                                    setBuyerTheme(opt.id);
                                    localStorage.setItem("rentlo_buyer_theme", opt.id);
                                    window.dispatchEvent(new Event("themeChange"));
                                    toast.info(`Set Buyer Marketplace Theme to ${opt.label}!`);
                                    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
                                      method: "PUT",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ buyer_theme: opt.id }),
                                    }).catch(() => {});
                                  }}
                                  style={{
                                    backgroundColor: opt.cardBg.startsWith("rgba") ? "transparent" : opt.cardBg,
                                    borderColor: isSelected ? opt.accentColor : opt.borderColor,
                                  }}
                                  className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 shadow-sm ${
                                    isSelected
                                      ? "ring-4 ring-emerald-500/30 shadow-lg scale-[1.02]"
                                      : "hover:border-slate-400 opacity-90 hover:opacity-100"
                                  } ${opt.id.startsWith("glass") ? "backdrop-blur-md" : ""}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        style={{ backgroundColor: opt.accentColor }}
                                        className="w-6 h-6 rounded-full shadow-md border-2 border-white flex items-center justify-center flex-shrink-0"
                                      >
                                        {isSelected && <span className="material-symbols-outlined text-[13px] text-white font-bold">check</span>}
                                      </div>
                                      <span style={{ color: opt.titleColor }} className="text-[14px] font-extrabold">
                                        {opt.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ color: opt.descColor }} className="text-[12px] font-semibold leading-relaxed">
                                    {opt.desc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. DASHBOARDS THEME SELECTION (OWNER & ADMIN CONSOLES) */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-indigo-500 text-[20px]">dashboard</span>
                    <h3 className="text-[15px] font-extrabold text-ink">2. Consoles & Dashboards Theme</h3>
                    <span className="text-[11px] font-medium text-text-muted">(Applies to Owner Console & Admin Console)</span>
                  </div>
                  <div className="space-y-6">
                    {["Minimal Style", "Bento Grid Style", "Luxury Typography Style", "Neo-Brutalism Style", "Cyberpunk Style", "Neumorphic Style"].map((groupName) => {
                      const groupThemes = THEME_OPTIONS.filter((t) => t.styleGroup === groupName);
                      return (
                        <div key={groupName} className="p-4 rounded-2xl bg-surface-alt/40 border border-border/60">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-500 mb-3 border-l-2 border-indigo-500 pl-2">
                            {groupName}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {groupThemes.map((opt) => {
                              const isSelected = dashboardTheme === opt.id;
                              return (
                                <div
                                  key={`dash-${opt.id}`}
                                  onClick={() => {
                                    setDashboardTheme(opt.id);
                                    localStorage.setItem("rentlo_dashboard_theme", opt.id);
                                    document.body.className = `theme-${opt.id.replace(/_/g, '-')}`;
                                    window.dispatchEvent(new Event("themeChange"));
                                    toast.info(`Set Consoles & Dashboards Theme to ${opt.label}!`);
                                    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, {
                                      method: "PUT",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ dashboard_theme: opt.id }),
                                    }).catch(() => {});
                                  }}
                                  style={{
                                    backgroundColor: opt.cardBg.startsWith("rgba") ? "transparent" : opt.cardBg,
                                    borderColor: isSelected ? opt.accentColor : opt.borderColor,
                                  }}
                                  className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 shadow-sm ${
                                    isSelected
                                      ? "ring-4 ring-cyan-500/30 shadow-lg scale-[1.02]"
                                      : "hover:border-slate-400 opacity-90 hover:opacity-100"
                                  } ${opt.id.startsWith("glass") ? "backdrop-blur-md" : ""}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        style={{ backgroundColor: opt.accentColor }}
                                        className="w-6 h-6 rounded-full shadow-md border-2 border-white flex items-center justify-center flex-shrink-0"
                                      >
                                        {isSelected && <span className="material-symbols-outlined text-[13px] text-white font-bold">check</span>}
                                      </div>
                                      <span style={{ color: opt.titleColor }} className="text-[14px] font-extrabold">
                                        {opt.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ color: opt.descColor }} className="text-[12px] font-semibold leading-relaxed">
                                    {opt.desc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT LOG TRAIL */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div
              className="rounded-3xl p-8 border shadow-sm transition-all duration-300"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-[16px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: "var(--accent)" }}>
                      history
                    </span>
                    Platform Settings Audit Log Trail
                  </h2>
                  <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                    Immutable record of all admin settings changes, fee updates, and bypass security toggles.
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border transition-all cursor-pointer"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingAudit ? "animate-spin" : ""}`}>refresh</span>
                  Refresh Log
                </button>
              </div>

              {loadingAudit ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin mx-auto mb-3"></div>
                  <p className="text-[13px] font-medium text-slate-500">Loading audit history...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed" style={{ borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[36px] mb-2" style={{ color: "var(--text-muted)" }}>history_toggle_off</span>
                  <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>No Audit Log Records Found</p>
                  <p className="text-[12px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>Setting changes will automatically be recorded here with user &amp; IP address details.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-[11px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-4">User</th>
                        <th className="py-3.5 px-4">Setting Field</th>
                        <th className="py-3.5 px-4">Previous Value</th>
                        <th className="py-3.5 px-4">New Value</th>
                        <th className="py-3.5 px-4">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-[13px] font-medium" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-black/5 transition-colors">
                          <td className="py-3.5 px-4 text-[12px] whitespace-nowrap opacity-80">
                            {new Date(log.changed_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px] text-indigo-500">account_circle</span>
                              {log.changed_by}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[12px] text-amber-600 font-bold whitespace-nowrap">
                            {log.field_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[12px] text-red-500 line-through opacity-75 whitespace-nowrap">
                            {log.old_value || "(empty)"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[12px] text-emerald-600 font-bold whitespace-nowrap">
                            {log.new_value}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] opacity-70 whitespace-nowrap">
                            {log.ip_address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};
