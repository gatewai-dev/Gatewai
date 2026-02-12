import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/metadata.ts",
        server: "src/server/index.ts",
        browser: "src/browser/index.tsx",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    // Add external dependencies to avoid bundling them
    external: [
        "react",
        "react-dom",
        "@gatewai/node-sdk",
        "@gatewai/core",
        "@gatewai/db",
        "@gatewai/ui-kit",
        "zod",
        "tsyringe",
        "node:assert",
    ],
});
