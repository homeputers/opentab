import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['vscode'],
});
