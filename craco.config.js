const path = require("path");

module.exports = {
  devServer: {
    // proxy: {
    //   "/api": {
    //     target: "http://147.182.247.128:4000",
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
};
