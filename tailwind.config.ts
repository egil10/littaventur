import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "SF Pro Text",
          "Segoe UI",
          "sans-serif",
        ],
        serif: ["Iowan Old Style", "Palatino Linotype", "Georgia", "ui-serif", "serif"],
      },
      colors: {
        ink: { DEFAULT: "#0b1220", soft: "#1c2533", muted: "#647084" },
        canvas: { DEFAULT: "#f4f7fc", warm: "#e9eef9" },
        accent: { DEFAULT: "#0a6cff", soft: "#3b86ff", deep: "#0a4fd0" },
      },
      backdropBlur: { xs: "2px" },
      animation: {
        "fade-in": "fadeIn 200ms ease-out both",
        "fade-up": "fadeUp 240ms cubic-bezier(.2,.7,.2,1) both",
        pop: "pop 240ms cubic-bezier(.2,.9,.3,1.2) both",
        "scale-in": "scaleIn 180ms cubic-bezier(.2,.8,.2,1) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
