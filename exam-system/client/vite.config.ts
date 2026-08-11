import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During development the API server runs on :4000; in production Nginx does this routing.
    proxy: { "/api": "http://localhost:4000" },
  },
});
