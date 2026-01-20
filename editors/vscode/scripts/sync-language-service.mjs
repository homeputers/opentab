import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '..', '..', '..', 'tools', 'language-service', 'src');
const targetDir = path.resolve(__dirname, '..', 'src', 'language-service');

await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });

console.log(`Synced language-service from ${sourceDir} to ${targetDir}.`);
