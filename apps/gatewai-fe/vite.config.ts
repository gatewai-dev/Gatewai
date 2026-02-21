import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { nodeDiscovery } from "./vite-plugins/node-discovery";

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
		nodeDiscovery(),
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
		conditions: ["development", "browser"],
		alias: {
			"@": path.resolve(__dirname, "./src"),
			react: path.resolve(__dirname, "./node_modules/react"),
			"react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
			"react-router": path.resolve(__dirname, "./node_modules/react-router"),
			"@xyflow/react": path.resolve(__dirname, "./node_modules/@xyflow/react"),
			"lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
			"framer-motion": path.resolve(__dirname, "./node_modules/framer-motion"),
			"react-hotkeys-hook": path.resolve(
				__dirname,
				"./node_modules/react-hotkeys-hook",
			),
			"react/jsx-runtime": path.resolve(
				__dirname,
				"./node_modules/react/jsx-runtime.js",
			),
			"react/jsx-dev-runtime": path.resolve(
				__dirname,
				"./node_modules/react/jsx-dev-runtime.js",
			),
		},
	},
});
