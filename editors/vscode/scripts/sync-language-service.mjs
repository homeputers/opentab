import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'language-service',
  'src',
);
const targetDir = path.resolve(__dirname, '..', 'src', 'language-service');
const toolsTargetDir = path.resolve(__dirname, '..', 'src', 'opentab-tools');
const parserSourceDir = path.resolve(__dirname, '..', '..', '..', 'tools', 'parser', 'src');
const parserTargetDir = path.resolve(toolsTargetDir, 'parser');
const converterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'converters-ascii',
  'src',
);
const converterTargetDir = path.resolve(toolsTargetDir, 'converters-ascii');

await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });

await rm(toolsTargetDir, { recursive: true, force: true });
await cp(parserSourceDir, parserTargetDir, { recursive: true });
await cp(converterSourceDir, converterTargetDir, { recursive: true });

console.log(`Synced language-service from ${sourceDir} to ${targetDir}.`);
console.log(`Synced parser from ${parserSourceDir} to ${parserTargetDir}.`);
console.log(`Synced converters-ascii from ${converterSourceDir} to ${converterTargetDir}.`);
