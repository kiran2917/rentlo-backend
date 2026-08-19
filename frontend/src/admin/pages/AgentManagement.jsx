import React, { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const AgentManagement = () => {
  const [activeTab, setActiveTab] = useState("agents"); // "agents" | "kyc"
  const [agents, setAgents] = useState([]);
  const [agentKycs, setAgentKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Create Agent Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchAgentKycs();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/users/`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.filter(u => u.roles?.includes("agent") || u.role === "agent"));
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load Field Agents.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentKycs = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/agent-kyc/`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setAgentKycs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAgentStatus = async (agentId, currentActive) => {
    const actionText = currentActive ? "deactivate (remove)" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${actionText} this Field Agent?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/crm/${agentId}/toggle-status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.detail || `Agent status updated!`);
        fetchAgents();
      } else {
        toast.error("Failed to update Agent status.");
      }
    } catch (e) {
      toast.error("Network error updating status.");
    }
  };

  const handleReviewKyc = async (kycId, action) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/admin/agent-kyc/${kycId}/review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, reason: rejectionReason })
      });
      if (res.ok) {
        toast.success(`Agent KYC ${action === 'approve' ? 'Approved' : 'Rejected'} successfully!`);
        setSelectedKyc(null);
        setRejectionReason("");
        fetchAgentKycs();
        fetchAgents();
      } else {
        toast.error("Failed to update KYC status.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Username and initial password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/sub-admins/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          role: "agent"
        })
      });
      if (res.ok) {
        toast.success(`Field Agent @${username} provisioned successfully!`);
        setModalOpen(false);
        setUsername("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setPhone("");
        fetchAgents();
        fetchAgentKycs();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to create Field Agent.");
      }
    } catch (e) {
      toast.error("Network error provisioning Field Agent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout activeTab="agents">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              Field Agent Roster &amp; Verification
            </h1>
            <p className="text-[13px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
              Provision Field Agents, inspect Karnataka Aadhaar/PAN KYC documents, &amp; verify payout bank accounts.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="h-11 px-5 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            + Provision Field Agent
          </button>
        </div>

        {/* Compact Segmented Control Tab Bar */}
        <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl border mb-8 shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <button
            onClick={() => setActiveTab("agents")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer"
            style={{
              backgroundColor: activeTab === "agents" ? "var(--accent)" : "transparent",
              color: activeTab === "agents" ? "#ffffff" : "var(--text-muted)"
            }}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            Active Field Agents ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab("kyc")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-extrabold transition-all cursor-pointer relative"
            style={{
              backgroundColor: activeTab === "kyc" ? "var(--accent)" : "transparent",
              color: activeTab === "kyc" ? "#ffffff" : "var(--text-muted)"
            }}
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            Karnataka KYC Verification ({agentKycs.length})
            {agentKycs.filter(k => k.status === 'submitted').length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>
        </div>

        {/* TAB 1: FIELD AGENTS ROSTER */}
        {activeTab === "agents" && (
          <>
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 rounded-full border-[3px] border-slate-300 border-t-slate-900 animate-spin"></div>
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-3xl p-12 text-center border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[32px]">badge</span>
                </div>
                <h3 className="text-[18px] font-extrabold mb-1" style={{ color: "var(--ink)" }}>No Field Agents Provisioned Yet</h3>
                <p className="text-[13px] max-w-md mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
                  Provision Field Agent credentials. They will receive credentials and complete password change &amp; Karnataka KYC verification on first login.
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase tracking-widest rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  Provision First Field Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-950 text-white font-extrabold flex items-center justify-center border-2 border-slate-800 shrink-0 shadow-sm">
                            {agent.kyc_selfie_url ? (
                              <img src={agent.kyc_selfie_url} alt={agent.username} className="w-full h-full object-cover" />
                            ) : (
                              <span>{agent.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-[15px] leading-tight" style={{ color: "var(--ink)" }}>
                              {agent.first_name ? `${agent.first_name} ${agent.last_name || ""}` : agent.username}
                            </h3>
                            <span className="text-[11.5px] font-medium block mt-0.5" style={{ color: "var(--text-muted)" }}>
                              @{agent.username} {agent.phone ? `· ${agent.phone}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>KYC Status:</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10.5px] border ${
                          agent.kyc_status === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        }`}>
                          {agent.kyc_status === 'verified' ? '🟢 Verified Partner' : '🟡 KYC Pending'}
                        </span>
                      </div>

                      {/* Account Active Status & Toggle Control */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl border bg-slate-50/50" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status:</span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-[10px] border ${
                            agent.is_active !== false
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-600 border-red-500/30'
                          }`}>
                            {agent.is_active !== false ? '🟢 Active' : '🔴 Inactive'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleAgentStatus(agent.id, agent.is_active !== false)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                            agent.is_active !== false
                              ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {agent.is_active !== false ? '🛑 Deactivate Agent' : '🟢 Reactivate Agent'}
                        </button>
                      </div>

                      {/* Agent Info Details Container */}
                      <div className="p-3.5 rounded-2xl border text-[12px] space-y-2" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Payout UPI ID:</span>
                          <span className="font-extrabold text-emerald-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">qr_code_2</span>
                            {agent.kyc_upi_id || "Not configured"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Phone Number:</span>
                          <span className="font-extrabold" style={{ color: "var(--ink)" }}>{agent.phone || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-4 mt-4 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <span>Joined {new Date(agent.date_joined || Date.now()).toLocaleDateString()}</span>
                      <button
                        onClick={() => {
                          setActiveTab("kyc");
                        }}
                        className="font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                        style={{ color: "var(--ink)" }}
                      >
                        Inspect KYC <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB 2: KARNATAKA KYC VERIFICATION INSPECTOR */}
        {activeTab === "kyc" && (
          <div className="space-y-6">
            {agentKycs.length === 0 ? (
              <div className="rounded-3xl p-12 text-center border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[32px]">verified_user</span>
                </div>
                <h3 className="text-[18px] font-extrabold mb-1" style={{ color: "var(--ink)" }}>No KYC Submissions Yet</h3>
                <p className="text-[13px] max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                  When Field Agents log in and upload their Karnataka Aadhaar, PAN, Selfie, and Payout UPI ID, they will appear here for verification.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agentKycs.map((kyc) => (
                  <div
                    key={kyc.id}
                    className="rounded-3xl p-6 border shadow-sm flex flex-col justify-between space-y-4"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-950 text-white font-extrabold flex items-center justify-center border-2 border-slate-800 shrink-0 shadow-sm">
                            {kyc.selfie_url ? (
                              <img src={kyc.selfie_url} alt={kyc.agent_username} className="w-full h-full object-cover" />
                            ) : (
                              <span>{kyc.agent_username ? kyc.agent_username.charAt(0).toUpperCase() : "A"}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-[15px]" style={{ color: "var(--ink)" }}>
                              @{kyc.agent_username}
                            </h3>
                            <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                              Phone: {kyc.agent_phone || "N/A"}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase ${
                          kyc.status === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : kyc.status === 'submitted'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse'
                            : 'bg-red-500/10 text-red-500 border border-red-500/30'
                        }`}>
                          {kyc.status}
                        </span>
                      </div>

                      {/* Document Details Grid */}
                      <div className="grid grid-cols-2 gap-3 text-[12px] p-3 rounded-2xl" style={{ backgroundColor: "var(--surface-alt)" }}>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>Aadhaar No:</span>
                          <span className="font-extrabold" style={{ color: "var(--ink)" }}>{kyc.aadhaar_number || "Not uploaded"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>PAN Card:</span>
                          <span className="font-extrabold uppercase" style={{ color: "var(--ink)" }}>{kyc.pan_number || "Not uploaded"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>Karnataka RERA / DL:</span>
                          <span className="font-extrabold" style={{ color: "var(--ink)" }}>{kyc.karnataka_rera_no || kyc.driving_license_no || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>Payout UPI ID:</span>
                          <span className="font-extrabold text-emerald-500">{kyc.upi_id || "N/A"}</span>
                        </div>
                      </div>

                      {/* Bank Account Snippet */}
                      {kyc.bank_account_number && (
                        <div className="p-3 rounded-2xl border text-[11px] space-y-1" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                          <p className="font-bold text-amber-500">Bank Account Details:</p>
                          <p style={{ color: "var(--ink)" }}>Name: <b>{kyc.account_holder_name}</b></p>
                          <p style={{ color: "var(--ink)" }}>A/C: <b>{kyc.bank_account_number}</b> | IFSC: <b>{kyc.ifsc_code}</b> ({kyc.bank_name})</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => setSelectedKyc(kyc)}
                        className="flex-1 py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Inspect Docs
                      </button>
                      {kyc.status !== 'verified' && (
                        <button
                          onClick={() => handleReviewKyc(kyc.id, 'approve')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INSPECT DOCS & REVIEW MODAL */}
        {selectedKyc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setSelectedKyc(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border flex items-center justify-center hover:opacity-80 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              <h2 className="text-[20px] font-extrabold mb-4" style={{ color: "var(--ink)" }}>
                Inspect Agent Documents: @{selectedKyc.agent_username}
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { title: "Aadhaar Front", url: selectedKyc.aadhaar_front_url },
                  { title: "Aadhaar Back", url: selectedKyc.aadhaar_back_url },
                  { title: "PAN Photo", url: selectedKyc.pan_card_url },
                  { title: "Live Selfie", url: selectedKyc.selfie_url },
                ].map((doc, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>{doc.title}</p>
                    <div className="h-40 rounded-2xl border overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                      {doc.url ? (
                        <img src={doc.url} alt={doc.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>Not uploaded</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedKyc.status !== 'verified' && (
                <div className="space-y-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                      Rejection Reason (If rejecting):
                    </label>
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Aadhaar image is blurry / PAN number mismatch."
                      className="w-full h-10 px-3.5 rounded-xl border outline-none text-[13px] font-bold shadow-sm"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleReviewKyc(selectedKyc.id, 'reject')}
                      className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 font-extrabold text-[12px] uppercase cursor-pointer hover:bg-red-500/20"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => handleReviewKyc(selectedKyc.id, 'approve')}
                      className="px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase shadow-md cursor-pointer"
                    >
                      Approve &amp; Verify Partner
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROVISION FIELD AGENT MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[26px]">badge</span>
                </div>
                <h2 className="text-[20px] font-extrabold" style={{ color: "var(--ink)" }}>
                  Provision New Field Agent
                </h2>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Create agent login credentials. Agent will update password &amp; upload Karnataka KYC on first login.
                </p>
              </div>

              <form onSubmit={handleCreateAgent} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase block mb-1" style={{ color: "var(--text-muted)" }}>Username *</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. agent_rahul"
                      className="w-full h-10 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase block mb-1" style={{ color: "var(--text-muted)" }}>Initial Password *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set temporary password"
                      className="w-full h-10 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase block mb-1" style={{ color: "var(--text-muted)" }}>First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Rahul"
                      className="w-full h-10 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase block mb-1" style={{ color: "var(--text-muted)" }}>Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full h-10 px-3 rounded-xl border text-[13px] font-bold outline-none shadow-sm"
                      style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[20px] mt-0.5" style={{ color: "var(--accent)" }}>info</span>
                  <p className="text-[11.5px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>
                    Upon first login with these credentials, the agent will be prompted to set a new password and upload Aadhaar, PAN Card, Selfie, and Payout UPI details.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border font-extrabold text-[12px] cursor-pointer"
                    style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[12px] uppercase tracking-widest shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    Provision Field Agent
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
