import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f1b16",
        cream: "#faf7f2",
        sand: "#efe8dc",
        clay: { 500: "#a8542f", 600: "#8f4425", 700: "#733620" },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
