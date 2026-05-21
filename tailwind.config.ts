import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kkumbi: {
          50: "#fff8f5",
          100: "#ffefe8",
          200: "#ffd9c9",
          300: "#ffb89a",
          400: "#ff8f66",
          500: "#f56b3d",
          600: "#e24f24",
          700: "#bc3d18",
          800: "#97341a",
          900: "#7b2e1a",
        },
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
