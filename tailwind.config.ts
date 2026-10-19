import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "var(--color-navy-950)",
          900: "var(--color-navy-900)",
          800: "var(--color-navy-800)",
          700: "var(--color-navy-700)",
          600: "var(--color-navy-600)",
        },
        brick: {
          700: "var(--color-red-700)",
          600: "var(--color-red-600)",
          500: "var(--color-red-500)",
          100: "var(--color-red-100)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          muted: "var(--color-surface-muted)",
          border: "var(--color-border)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
          soft: "var(--color-ink-soft)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11, 31, 58, 0.06), 0 1px 0 rgba(11, 31, 58, 0.04)",
        raised: "0 8px 24px rgba(11, 31, 58, 0.10)",
      },
      maxWidth: {
        content: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
