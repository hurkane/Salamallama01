// tailwind.config.js
const tailwindcss = require("tailwindcss");

module.exports = {
  plugins: [tailwindcss, require("autoprefixer")],
  purge: ["./app/**/*.{js,ts,jsx,tsx}"], // Update this path as needed
  darkMode: "class", // Enable dark mode by class
  theme: {
    extend: {
      backgroundColor: {
        "primary-dark": "#000000", // Add custom background color
      },
    },
  },
  variants: {
    extend: {},
  },
};
