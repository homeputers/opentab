import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formatterEntry = path.resolve(
  __dirname,
  'src',
  'opentab-tools',
  'formatter',
  'index.ts',
);

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node16',
  outDir: 'dist',
  external: ['vscode'],
  esbuildPlugins: [
    {
      name: 'opentab-aliases',
      setup(build) {
        build.onResolve({ filter: /^@opentab\/formatter$/ }, () => ({
          path: formatterEntry,
        }));
      },
    },
  ],
});
