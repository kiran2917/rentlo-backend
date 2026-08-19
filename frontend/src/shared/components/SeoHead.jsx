import { useEffect } from "react";

export const SeoHead = ({
  title = "Rentlo — Zero-Brokerage Real Estate Platform",
  description = "Find verified flats, apartments, PG accommodations, and commercial properties directly from owners. Zero brokerage fees.",
  keywords = "Rentlo, zero brokerage rent, direct owner property, no broker flat, 2BHK rent, apartment for rent",
  canonicalUrl = "https://rentlo.in/",
  ogImage = "https://rentlo.in/og-cover.jpg",
  jsonLd = null,
}) => {
  useEffect(() => {
    // 1. Dynamic Title
    document.title = title;

    // 2. Dynamic Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    // 3. Dynamic Meta Keywords
    let metaKey = document.querySelector('meta[name="keywords"]');
    if (!metaKey) {
      metaKey = document.createElement("meta");
      metaKey.name = "keywords";
      document.head.appendChild(metaKey);
    }
    metaKey.content = keywords;

    // 4. Open Graph Tags
    const setOg = (property, content) => {
      let og = document.querySelector(`meta[property="${property}"]`);
      if (!og) {
        og = document.createElement("meta");
        og.setAttribute("property", property);
        document.head.appendChild(og);
      }
      og.content = content;
    };
    setOg("og:title", title);
    setOg("og:description", description);
    setOg("og:image", ogImage);

    // 5. Schema.org JSON-LD Script Injection
    let scriptTag = document.getElementById("dynamic-jsonld-schema");
    if (jsonLd) {
      if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.id = "dynamic-jsonld-schema";
        scriptTag.type = "application/ld+json";
        document.head.appendChild(scriptTag);
      }
      scriptTag.text = JSON.stringify(jsonLd);
    } else if (scriptTag) {
      scriptTag.remove();
    }
  }, [title, description, keywords, canonicalUrl, ogImage, jsonLd]);

  return null;
};
