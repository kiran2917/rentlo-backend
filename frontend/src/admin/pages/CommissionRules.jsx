import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminLayout } from "../components/AdminLayout";

export const CommissionRules = () => {
  const [rules, setRules] = useState([]);
  const [cities, setCities] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    agent: "",
    city: "",
    rule_type: "flat_per_listing",
    amount_or_percent: "",
    is_active: true,
  });

  const fetchData = async () => {
    try {
      const [rulesRes, citiesRes, agentsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/earnings/commission-rules/`, {
          credentials: "include",
        }),
        fetch(`${import.meta.env.VITE_API_URL}/properties/cities/`),
        fetch(`${import.meta.env.VITE_API_URL}/auth/users/`, {
          credentials: "include",
        }),
      ]);
      setRules(await rulesRes.json());
      setCities(await citiesRes.json());
      setAgents((await agentsRes.json()).filter((a) => a.role === "agent"));
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, agent: formData.agent || null };
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/commission-rules/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        toast.success("Rule created");
        setFormData({
          agent: "",
          city: "",
          rule_type: "flat_per_listing",
          amount_or_percent: "",
          is_active: true,
        });
        fetchData();
      } else {
        toast.error("Failed to create rule");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const toggleActive = async (rule) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/earnings/commission-rules/${rule.id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active: !rule.is_active }),
        },
      );
      if (res.ok) {
        toast.success("Rule updated");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.city_details?.name?.toLowerCase().includes(q) ||
      r.agent_details?.username?.toLowerCase().includes(q) ||
      r.rule_type?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const paginatedRules = filteredRules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AdminLayout activeTab="rules">
      <ToastContainer position="top-right" />

      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px] group-hover:rotate-180 transition-transform duration-700">
                settings_suggest
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--ink)" }}>
                Commission Rules
              </h1>
              <p className="text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>
                Configure payout and platform fee parameters by city or agent.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group w-64 md:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-orange-500 transition-colors">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 w-full border rounded-xl text-[13px] font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                placeholder="Search rules..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <button
              onClick={fetchData}
              className="flex items-center justify-center w-12 h-12 border rounded-xl shadow-sm transition-all hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
              title="Refresh List"
            >
              <span className="material-symbols-outlined text-[20px]">
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Create Rule Form */}
        <div className="p-8 rounded-3xl shadow-sm border mb-10" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <h2 className="text-[16px] font-extrabold mb-6 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--accent)" }}>
              add_circle
            </span>
            Create New Rule
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">
                  location_city
                </span>{" "}
                City
              </label>
              <select
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full border text-[13px] font-bold rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                required
              >
                <option value="">Select City</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">
                  person
                </span>{" "}
                Agent (Optional)
              </label>
              <select
                value={formData.agent}
                onChange={(e) =>
                  setFormData({ ...formData, agent: e.target.value })
                }
                className="w-full border text-[13px] font-bold rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <option value="">Default (All Agents)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">
                  rule
                </span>{" "}
                Rule Type
              </label>
              <select
                value={formData.rule_type}
                onChange={(e) =>
                  setFormData({ ...formData, rule_type: e.target.value })
                }
                className="w-full border text-[13px] font-bold rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                required
              >
                <option value="flat_per_listing">Flat per Listing</option>
                <option value="percent_per_unlock">Percent per Unlock</option>
                <option value="flat_per_unlock">Flat per Unlock</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">
                  payments
                </span>{" "}
                Amount / Percent
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount_or_percent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount_or_percent: e.target.value,
                  })
                }
                className="w-full border text-[14px] font-extrabold rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-all placeholder:font-medium placeholder:text-[13px]"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                required
                placeholder="e.g. 500 or 15"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[13px] font-extrabold uppercase tracking-widest rounded-xl px-4 py-3 h-[46px] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
              Create Rule
            </button>
          </form>
        </div>

        {/* Rules List Container */}
        {loading ? (
          <div className="rounded-3xl border shadow-sm p-16 text-center mb-8" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
              <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Loading rules...
              </p>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="rounded-3xl border shadow-sm p-16 text-center mb-8" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-5xl text-slate-400">
                rule
              </span>
              <p className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
                No Rules Found
              </p>
              <p className="text-[12px] font-medium max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                Try adjusting your search query or create a new rule.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border shadow-sm overflow-hidden mb-8 relative" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      City
                    </th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Agent
                    </th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Type
                    </th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Value
                    </th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Status
                    </th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-right" style={{ color: "var(--text-muted)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {paginatedRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:opacity-90 transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-6 py-5 text-[14px] font-extrabold" style={{ color: "var(--ink)" }}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">
                            location_city
                          </span>
                          {rule.city_details?.name}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                        {rule.agent_details ? (
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-400 text-[16px]">
                              person
                            </span>
                            {rule.agent_details.username}
                          </span>
                        ) : (
                          <span className="italic font-medium" style={{ color: "var(--text-muted)" }}>
                            Default (All)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-[13px] font-medium capitalize" style={{ color: "var(--text-muted)" }}>
                        {rule.rule_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-5 text-[15px] font-extrabold text-orange-600">
                        {rule.amount_or_percent}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${rule.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                        >
                          {rule.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => toggleActive(rule)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-widest hover:text-orange-600 transition-all shadow-sm cursor-pointer"
                          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            toggle_on
                          </span>
                          Toggle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredRules.length > 0 && (
          <div className="flex justify-between items-center mb-8 p-4 rounded-2xl border shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredRules.length)} of{" "}
              {filteredRules.length} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[12px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-[16px]">
                  chevron_left
                </span>{" "}
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[12px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
              >
                Next{" "}
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
