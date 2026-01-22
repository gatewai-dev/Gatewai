import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const filePath = require.resolve('@gatewai/types/dist/index.mjs');
const NODE_CONFIG_RAW = fs.readFileSync(filePath, 'utf8');

export { NODE_CONFIG_RAW };