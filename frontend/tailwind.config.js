/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "bg":           "var(--bg)",
        "ink":          "var(--ink)",
        "surface":      "var(--surface)",
        "surface-alt":  "var(--surface-alt)",
        "accent":       "var(--accent)",
        "accent-soft":  "var(--accent-soft)",
        "text-muted":   "var(--text-muted)",
        "border":       "var(--border)",
        "success":      "var(--success)",
        "danger":       "var(--danger)",
        // mapping legacy ones if they are used
        "primary":                  "var(--accent)",
        "on-primary":               "var(--surface)",
        "background":               "var(--bg)",
        "on-background":            "var(--ink)",
        "surface-container-lowest": "var(--surface)",
        "surface-container":        "var(--surface-alt)",
        "on-surface":               "var(--ink)",
        "on-surface-variant":       "var(--text-muted)",
        "outline":                  "var(--border)",
        "outline-variant":          "var(--border)",
        "error":                    "var(--danger)",
        "on-error":                 "var(--surface)",
        "secondary":                "var(--accent-soft)",
        "on-secondary":             "var(--ink)",
        "secondary-container":      "rgba(199,125,59,0.15)",
        "on-secondary-container":   "var(--accent)",
      },
      fontFamily: {
        "display": ["'Fraunces Variable'", "Georgia", "serif"],
        "sans":    ["'Inter'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "card":    "1.25rem",
        "lg":      "0.5rem",
        "xl":      "0.75rem",
        "2xl":     "1rem",
        "3xl":     "1.5rem",
        "full":    "9999px",
      },
      boxShadow: {
        "card":        "0 12px 30px -10px var(--shadow-neutral-card), 0 0 1px var(--border)",
        "card-hover":  "0 30px 60px -15px var(--shadow-accent-glow), 0 0 1px var(--accent)",
        "glow-accent": "0 0 30px var(--shadow-accent-glow)",
        "glow-soft":   "0 0 40px -8px var(--shadow-accent-soft)",
      },
      keyframes: {
        "fade-rise": {
          "0%":   { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 12px -2px rgba(199,125,59,0.3)" },
          "50%":      { boxShadow: "0 0 28px -2px rgba(199,125,59,0.6)" },
        },
      },
      animation: {
        "fade-rise":  "fade-rise 0.55s ease-out both",
        "shimmer":    "shimmer 1.6s linear infinite",
        "pulse-glow": "pulse-glow 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
