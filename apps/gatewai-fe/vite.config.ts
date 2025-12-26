import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from "vite"
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import wasmPack from "vite-plugin-wasm-pack";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
  ],
  server: {
    watch: {
      ignored: ["**/**-worker.ts"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    plugins: () => [wasm(), topLevelAwait()],
    format: 'es' // default is iife
  }
})