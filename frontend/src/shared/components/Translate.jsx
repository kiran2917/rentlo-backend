import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Translate = ({ children }) => {
  const { i18n } = useTranslation();
  const [translated, setTranslated] = useState(children);
  const lang = i18n.language || "en";

  useEffect(() => {
    if (!children || typeof children !== "string" || children.trim() === "") {
      setTranslated(children);
      return;
    }

    if (lang === "en") {
      setTranslated(children);
      return;
    }

    const fetchTranslation = async () => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(children)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0][0] && data[0][0][0]) {
            setTranslated(data[0][0][0]);
          }
        }
      } catch (e) {
        console.error("Translation error:", e);
      }
    };

    fetchTranslation();
  }, [children, lang]);

  return <>{translated}</>;
};
