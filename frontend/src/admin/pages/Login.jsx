import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [throttleMessage, setThrottleMessage] = useState("");
  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState({ text: "", type: "" });

  const handleRequestForgotOtp = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    setForgotLoading(true);
    setForgotMsg({ text: "", type: "" });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotStep(2);
        setForgotOtp(data.demo_code || "123456");
        setForgotMsg({ text: data.detail || "OTP generated. Enter OTP and new password.", type: "success" });
      } else {
        setForgotMsg({ text: data.detail || "Account not found.", type: "error" });
      }
    } catch (err) {
      setForgotMsg({ text: "Failed to request password reset OTP.", type: "error" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotOtp || !forgotNewPass) return;
    setForgotLoading(true);
    setForgotMsg({ text: "", type: "" });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotInput.trim(), code: forgotOtp.trim(), new_password: forgotNewPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg({ text: "Password reset successful! You can now sign in with your new password.", type: "success" });
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setUsername(forgotInput.trim());
          setPassword(forgotNewPass);
        }, 1500);
      } else {
        setForgotMsg({ text: data.detail || "Failed to reset password.", type: "error" });
      }
    } catch (err) {
      setForgotMsg({ text: "Network error resetting password.", type: "error" });
    } finally {
      setForgotLoading(false);
    }
  };

  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorType(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (response.ok) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        await checkAuth();
        navigate("/admin");
      } else if (response.status === 401) {
        const data = await response.json();
        const detail = (data.detail || "").toLowerCase();
        if (detail.includes("disabled") || detail.includes("inactive user") || detail.includes("banned") || detail.includes("suspended")) {
          setErrorType("disabled");
        } else {
          setErrorType("credentials");
        }
      } else if (response.status === 429) {
        const data = await response.json();
        setThrottleMessage(data.detail || "API rate limit reached. Please wait before retrying.");
        setErrorType("throttled");
      } else {
        setErrorType("network");
      }
    } catch (err) {
      setErrorType("network");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 antialiased p-4 relative">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-[12.5px] font-bold transition-all shadow-sm cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Back to Home</span>
      </Link>

      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-950 rounded-xl flex items-center justify-center mb-6 shadow-md border border-slate-800/80">
            <span className="material-symbols-outlined text-white text-4xl">
              real_estate_agent
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Rentlo Admin
          </h1>
          <p className="text-[13px] text-slate-500 font-medium text-center max-w-xs">
            Secure access to the management portal. Sign in to continue.
          </p>
        </div>

        {/* Error States */}
        {errorType === "credentials" && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-red-600 mt-0.5 flex-shrink-0">
              warning
            </span>
            <div>
              <p className="text-[13px] text-red-800 font-bold">
                Invalid Credentials
              </p>
              <p className="text-[12px] text-red-700 mt-0.5">
                The username or password you entered is incorrect. Please try
                again.
              </p>
            </div>
          </div>
        )}

        {errorType === "throttled" && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3 shadow-sm">
            <span className="material-symbols-outlined text-orange-600 mt-0.5 flex-shrink-0 text-[22px]">
              timer
            </span>
            <div>
              <p className="text-[13px] text-orange-900 font-extrabold">
                Rate Limit Exceeded (HTTP 429)
              </p>
              <p className="text-[12px] text-orange-800 font-medium mt-0.5 leading-relaxed">
                {throttleMessage || "Too many login attempts. Please wait a moment before trying again."}
              </p>
            </div>
          </div>
        )}

        {errorType === "network" && (
          <div className="mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 shadow-sm" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "var(--accent)" }}>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>
                wifi_off
              </span>
              <div>
                <p className="text-[13px] font-extrabold" style={{ color: "var(--ink)" }}>
                  Connection Failed
                </p>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Unable to connect to the server. Please verify backend server status.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}
              className="px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold text-white shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 hover:opacity-90 transition-all"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {errorType === "disabled" && (
          <div className="mb-6 p-4 bg-slate-100 border border-slate-300 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-slate-500 mt-0.5 flex-shrink-0">
              block
            </span>
            <div>
              <p className="text-[13px] text-slate-700 font-bold">
                Account Disabled
              </p>
              <p className="text-[12px] text-slate-600 mt-0.5">
                This account has been suspended or deactivated. Contact IT
                support.
              </p>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide block mb-1.5"
                htmlFor="admin-username"
              >
                Username
              </label>
              <div className="flex w-full rounded-lg border border-slate-300 bg-white focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 transition-all shadow-sm overflow-hidden h-11">
                <div className="flex items-center px-3 border-r border-slate-200 bg-slate-50">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    person
                  </span>
                </div>
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="flex-1 bg-transparent border-none px-3 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:ring-0 outline-none w-full"
                  placeholder="admin_user"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide block"
                  htmlFor="admin-password"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep(1);
                    setForgotInput(username);
                    setForgotMsg({ text: "", type: "" });
                  }}
                  className="text-[12px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="flex w-full rounded-lg border border-slate-300 bg-white focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 transition-all shadow-sm overflow-hidden h-11">
                <div className="flex items-center px-3 border-r border-slate-200 bg-slate-50">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    lock
                  </span>
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="flex-1 bg-transparent border-none px-3 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:ring-0 outline-none w-full"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 text-slate-400 hover:text-slate-600 transition-colors bg-white"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="admin-login-btn"
              disabled={isLoading || !username || !password}
              className="w-full bg-slate-900 text-white text-[13px] font-medium py-3 rounded-xl shadow-md hover:bg-black transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">
                    progress_activity
                  </span>
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-widest mt-8">
          Rentlo Management Portal · Secure Access Only
        </p>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-orange-500/20">
                <span className="material-symbols-outlined text-[26px]">lock_reset</span>
              </div>
              <h3 className="text-[18px] font-extrabold text-slate-900">Reset Account Password</h3>
              <p className="text-[12px] text-slate-500 font-medium mt-1">
                {forgotStep === 1 ? "Enter your username or mobile number to receive a verification OTP." : "Enter the verification OTP and your new password."}
              </p>
            </div>

            {forgotMsg.text && (
              <div className={`p-3 rounded-2xl text-[12px] font-bold mb-4 ${forgotMsg.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>
                {forgotMsg.text}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestForgotOtp} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Username or Mobile Number
                  </label>
                  <input
                    type="text"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    placeholder="Enter registered username or phone"
                    required
                    className="w-full h-12 px-4 rounded-2xl border border-slate-300 text-[14px] font-bold text-slate-900 outline-none focus:border-orange-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotInput.trim()}
                  className="w-full h-12 rounded-2xl bg-orange-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 shadow-lg hover:bg-orange-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  ) : (
                    <span>Send Reset OTP</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Verification OTP
                  </label>
                  <input
                    type="text"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP code"
                    required
                    className="w-full h-12 px-4 rounded-2xl border border-slate-300 text-[14px] font-bold text-slate-900 outline-none focus:border-orange-500 transition-all tracking-widest text-center"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    New Password (min 6 chars)
                  </label>
                  <input
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="Enter new strong password"
                    required
                    minLength={6}
                    className="w-full h-12 px-4 rounded-2xl border border-slate-300 text-[14px] font-bold text-slate-900 outline-none focus:border-orange-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotOtp || !forgotNewPass}
                  className="w-full h-12 rounded-2xl bg-slate-900 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 shadow-lg hover:bg-black transition-all cursor-pointer disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  ) : (
                    <span>🔐 Confirm &amp; Reset Password</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
