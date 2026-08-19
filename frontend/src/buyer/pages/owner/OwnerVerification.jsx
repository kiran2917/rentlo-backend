import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const OwnerVerification = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a document first.");
      return;
    }
    
    setUploading(true);
    try {
      // In a real implementation, you would first upload to your storage (S3/Cloudinary)
      // then patch the user profile. Using a placeholder for now.
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/media/upload/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const data = await uploadRes.json();

      const patchRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/buyer/profile/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownership_document_url: data.full_url }),
      });

      if (patchRes.ok) {
        toast.success("Document submitted successfully. Our team will review it.");
        setFile(null);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (err) {
      toast.error("Error submitting document.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <ToastContainer position="top-right" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Identity Verification</h2>
          <p className="text-sm text-text-muted mt-1">Submit your ID or ownership document to get verified.</p>
        </div>
      </div>

      <div className="max-w-2xl bg-surface border border-border rounded-xl p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div>
            <h3 className="text-[16px] font-bold mb-1">Why verify?</h3>
            <p className="text-[13px] text-text-muted leading-relaxed">
              Verified owners get a special badge on their listings, which significantly increases trust and engagement from potential buyers and tenants.
            </p>
            <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <p className="text-[12px] font-bold mb-2" style={{ color: "var(--ink)" }}>Accepted Documents (Upload any ONE):</p>
              <ul className="text-[12px] space-y-1.5 list-disc pl-4 marker:text-emerald-500" style={{ color: "var(--text-muted)" }}>
                <li>Aadhaar Card (Front &amp; Back)</li>
                <li>PAN Card</li>
                <li>Voter ID</li>
                <li>Driving License or Passport</li>
                <li>Recent Property Tax Receipt or Utility Bill</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-surface-alt/50 hover:bg-surface-alt transition-colors">
          <input
            type="file"
            id="doc-upload"
            className="hidden"
            accept="image/*,.pdf"
            onChange={handleFileChange}
          />
          <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center">
            <span className="material-symbols-outlined text-[40px] text-text-muted mb-3">cloud_upload</span>
            <span className="text-[14px] font-bold mb-1">Click to upload document</span>
            <span className="text-[12px] text-text-muted mb-4">Supported formats: JPG, PNG, PDF (Max 5MB)</span>
            
            {file && (
              <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-[13px] font-medium text-success">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {file.name}
              </div>
            )}
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white rounded-xl text-[13px] font-extrabold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md cursor-pointer"
          >
            {uploading && <span className="material-symbols-outlined animate-spin text-[16px]">refresh</span>}
            {uploading ? "Submitting..." : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
};
