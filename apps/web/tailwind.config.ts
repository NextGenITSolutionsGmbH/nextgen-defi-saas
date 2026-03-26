import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand primary
        navy: "#0D2E6E",
        "brand-blue": "#1A4FBF",
        electric: {
          DEFAULT: "#2E6FFF",
          light: "#3B7BFF",
        },
        cyan: {
          DEFAULT: "#00C2D1",
          light: "#10D8E8",
        },
        teal: "#0A7B8A",

        // Accent
        amber: {
          DEFAULT: "#F5A623",
          light: "#F5B840",
        },
        orange: "#E8550A",
        emerald: {
          DEFAULT: "#00B56A",
          light: "#00D47A",
        },
        coral: {
          DEFAULT: "#EF4444",
          light: "#FF5555",
        },

        // Slate scale
        slate: {
          5: "#E8EEF5",
          10: "#C8D8E8",
          20: "#9AB0C8",
          40: "#5A7A9E",
          60: "#2E4A6E",
          80: "#1A2E4A",
          90: "#0F1E35",
          95: "#080F1A",
        },
      },
      fontFamily: {
        sans: [
          "Calibri",
          "Candara",
          "Segoe UI",
          "Optima",
          "Arial",
          "sans-serif",
        ],
      },
      spacing: {
        "4.5": "1.125rem", // 18px
        "13": "3.25rem",   // 52px
        "15": "3.75rem",   // 60px
        "18": "4.5rem",    // 72px
        "22": "5.5rem",    // 88px
        "26": "6.5rem",    // 104px
        "30": "7.5rem",    // 120px
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],  // 10px
        xs: ["0.75rem", { lineHeight: "1rem" }],            // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem" }],        // 14px
        base: ["1rem", { lineHeight: "1.5rem" }],           // 16px
        lg: ["1.125rem", { lineHeight: "1.75rem" }],        // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem" }],         // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem" }],          // 24px
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],     // 30px
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],       // 36px
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)",
        dropdown: "0 10px 30px rgba(0, 0, 0, 0.15)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-left": "slide-in-left 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
