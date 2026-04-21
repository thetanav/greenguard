import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:8000",
      "/predict": "http://localhost:8000",
      "/api/auth": "http://localhost:8000",
      "/api/history": "http://localhost:8000",
    },
  },
});