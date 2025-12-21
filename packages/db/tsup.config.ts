// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    ".": "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true, // Clean dist folder before build
  sourcemap: true, // Helpful for debugging
  treeshake: true, // Remove unused code
  external: ['@prisma/client/runtime/library'],
});
