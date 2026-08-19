import React, { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AUTHORITY_MODULES = [
  { id: "can_manage_properties", label: "🏡 Property Management & Approval", desc: "Allows approving, editing, & rejecting property listings." },
  { id: "can_review_moderation", label: "🛡️ Moderation & Fraud Review", desc: "Allows reviewing reported properties, fraud flags, & user reports." },
  { id: "can_view_earnings", label: "💰 Revenue & Earnings Access", desc: "Allows viewing financial analytics, transactions, & payouts." },
  { id: "can_view_analytics", label: "📊 Analytics & Growth Reports", desc: "Allows viewing platform traffic, city demand, & conversion metrics." },
  { id: "can_manage_users", label: "👥 User & Agent Management", desc: "Allows managing buyers, owners, agents, & city assignments." },
  { id: "can_edit_settings", label: "⚙️ Global Platform Settings", desc: "Allows editing pricing, fees, & themes (protected by Master Vault)." }
];

export const SubAdminManagement = () => {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState(null);

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState({
    can_manage_properties: true,
    can_review_moderation: true,
    can_view_earnings: false,
    can_view_analytics: true,
    can_manage_users: false,
    can_edit_settings: false
  });

  useEffect(() => {
    fetchSubAdmins();
  }, []);

  const fetchSubAdmins = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/sub-admins/`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setSubAdmins(data);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load Sub-Admin team.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSubAdmin(null);
    setUsername("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setPermissions({
      can_manage_properties: true,
      can_review_moderation: true,
      can_view_earnings: false,
      can_view_analytics: true,
      can_manage_users: false,
      can_edit_settings: false
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (subAdmin) => {
    setEditingSubAdmin(subAdmin);
    setPermissions({
      can_manage_properties: false,
      can_review_moderation: false,
      can_view_earnings: false,
      can_view_analytics: false,
      can_manage_users: false,
      can_edit_settings: false,
      ...(subAdmin.sub_admin_permissions || {})
    });
    setModalOpen(true);
  };

  const togglePermission = (id) => {
    setPermissions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSaveSubAdmin = async (e) => {
    e.preventDefault();
    if (!editingSubAdmin) {
      if (!username || !password) {
        toast.error("Username and initial password are required.");
        return;
      }
    }

    try {
      if (editingSubAdmin) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/sub-admins/${editingSubAdmin.id}/permissions/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sub_admin_permissions: permissions })
        });
        if (res.ok) {
          toast.success("Sub-Admin authorities updated!");
          setModalOpen(false);
          fetchSubAdmins();
        } else {
          const err = await res.json();
          toast.error(err.detail || "Failed to update permissions.");
        }
      } else {
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
            role: "sub_admin",
            sub_admin_permissions: permissions
          })
        });
        if (res.ok) {
          toast.success("Sub-Admin account created successfully!");
          setModalOpen(false);
          fetchSubAdmins();
        } else {
          const err = await res.json();
          toast.error(err.detail || "Failed to create Sub-Admin.");
        }
      }
    } catch (e) {
      toast.error("Network error saving Sub-Admin.");
    }
  };

  const handleDeleteSubAdmin = async (id, name) => {
    if (!window.confirm(`Are you sure you want to revoke sub-admin access for ${name}?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/accounts/sub-admins/${id}/delete/`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        toast.success("Sub-Admin account revoked.");
        fetchSubAdmins();
      } else {
        toast.error("Failed to revoke account.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  return (
    <AdminLayout activeTab="team">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              Sub-Admin Team &amp; Authority Control
            </h1>
            <p className="text-[14px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
              Create sub-admin accounts and customize granular permissions for each platform module.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="h-11 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[13px] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            + Create Sub-Admin
          </button>
        </div>

        {/* Sub-Admin Cards List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-amber-200 border-t-amber-500 animate-spin"></div>
          </div>
        ) : subAdmins.length === 0 ? (
          <div className="rounded-3xl p-12 text-center border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)" }}>
              <span className="material-symbols-outlined text-[32px]">admin_panel_settings</span>
            </div>
            <h3 className="text-[18px] font-extrabold mb-1" style={{ color: "var(--ink)" }}>No Sub-Admins Created Yet</h3>
            <p className="text-[13px] max-w-md mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
              You haven't created any sub-admin accounts yet. Create team accounts and specify what modules they are authorized to manage.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-6 py-2.5 bg-slate-950 text-white font-extrabold text-[13px] rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create First Sub-Admin
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subAdmins.map((subAdmin) => {
              const perms = subAdmin.sub_admin_permissions || {};
              const grantedCount = Object.values(perms).filter(Boolean).length;

              return (
                <div
                  key={subAdmin.id}
                  className="rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white font-extrabold text-[18px] flex items-center justify-center shadow-md">
                          {subAdmin.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-[16px]" style={{ color: "var(--ink)" }}>
                            {subAdmin.first_name ? `${subAdmin.first_name} ${subAdmin.last_name || ""}` : subAdmin.username}
                          </h3>
                          <span className="text-[12px] font-medium block" style={{ color: "var(--text-muted)" }}>
                            @{subAdmin.username} {subAdmin.phone ? `· ${subAdmin.phone}` : ""}
                          </span>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-extrabold text-[11px] border border-emerald-500/20">
                        {grantedCount} Authorities Active
                      </span>
                    </div>

                    <div className="space-y-2 mb-6">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                        Granted Authorities:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {AUTHORITY_MODULES.map((mod) => {
                          const isGranted = perms[mod.id];
                          return (
                            <span
                              key={mod.id}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                              style={{
                                backgroundColor: isGranted ? "var(--surface-alt)" : "var(--bg)",
                                color: isGranted ? "var(--ink)" : "var(--text-muted)",
                                opacity: isGranted ? 1 : 0.5,
                                textDecoration: isGranted ? "none" : "line-through"
                              }}
                            >
                              {mod.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                      Added {new Date(subAdmin.date_joined).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(subAdmin)}
                        className="px-3 py-1.5 rounded-lg border font-extrabold text-[12px] transition-colors flex items-center gap-1 cursor-pointer"
                        style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_note</span>
                        Edit Authorities
                      </button>
                      <button
                        onClick={() => handleDeleteSubAdmin(subAdmin.id, subAdmin.username)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                        title="Revoke Account"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CREATE / EDIT MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--accent)", borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined text-[26px]">manage_accounts</span>
                </div>
                <h2 className="text-[20px] font-extrabold" style={{ color: "var(--ink)" }}>
                  {editingSubAdmin ? `Edit Authorities for @${editingSubAdmin.username}` : "Create New Sub-Admin Account"}
                </h2>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Select explicitly what modules this sub-admin is authorized to perform.
                </p>
              </div>

              <form onSubmit={handleSaveSubAdmin} className="space-y-5">
                {!editingSubAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase block mb-1" style={{ color: "var(--text-muted)" }}>Username *</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. subadmin_john"
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
                        placeholder="Set initial temporary password"
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
                        placeholder="e.g. John"
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
                )}

                {/* Granular Module Checkboxes */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider block mb-3 border-b pb-2" style={{ color: "var(--ink)", borderColor: "var(--border)" }}>
                    Authorized Modules &amp; Powers (Select what they can do):
                  </label>

                  <div className="space-y-3">
                    {AUTHORITY_MODULES.map((mod) => {
                      const isChecked = !!permissions[mod.id];
                      return (
                        <div
                          key={mod.id}
                          onClick={() => togglePermission(mod.id)}
                          className="p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 shadow-sm"
                          style={{
                            backgroundColor: isChecked ? "var(--surface-alt)" : "var(--surface)",
                            borderColor: isChecked ? "var(--accent)" : "var(--border)"
                          }}
                        >
                          <div className="w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition-colors" style={{ backgroundColor: isChecked ? "var(--accent)" : "transparent", borderColor: isChecked ? "var(--accent)" : "var(--border)", color: "#fff" }}>
                            {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>

                          <div className="flex-1">
                            <h4 className="font-extrabold text-[13px]" style={{ color: "var(--ink)" }}>{mod.label}</h4>
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{mod.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
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
                    className="px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-[12px] shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    {editingSubAdmin ? "Save Granted Authorities" : "Create Sub-Admin Account"}
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
