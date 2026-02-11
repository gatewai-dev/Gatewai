import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
	build: {
		sourcemap: false,
		rollupOptions: {
			cache: false,
		},
	},
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				experimentalDecorators: true,
			},
		},
	},
	plugins: [
		react(),
		tailwindcss(),
		nodePolyfills({
			include: ["events", "buffer", "process"],
		}),
	],
	optimizeDeps: {
		include: ["mermaid"],
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:8081",
				changeOrigin: true,
			},
			"/env.js": {
				target: "http://localhost:8081",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"generic-pool": path.resolve(__dirname, "./src/lib/shims/generic-pool.ts"),
			"p-limit": path.resolve(__dirname, "./src/lib/shims/p-limit.ts"),
		},
	},
});
