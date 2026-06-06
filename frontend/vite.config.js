import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local dev, API calls are proxied to the Nginx load balancer (port 8080),
// which then round-robins them across the FastAPI replicas. In production the
// frontend is served as static files by Nginx and calls /api on the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/whoami": { target: "http://localhost:8080", changeOrigin: true },
      "/health": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      // Split heavy vendor libs into their own chunks so the app code and the
      // charting library cache independently and the initial parse is smaller.
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          charts: ["recharts"],
        },
      },
    },
  },
});
