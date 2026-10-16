/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      output: {
        // Long-lived libraries in their own files, so a profile or app change does not re-download them.
        manualChunks: { react: ["react", "react-dom"], ui: ["radix-ui", "cmdk", "sonner", "@tanstack/react-table"] },
      },
    },
  },
  test: { environment: "node" },
});
