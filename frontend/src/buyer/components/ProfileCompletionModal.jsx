import React, { useState } from "react";
import { toast } from "react-toastify";

export const ProfileCompletionModal = ({ isOpen, onClose, onSuccess, user, checkAuth }) => {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.phone) {
      toast.error("First Name and Phone are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await checkAuth(); // Refresh user context
        onSuccess();
      } else {
        const data = await res.json();
        if (data.phone) {
            toast.error(`Phone: ${data.phone[0]}`);
        } else {
            toast.error(data.detail || "Failed to update profile.");
        }
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-xl font-bold mb-2">Complete Your Profile</h3>
        <p className="text-sm text-text-muted mb-6">
          Please provide your name and phone number to continue. This helps owners know who they are communicating with.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-ink mb-1.5">First Name</label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-border bg-surface-alt focus:border-accent outline-none"
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-ink mb-1.5">Last Name (Optional)</label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-border bg-surface-alt focus:border-accent outline-none"
              placeholder="Enter last name"
            />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-ink mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-border bg-surface-alt focus:border-accent outline-none"
              placeholder="Enter phone number"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl font-bold border border-border text-text-muted hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 rounded-xl font-bold bg-accent text-card disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
