import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--bg-primary)",
        surface: "var(--bg-surface)",
        "surface-subtle": "var(--bg-surface-subtle)",
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        navy: {
          DEFAULT: "#183A54",
          dark: "#10283B",
          light: "#224F70",
        },
        petrol: {
          DEFAULT: "#14877B",
          dark: "#0E685F",
          light: "#E7F5F3",
        },
        semantic: {
          success: "#16865D",
          "success-bg": "#EAF5F0",
          error: "#D65A53",
          "error-bg": "#FDF0EF",
          warning: "#D79B36",
          "warning-bg": "#FDF6EA",
        },
        border: "var(--border-color)",
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(23, 38, 56, 0.04)",
        card: "0 1px 3px 0 rgba(23, 38, 56, 0.05), 0 1px 2px -1px rgba(23, 38, 56, 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
