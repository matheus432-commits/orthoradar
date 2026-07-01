import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F766E",
          light: "#14B8A6",
          dark: "#0B4F49",
        },
      },
    },
  },
  plugins: [],
};

export default config;
