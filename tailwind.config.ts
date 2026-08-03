import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kraft: "#E8E0D0",
        "kraft-dark": "#DCD2BC",
        ink: "#1F2A37",
        "ink-soft": "#4B5768",
        ledger: "#B8ADA0",
        amber: "#C97A2B",
        "amber-dark": "#A6621F",
        stamp: "#3F6B4E",
        reject: "#A23E3E",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      backgroundImage: {
        "ledger-lines":
          "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(31,42,55,0.06) 28px)",
      },
    },
  },
  plugins: [],
};

export default config;
