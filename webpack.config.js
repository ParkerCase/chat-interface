const path = require("path");

module.exports = {
  // ...other webpack configuration
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    extensions: [".js", ".jsx", ".json"],
  },
};
