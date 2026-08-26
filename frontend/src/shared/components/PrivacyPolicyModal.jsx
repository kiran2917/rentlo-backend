import React, { useState } from "react";

export const LEGAL_POLICIES = {
  privacy: {
    id: "privacy",
    label: "Privacy Policy",
    title: "Privacy Policy (v1.0) & DPDP Act 2023 Compliance",
    content: `1. DATA FIDUCIARY IDENTIFICATION
Rentlo Technologies operates as the designated Data Fiduciary under India's Digital Personal Data Protection (DPDP) Act 2023. We collect Personally Identifiable Information (PII) including verified mobile numbers, email addresses, and location data exclusively for enabling zero-brokerage property transactions.

2. LAWFUL BASIS & AFFIRMATIVE CONSENT
Personal data processing occurs strictly upon explicit, affirmative consent granted during SMS OTP login or registration. Consent records are logged with timestamp and versioning (v1.0).

3. DATA ENCRYPTION & SECURITY CONTROLS
Session credentials are stored in HttpOnly, SameSite=Lax JWT cookies. All database PII fields are protected by TLS 1.3 in transit and AES-256 encryption at rest.

4. USER DATA RIGHTS & GRIEVANCE OFFICER
You possess statutory rights under the DPDP Act 2023:
• Right to Access summary of processed personal data.
• Right to Correction of inaccurate or outdated property details.
• Right to Erasure of personal data via automated atomic data erasure.
For grievances, contact our Data Protection Officer at privacy@rentlo.in.`
  },
  terms: {
    id: "terms",
    label: "Terms of Service",
    title: "Terms of Service & Fair Usage Policy",
    content: `1. PLATFORM SCOPE & ELIGIBILITY
Rentlo provides a direct peer-to-peer real estate discovery portal connecting verified property owners with buyers and tenants across India. Users must be at least 18 years of age to register or initiate contact unlocks.

2. LISTING VERIFICATION & OWNER ACCURACY MANDATE
Property owners warrant that submitted residential, apartment/PG, or commercial listings reflect genuine, currently available properties with accurate pricing and coordinates. Submitting false pricing or misleading images violates platform integrity.

3. PROHIBITED ACTIVITIES & ACCOUNT SUSPENSION
The following activities are strictly prohibited:
• Automated scraping or harvesting of owner contact numbers.
• Unauthorized commercial reselling of lead data to third-party brokers.
• Harassment or fraudulent payment solicitation.
Violations trigger immediate account termination and IP-address blacklisting.

4. CONTACT UNLOCK & PASS LICENSE
Purchasing a contact unlock or buyer credit pass grants a non-transferable, limited license to contact the designated property owner for personal rental inquiry purposes.`
  },
  dpdp: {
    id: "dpdp",
    label: "DPDP Act Rights",
    title: "DPDP Act Data Retention & Erasure Boundaries",
    content: `1. DATA RETENTION SPECIFICATIONS
Rentlo retains user profile data and transaction logs only as long as necessary to fulfill real estate inquiry processing and financial reporting mandates under Indian tax laws.

2. ATOMIC DATA ERASURE PROTOCOL
You have the unconditional right to request total deletion of your personal data at any time. Invoking the Atomic Data Erasure endpoint executes a single database transaction that:
• Anonymizes user phone, email, and profile credentials.
• Clears saved search criteria and alert preferences.
• Scrubs outgoing chat messages and inquiry history.

3. ZERO UNAUTHORIZED THIRD-PARTY DATA SHARING
Rentlo never sells, rents, or shares user PII with third-party telemarketers or external broker agencies.`
  },
  zero_brokerage: {
    id: "zero_brokerage",
    label: "Zero Brokerage Guarantee",
    title: "Zero Brokerage Protection Guarantee & Fraud Prevention",
    content: `1. 100% DIRECT OWNER GUARANTEE
Rentlo operates on a zero-brokerage business model. Buyers and tenants connect directly with verified property owners without paying traditional 1-2 month broker fees.

2. REPORTING EXTORTION OR THIRD-PARTY BROKER CLAIMS
If any individual posing as an owner demands a broker commission, security deposit prior to physical property inspection, or key delivery fee for a listing on Rentlo:
• Click 'Report Fraud' on the property listing page immediately.
• Do NOT transfer money outside the official Rentlo payment gateway.

3. INVALID LEAD REFUND POLICY
If an unlocked phone number belongs to an offline or unverified third party, submit an unlock feedback report within 48 hours for an instant credit pass refund.`
  }
};

export const PrivacyPolicyModal = ({ isOpen, onClose, initialTab = "privacy" }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  const currentPolicy = LEGAL_POLICIES[activeTab] || LEGAL_POLICIES.privacy;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined text-[20px]">policy</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                Legal &amp; Compliance Hub
              </h3>
              <p className="text-xs font-medium text-slate-500">
                DPDP Act 2023 Statutory Disclosures
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto border-b border-slate-100 dark:border-slate-800 custom-scrollbar">
          {Object.values(LEGAL_POLICIES).map((policy) => (
            <button
              key={policy.id}
              type="button"
              onClick={() => setActiveTab(policy.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === policy.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {policy.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {currentPolicy.title}
          </h4>
          <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-normal bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 font-mono">
            {currentPolicy.content}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            I Understand &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
