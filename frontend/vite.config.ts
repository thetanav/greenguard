import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const proxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:8000";

const proxyOptions = {
  target: proxyTarget,
  changeOrigin: true,
  secure: false,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/health": proxyOptions,
      "/predict": proxyOptions,
      "/api/auth": proxyOptions,
      "/api/history": proxyOptions,
    },
  },
});
