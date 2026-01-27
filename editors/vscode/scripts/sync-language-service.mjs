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
const midiConverterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'converters-midi',
  'src',
);
const svgConverterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'converters-svg',
  'src',
);
const midiConverterTargetDir = path.resolve(
  toolsTargetDir,
  'converters-midi',
);
const svgConverterTargetDir = path.resolve(
  toolsTargetDir,
  'converters-svg',
);
const musicXmlConverterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'converters-musicxml',
  'src',
);
const musicXmlConverterTargetDir = path.resolve(
  toolsTargetDir,
  'converters-musicxml',
);
const guitarProConverterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'converters-guitarpro',
  'src',
);
const guitarProConverterTargetDir = path.resolve(
  toolsTargetDir,
  'converters-guitarpro',
);
const asciiImporterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'importers',
  'ascii',
  'src',
);
const asciiImporterTargetDir = path.resolve(
  toolsTargetDir,
  'importers-ascii',
);
const formatterSourceDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'formatter',
  'src',
);
const formatterTargetDir = path.resolve(
  toolsTargetDir,
  'formatter',
);

await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });

await rm(toolsTargetDir, { recursive: true, force: true });
await cp(parserSourceDir, parserTargetDir, { recursive: true });
await cp(converterSourceDir, converterTargetDir, { recursive: true });
await cp(midiConverterSourceDir, midiConverterTargetDir, { recursive: true });
await cp(svgConverterSourceDir, svgConverterTargetDir, { recursive: true });
await cp(musicXmlConverterSourceDir, musicXmlConverterTargetDir, { recursive: true });
await cp(guitarProConverterSourceDir, guitarProConverterTargetDir, { recursive: true });
await cp(asciiImporterSourceDir, asciiImporterTargetDir, { recursive: true });
await cp(formatterSourceDir, formatterTargetDir, { recursive: true });

console.log(`Synced language-service from ${sourceDir} to ${targetDir}.`);
console.log(`Synced parser from ${parserSourceDir} to ${parserTargetDir}.`);
console.log(`Synced converters-ascii from ${converterSourceDir} to ${converterTargetDir}.`);
console.log(
  `Synced converters-midi from ${midiConverterSourceDir} to ${midiConverterTargetDir}.`,
);
console.log(
  `Synced converters-svg from ${svgConverterSourceDir} to ${svgConverterTargetDir}.`,
);
console.log(
  `Synced converters-musicxml from ${musicXmlConverterSourceDir} to ${musicXmlConverterTargetDir}.`,
);
console.log(
  `Synced converters-guitarpro from ${guitarProConverterSourceDir} to ${guitarProConverterTargetDir}.`,
);
console.log(
  `Synced importers-ascii from ${asciiImporterSourceDir} to ${asciiImporterTargetDir}.`,
);
console.log(
  `Synced formatter from ${formatterSourceDir} to ${formatterTargetDir}.`,
);
