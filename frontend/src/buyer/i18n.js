import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en.json";
import knTranslation from "./locales/kn.json";
import hiTranslation from "./locales/hi.json";

console.log("[i18n Debug] enTranslation keys length:", Object.keys(enTranslation).length);
console.log("[i18n Debug] knTranslation keys length:", Object.keys(knTranslation).length);
console.log("[i18n Debug] hiTranslation keys length:", Object.keys(hiTranslation).length);

const resources = {
  en: {
    translation: enTranslation,
  },
  kn: {
    translation: knTranslation,
  },
  hi: {
    translation: hiTranslation,
  },
};

const savedLang = localStorage.getItem("language") || "en";
console.log("[i18n Debug] Initializing with language:", savedLang);

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  }, (err, t) => {
    if (err) {
      console.error("[i18n Debug] Initialization failed:", err);
    } else {
      console.log("[i18n Debug] Initialization successful. Active language:", i18n.language);
      console.log("[i18n Debug] Test translation (owner.myProperties):", t("owner.myProperties"));
    }
  });

export default i18n;
