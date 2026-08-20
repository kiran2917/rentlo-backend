import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { toast } from "react-toastify";

export const BuyerLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuth } = useAuth();

  // Main Tab: "login" (default) | "signup"
  const [activeTab, setActiveTab] = useState("login");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam === "signup") {
      setActiveTab("signup");
    } else if (tabParam === "login") {
      setActiveTab("login");
    }
  }, [location.search]);

  // Auth Sub-Mode for Login: "password" (default) | "otp" | "forgot_password"
  const [authMode, setAuthMode] = useState("password");

  // Phone + Password Login State
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up Direct Form State
  const [signUpName, setSignUpName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // OTP Login & Registration State
  const [otpStep, setOtpStep] = useState(1); // 1: Request OTP, 2: Enter Code / Register
  const [otpCode, setOtpCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [registrationToken, setRegistrationToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRegPassword, setNewRegPassword] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [dpdpConsent, setDpdpConsent] = useState(true);

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState(1); // 1: Request OTP, 2: Reset Password with OTP
  const [resetPhone, setResetPhone] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [forgotDemoCode, setForgotDemoCode] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [requireOtpLogin, setRequireOtpLogin] = useState(false);
  const [requireOtpSignup, setRequireOtpSignup] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((res) => res.json())
      .then((data) => {
        setRequireOtpLogin(Boolean(data.buyer_require_otp_login));
        setRequireOtpSignup(data.buyer_require_otp_signup ?? true);
      })
      .catch((err) => console.error("Failed to load platform settings for BuyerLogin:", err));
  }, []);

  // -------------------------------------------------------------
  // 1. PHONE & PASSWORD LOGIN
  // -------------------------------------------------------------
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10 || !['6', '7', '8', '9'].includes(cleanPhone[0])) {
      toast.error("Please enter a valid 10-digit mobile number starting with 6-9.");
      return;
    }
    if (!password) {
      toast.error("Please enter your account password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: cleanPhone, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        toast.success("Welcome back to Rentlo!");
        await checkAuth();
        navigate("/", { replace: true });
      } else {
        toast.error(data.detail || "Invalid mobile number or password.");
      }
    } catch (err) {
      toast.error("Network error logging in.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. DIRECT SIGN UP FLOW
  // -------------------------------------------------------------
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (!dpdpConsent) {
      toast.error("You must agree to the Privacy Policy & DPDP Act consent.");
      return;
    }
    const cleanPhone = signUpPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!signUpName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!signUpPassword || signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Send OTP request (backend checks admin platform settings)
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, intended_role: "buyer", action: "signup" }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhone(cleanPhone);
        setFullName(signUpName.trim());
        setNewRegPassword(signUpPassword);

        // If Admin disabled OTP signup, automatically verify & complete registration directly
        if (data.require_otp === false) {
          const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ phone: cleanPhone, code: "000000", intended_role: "buyer" }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.is_new_user) {
            const regRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete-registration/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                registration_token: verifyData.registration_token,
                first_name: signUpName.trim(),
                password: signUpPassword,
              }),
            });
            if (regRes.ok) {
              toast.success("Account created successfully! Welcome to Rentlo.");
              await checkAuth();
              window.location.href = "/";
              return;
            }
          }
        }

        // Standard OTP verification step when OTP is enabled
        setActiveTab("login");
        setAuthMode("otp");
        setOtpStep(2);
        setIsNewUser(true);
        setDemoCode(data.demo_code || "");
        toast.success(data.detail || "Verification OTP sent to your mobile number.");
      } else {
        toast.error(data.detail || "Failed to send sign up verification OTP.");
      }
    } catch (err) {
      toast.error("Network error starting sign up.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 3. FORGOT PASSWORD FLOW
  // -------------------------------------------------------------
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    const cleanPhone = resetPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotStep(2);
        setForgotDemoCode(data.demo_code || "");
        toast.success(data.detail || "Reset OTP sent to your mobile number!");
      } else {
        toast.error(data.detail || "Failed to send reset OTP.");
      }
    } catch (err) {
      toast.error("Network error sending reset OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResetSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = resetPhone.replace(/\D/g, "");
    if (!resetOtpCode || resetOtpCode.length < 4) {
      toast.error("Please enter a valid 6-digit OTP code.");
      return;
    }
    if (!resetPassword || resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          code: resetOtpCode,
          new_password: resetPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password updated successfully! Please log in.");
        setPhone(cleanPhone);
        setPassword(resetPassword);
        setActiveTab("login");
        setAuthMode("password");
        setForgotStep(1);
        setResetOtpCode("");
        setResetPassword("");
        setConfirmResetPassword("");
      } else {
        toast.error(data.detail || "Failed to reset password.");
      }
    } catch (err) {
      toast.error("Network error resetting password.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 4. OTP LOGIN / SIGNUP FLOW
  // -------------------------------------------------------------
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!dpdpConsent) {
      toast.error("You must agree to the Privacy Policy & DPDP Act consent.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, intended_role: "buyer" }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpStep(2);
        setDemoCode(data.demo_code || "");
        toast.success(data.detail || "OTP sent to your mobile number.");
      } else {
        toast.error(data.detail || "Failed to send OTP.");
      }
    } catch (err) {
      toast.error("Network error sending OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (!otpCode || otpCode.length < 4) {
      toast.error("Please enter a valid OTP code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: cleanPhone, code: otpCode, intended_role: "buyer" }),
      });
      const data = await res.json();
      if (res.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        if (data.is_new_user) {
          setIsNewUser(true);
          setRegistrationToken(data.registration_token);

          // Auto-complete registration if full name & password were set in Sign Up form
          if (fullName.trim() && newRegPassword) {
            const regRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete-registration/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                registration_token: data.registration_token,
                first_name: fullName.trim(),
                password: newRegPassword,
              }),
            });
            const regData = await regRes.json();
            if (regRes.ok) {
              toast.success("Account created successfully! Welcome to Rentlo.");
              await checkAuth();
              window.location.href = "/";
              return;
            } else {
              toast.error(regData.detail || "Registration completion failed.");
            }
          }
        } else {
          toast.success("Welcome back to Rentlo!");
          await checkAuth();
          window.location.href = "/";
        }
      } else {
        toast.error(data.detail || "Invalid OTP code.");
      }
    } catch (err) {
      toast.error("Network error verifying OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (!newRegPassword || newRegPassword.length < 6) {
      toast.error("Password is mandatory and must be at least 6 characters.");
      return;
    }
    if (!dpdpConsent) {
      toast.error("You must agree to the Privacy Policy & DPDP Act consent.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete-registration/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          registration_token: registrationToken,
          first_name: fullName.trim(),
          password: newRegPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        toast.success("Account created successfully!");
        await checkAuth();
        window.location.href = "/";
      } else {
        toast.error(data.detail || "Registration failed.");
      }
    } catch (err) {
      toast.error("Network error registering.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
      className="min-h-screen flex flex-col justify-center py-2 sm:py-4 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300 relative overflow-hidden"
    >
      {/* Background Decor Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: "var(--accent)" }} />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ backgroundColor: "var(--accent)" }} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        {/* Back to Home Button + Logo Bar */}
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-extrabold border shadow-sm transition-all hover:-translate-x-0.5"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--ink)",
            }}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Home</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md transition-transform group-hover:scale-105" style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}>
              R
            </div>
            <span className="text-lg font-black tracking-tight" style={{ color: "var(--ink)" }}>
              Rentlo
            </span>
          </Link>
        </div>

        {/* Top Role Switcher Header */}
        <div className="flex justify-center mb-2">
          <div className="p-0.5 rounded-xl flex items-center gap-0.5 border shadow-inner max-w-xs sm:max-w-md w-full justify-between backdrop-blur-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <button
              type="button"
              className="flex-1 py-1 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-1"
              style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}
            >
              <span className="material-symbols-outlined text-[14px]">home_pin</span>
              Tenant / Buyer
            </button>
            <button
              type="button"
              onClick={() => navigate(`/owner/login?tab=${activeTab}`)}
              className="flex-1 py-1 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider opacity-60 hover:opacity-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
              style={{ color: "var(--ink)" }}
            >
              <span className="material-symbols-outlined text-[14px]">real_estate_agent</span>
              Owner Portal ➔
            </button>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
          {authMode === "forgot_password"
            ? "Reset Account Password"
            : activeTab === "signup"
            ? "Create Your Free Account"
            : authMode === "otp"
            ? "OTP Authentication"
            : "Sign In to Your Account"}
        </h2>
        <p className="mt-0.5 text-[11px] font-medium opacity-70" style={{ color: "var(--ink)" }}>
          {activeTab === "signup"
            ? "Join Rentlo for zero-brokerage verified properties & direct contacts"
            : "Direct verified owner contact • Zero brokerage • Legal lease agreements"}
        </p>
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div
          className="py-4 px-4 sm:px-6 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* PRIMARY SWITCHER: SIGN IN vs SIGN UP */}
          {authMode !== "forgot_password" && (
            <div
              className="flex p-0.5 rounded-xl mb-3 border shadow-inner"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setAuthMode("password"); setOtpStep(1); }}
                className="flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                style={{
                  backgroundColor: activeTab === "login" ? "var(--accent)" : "transparent",
                  color: activeTab === "login" ? "var(--btn-text, #ffffff)" : "var(--ink)",
                  opacity: activeTab === "login" ? 1 : 0.6,
                }}
              >
                <span className="material-symbols-outlined text-[15px]">login</span>
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("signup"); setOtpStep(1); setIsNewUser(false); }}
                className="flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                style={{
                  backgroundColor: activeTab === "signup" ? "var(--accent)" : "transparent",
                  color: activeTab === "signup" ? "var(--btn-text, #ffffff)" : "var(--ink)",
                  opacity: activeTab === "signup" ? 1 : 0.6,
                }}
              >
                <span className="material-symbols-outlined text-[15px]">person_add</span>
                Sign Up
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: SIGN IN MODE */}
          {/* ========================================================= */}
          {activeTab === "login" && (
            <>
              {/* Login Sub-Mode Switcher: Password vs OTP */}
              {authMode !== "forgot_password" && requireOtpLogin && (
                <div className="flex justify-center gap-4 mb-3 text-[11px] font-extrabold pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setAuthMode("password")}
                    className="cursor-pointer transition-all flex items-center gap-1"
                    style={{
                      color: authMode === "password" ? "var(--accent)" : "var(--ink)",
                      opacity: authMode === "password" ? 1 : 0.6,
                      textDecoration: authMode === "password" ? "underline" : "none",
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    Phone &amp; Password
                  </button>
                  <span style={{ color: "var(--border)" }}>|</span>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("otp"); setOtpStep(1); setIsNewUser(false); }}
                    className="cursor-pointer transition-all flex items-center gap-1"
                    style={{
                      color: authMode === "otp" ? "var(--accent)" : "var(--ink)",
                      opacity: authMode === "otp" ? 1 : 0.6,
                      textDecoration: authMode === "otp" ? "underline" : "none",
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]">sms</span>
                    Login with OTP
                  </button>
                </div>
              )}

              {/* MODE 1A: PHONE & PASSWORD LOGIN */}
              {authMode === "password" && (
                <form onSubmit={handlePasswordLogin} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                      Mobile Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-xs" style={{ color: "var(--text-muted)" }}>
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="9876543210"
                        required
                        className="w-full h-10 pl-11 pr-3 rounded-xl text-[13px] font-bold border outline-none transition-all"
                        style={{
                          backgroundColor: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        Account Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setAuthMode("forgot_password"); setResetPhone(phone); setForgotStep(1); }}
                        className="text-[11px] font-extrabold hover:underline cursor-pointer"
                        style={{ color: "var(--accent)" }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full h-10 pl-3 pr-10 rounded-xl text-[13px] font-bold border outline-none transition-all"
                        style={{
                          backgroundColor: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--ink)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.99]"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--btn-text, #ffffff)",
                    }}
                  >
                    {loading ? (
                      <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    ) : (
                      <>
                        <span>Sign In to Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 1B: FORGOT PASSWORD FLOW */}
              {authMode === "forgot_password" && (
                <div>
                  {forgotStep === 1 ? (
                    <form onSubmit={handleForgotRequestOtp} className="space-y-5">
                      <div className="p-3.5 rounded-2xl border text-[12px] font-medium leading-relaxed mb-2" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                        Enter your registered 10-digit mobile number. We will send a 6-digit OTP code to verify and reset your password.
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                          Registered Mobile Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-sm" style={{ color: "var(--text-muted)" }}>
                            +91
                          </div>
                          <input
                            type="tel"
                            maxLength={10}
                            value={resetPhone}
                            onChange={(e) => setResetPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="9876543210"
                            required
                            className="w-full h-12 pl-12 pr-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                            style={{
                              backgroundColor: "var(--bg)",
                              borderColor: "var(--border)",
                              color: "var(--ink)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setAuthMode("password")}
                          className="w-1/3 h-12 rounded-2xl text-[13px] font-extrabold border transition-all cursor-pointer"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-2/3 h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:opacity-90"
                          style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}
                        >
                          {loading ? "Sending OTP..." : "Send Reset OTP"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleForgotResetSubmit} className="space-y-4">
                      {forgotDemoCode && (
                        <div className="p-3 rounded-2xl text-center text-[12px] font-bold border" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "var(--accent)", color: "var(--accent)" }}>
                          🔑 Demo OTP Code: <span className="font-mono text-[14px] underline">{forgotDemoCode}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                          6-Digit OTP Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={resetOtpCode}
                          onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          required
                          className="w-full h-12 rounded-2xl text-center text-[18px] font-black tracking-[0.5em] border outline-none transition-all"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                          New Password (min 6 chars)
                        </label>
                        <div className="relative">
                          <input
                            type={showResetPass ? "text" : "password"}
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full h-12 pl-4 pr-12 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPass(!showResetPass)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer p-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {showResetPass ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmResetPassword}
                          onChange={(e) => setConfirmResetPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full h-12 px-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setForgotStep(1)}
                          className="w-1/3 h-12 rounded-2xl text-[13px] font-extrabold border transition-all cursor-pointer"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-2/3 h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:opacity-90"
                          style={{ backgroundColor: "var(--accent)", color: "var(--btn-text, #ffffff)" }}
                        >
                          {loading ? "Updating Password..." : "Update & Sign In"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* MODE 1C: OTP LOGIN / REGISTRATION */}
              {authMode === "otp" && (
                <div>
                  {otpStep === 1 ? (
                    <form onSubmit={handleRequestOtp} className="space-y-5">
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                          Mobile Phone Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-sm" style={{ color: "var(--text-muted)" }}>
                            +91
                          </div>
                          <input
                            type="tel"
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="9876543210"
                            required
                            className="w-full h-12 pl-12 pr-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                            style={{
                              backgroundColor: "var(--bg)",
                              borderColor: "var(--border)",
                              color: "var(--ink)",
                            }}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all hover:opacity-90"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--btn-text, #ffffff)",
                        }}
                      >
                        {loading ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                        ) : (
                          <>
                            <span>Get Verification OTP</span>
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : !isNewUser ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      {demoCode && (
                        <div className="p-3 rounded-2xl text-center text-[12px] font-bold border" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "var(--accent)", color: "var(--accent)" }}>
                          🔑 Demo OTP Code: <span className="font-mono text-[14px] underline">{demoCode}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                          Enter Verification Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          required
                          className="w-full h-12 text-center text-[18px] font-black tracking-[0.5em] rounded-2xl border outline-none transition-all"
                          style={{
                            backgroundColor: "var(--bg)",
                            borderColor: "var(--border)",
                            color: "var(--ink)",
                          }}
                        />
                        <p className="mt-2 text-[12px] text-center font-medium" style={{ color: "var(--text-muted)" }}>
                          Sent to +91 {phone} •{" "}
                          <button
                            type="button"
                            onClick={() => setOtpStep(1)}
                            className="font-extrabold hover:underline cursor-pointer"
                            style={{ color: "var(--accent)" }}
                          >
                            Change Number
                          </button>
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all hover:opacity-90"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--btn-text, #ffffff)",
                        }}
                      >
                        {loading ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                        ) : (
                          <span>Verify OTP &amp; Continue</span>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* NEW USER REGISTRATION STEP: MANDATORY NAME & PASSWORD */
                    <form onSubmit={handleCompleteRegistration} className="space-y-4">
                      <div className="p-3 rounded-2xl border text-[12px] font-bold" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "var(--accent)", color: "var(--accent)" }}>
                        ✨ OTP Verified! Complete registration to finish setting up your account.
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Rahul Sharma"
                          required
                          className="w-full h-12 px-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Create Account Password * (min 6 chars)
                        </label>
                        <input
                          type="password"
                          value={newRegPassword}
                          onChange={(e) => setNewRegPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full h-12 px-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
                        />
                      </div>

                      <div className="flex items-start gap-2.5 p-3 rounded-2xl border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                        <input
                          type="checkbox"
                          id="dpdp-reg-buyer"
                          checked={dpdpConsent}
                          onChange={(e) => setDpdpConsent(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded cursor-pointer"
                        />
                        <label htmlFor="dpdp-reg-buyer" className="text-[11px] font-medium leading-relaxed cursor-pointer" style={{ color: "var(--text-muted)" }}>
                          I agree to the <span className="font-extrabold" style={{ color: "var(--ink)" }}>Privacy Policy (v1.0)</span> and consent to data processing under DPDP Act protocols.
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all hover:opacity-90"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--btn-text, #ffffff)",
                        }}
                      >
                        {loading ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                        ) : (
                          <span>Complete Registration &amp; Sign In</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Sign In Footer Prompt */}
              <div className="mt-6 pt-5 border-t text-center space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setActiveTab("signup"); setOtpStep(1); setIsNewUser(false); }}
                    className="font-extrabold hover:underline cursor-pointer"
                    style={{ color: "var(--accent)" }}
                  >
                    Create Account / Sign Up →
                  </button>
                </p>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Are you a Property Owner?{" "}
                  <Link to="/owner/login" className="font-extrabold hover:underline" style={{ color: "var(--accent)" }}>
                    Owner Portal Login →
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SIGN UP MODE */}
          {/* ========================================================= */}
          {activeTab === "signup" && (
            <>
              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="Rahul Sharma"
                      required
                      className="w-full h-12 pl-10 pr-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                      style={{
                        backgroundColor: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: "var(--text-muted)" }}>
                      person
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Mobile Phone Number *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-sm" style={{ color: "var(--text-muted)" }}>
                      +91
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="9876543210"
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                      style={{
                        backgroundColor: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Create Password * (min 6 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showSignUpPassword ? "text" : "password"}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full h-12 pl-10 pr-12 rounded-2xl text-[14px] font-bold border outline-none transition-all"
                      style={{
                        backgroundColor: "var(--bg)",
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: "var(--text-muted)" }}>
                      lock
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer p-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showSignUpPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* DPDP Act Affirmative Consent Checkbox */}
                <div className="flex items-start gap-2.5 p-3 rounded-2xl border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <input
                    type="checkbox"
                    id="dpdp-consent-signup"
                    checked={dpdpConsent}
                    onChange={(e) => setDpdpConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded cursor-pointer"
                  />
                  <label htmlFor="dpdp-consent-signup" className="text-[11px] font-medium leading-relaxed cursor-pointer" style={{ color: "var(--text-muted)" }}>
                    I agree to the <span className="font-extrabold" style={{ color: "var(--ink)" }}>Privacy Policy (v1.0)</span> and consent to data processing under DPDP Act protocols.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--btn-text, #ffffff)",
                  }}
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Create Account &amp; Verify OTP</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Sign Up Footer Prompt */}
              <div className="mt-6 pt-5 border-t text-center space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setActiveTab("login"); setAuthMode("password"); }}
                    className="font-extrabold hover:underline cursor-pointer"
                    style={{ color: "var(--accent)" }}
                  >
                    Sign In to Account →
                  </button>
                </p>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Are you a Property Owner?{" "}
                  <Link to="/owner/login" className="font-extrabold hover:underline" style={{ color: "var(--accent)" }}>
                    Owner Portal Login →
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
