import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "en", label: "English", short: "EN" },
    { code: "kn", label: "ಕನ್ನಡ", short: "KN" },
    { code: "hi", label: "हिंदी", short: "HI" },
  ];

  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem("language", code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-sm hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--ink)",
        }}
      >
        <span className="material-symbols-outlined text-[16px] text-emerald-500">translate</span>
        <span>{currentLanguage.short}</span>
        <span className="material-symbols-outlined text-[14px]">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop overlay to close when clicking outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          
          <div
            className="absolute right-0 mt-2 w-32 rounded-2xl shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="py-1">
              {languages.map((lang) => {
                const isActive = lang.code === i18n.language;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className="w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer"
                    style={{
                      color: isActive ? "var(--accent)" : "var(--ink)",
                      backgroundColor: isActive ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                    }}
                  >
                    <span>{lang.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

