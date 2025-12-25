import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    ".": "src/index.ts",
  },
  format: ["esm"],
  dts: false, // Disable DTS bundling in tsup
  clean: true,
  sourcemap: true,
  treeshake: true,

  loader: {
    '.wasm': 'file',
  },

  external: [
    '@prisma/client',
    '.prisma/client',
  ],

  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.wasm': 'file',
    };
  },

  // Don't try to bundle node_modules for Prisma
  noExternal: [],
});