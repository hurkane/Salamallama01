// postcss.config.cjs
const tailwindcss = require("tailwindcss");

module.exports = {
  plugins: [tailwindcss, require("autoprefixer")],
};
