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
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        reading: ["var(--font-reading)", "Georgia", "Cambria", "serif"],
      },
      colors: {
        /* Tokens principais do Design System */
        background: "var(--bg-canvas)",
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        "surface-subtle": "var(--bg-surface-subtle)",
        "brand-tint": "var(--bg-brand-tint)",
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        subtle: "var(--text-muted)",
        border: "var(--border-color)",
        "border-strong": "var(--border-strong)",

        /* Identidade Roxa Editorial */
        brand: {
          DEFAULT: "var(--brand-primary)",
          deep: "var(--brand-deep)",
          plum: "var(--brand-plum)",
          dark: "var(--brand-primary-dark)",
          light: "var(--brand-primary-light)",
          accent: "var(--brand-accent-text)",
          tint: "var(--bg-brand-tint)",
        },

        /* Aliases retrocompatíveis (evitam regressão em telas dos Módulos 2–5) */
        navy: {
          DEFAULT: "var(--brand-primary)",
          dark: "var(--brand-primary-dark)",
          light: "var(--brand-primary-light)",
        },
        petrol: {
          DEFAULT: "var(--brand-primary)",
          dark: "var(--brand-primary-dark)",
          light: "var(--bg-brand-tint)",
        },

        /* Estados semânticos adaptativos Light/Dark */
        semantic: {
          success: "var(--status-success)",
          "success-bg": "var(--status-success-bg)",
          error: "var(--status-error)",
          "error-bg": "var(--status-error-bg)",
          warning: "var(--status-warning)",
          "warning-bg": "var(--status-warning-bg)",
        },
        disabled: {
          bg: "var(--state-disabled-bg)",
          text: "var(--state-disabled-text)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(21, 23, 28, 0.04)",
        card: "0 1px 3px 0 rgba(21, 23, 28, 0.05), 0 1px 2px -1px rgba(21, 23, 28, 0.03)",
        elevated: "0 8px 24px -6px rgba(21, 23, 28, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
