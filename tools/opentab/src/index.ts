#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { toAsciiTab } from "@opentab/converters-ascii";
import { fromGpx } from "@opentab/converters-guitarpro";
import { toMidi } from "@opentab/converters-midi";
import { toMusicXml } from "@opentab/converters-musicxml";
import { formatOtab } from "@opentab/formatter";
import { parseOpenTab } from "@opentab/parser";

const program = new Command();

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const readSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const writeStdout = (value: string): void => {
  process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
};

const writeErrorAndExit = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

program
  .name("opentab")
  .description("OpenTab command line tools")
  .version("0.0.1");

program
  .command("parse")
  .description("Parse an OpenTab file and print the AST JSON")
  .argument("<file>", "OpenTab file")
  .option("--json", "Output JSON (default)")
  .action(async (filePath: string) => {
    try {
      const source = await readSource(filePath);
      const document = parseOpenTab(source);
      writeStdout(JSON.stringify(document, null, 2));
    } catch (error) {
      writeErrorAndExit(`Parse failed: ${formatError(error)}`);
    }
  });

program
  .command("fmt")
  .description("Format an OpenTab file")
  .argument("<file>", "OpenTab file")
  .option("--write", "Overwrite the file with formatted output")
  .action(async (filePath: string, options: { write?: boolean }) => {
    try {
      const source = await readSource(filePath);
      const formatted = formatOtab(source);
      if (options.write) {
        await fs.writeFile(filePath, formatted, "utf8");
      } else {
        writeStdout(formatted);
      }
    } catch (error) {
      writeErrorAndExit(`Format failed: ${formatError(error)}`);
    }
  });

const toCommand = program.command("to").description("Convert OpenTab files");
const fromCommand = program.command("from").description("Import files into OpenTab");
const importCommand = program.command("import").description("Import files into OpenTab");

toCommand
  .command("ascii")
  .description("Render ASCII tablature")
  .argument("<file>", "OpenTab file")
  .action(async (filePath: string) => {
    try {
      const source = await readSource(filePath);
      const document = parseOpenTab(source);
      writeStdout(toAsciiTab(document));
    } catch (error) {
      writeErrorAndExit(`ASCII conversion failed: ${formatError(error)}`);
    }
  });

program
  .command("print")
  .description("Print ASCII tablature from an OpenTab file")
  .argument("<file>", "OpenTab file")
  .action(async (filePath: string) => {
    try {
      const source = await readSource(filePath);
      const document = parseOpenTab(source);
      writeStdout(toAsciiTab(document));
    } catch (error) {
      writeErrorAndExit(`Print failed: ${formatError(error)}`);
    }
  });

toCommand
  .command("midi")
  .description("Render MIDI from an OpenTab file")
  .argument("<file>", "OpenTab file")
  .requiredOption("-o, --output <file>", "Output MIDI file path")
  .action(async (filePath: string, options: { output: string }) => {
    try {
      const source = await readSource(filePath);
      const document = parseOpenTab(source);
      const midiData = toMidi(document);
      const outputPath = path.resolve(options.output);
      await fs.writeFile(outputPath, Buffer.from(midiData));
    } catch (error) {
      writeErrorAndExit(`MIDI conversion failed: ${formatError(error)}`);
    }
  });

toCommand
  .command("musicxml")
  .description("Render MusicXML from an OpenTab file")
  .argument("<file>", "OpenTab file")
  .option("-o, --output <file>", "Output MusicXML file path")
  .action(async (filePath: string, options: { output?: string }) => {
    try {
      const source = await readSource(filePath);
      const document = parseOpenTab(source);
      const musicXml = toMusicXml(document);
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, musicXml, "utf8");
      } else {
        writeStdout(musicXml);
      }
    } catch (error) {
      writeErrorAndExit(`MusicXML conversion failed: ${formatError(error)}`);
    }
  });

fromCommand
  .command("gpx")
  .description("Import a Guitar Pro GPX file and output OpenTab")
  .argument("<file>", "Guitar Pro GPX file")
  .option("-o, --output <file>", "Output OpenTab file path")
  .action(async (filePath: string, options: { output?: string }) => {
    try {
      const data = await fs.readFile(filePath);
      const otab = await fromGpx(data);
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, otab, "utf8");
      } else {
        writeStdout(otab);
      }
    } catch (error) {
      writeErrorAndExit(`GPX import failed: ${formatError(error)}`);
    }
  });

importCommand
  .command("gp")
  .description("Import a Guitar Pro GPX file and output OpenTab")
  .argument("<file>", "Guitar Pro GPX file")
  .option("-o, --output <file>", "Output OpenTab file path")
  .action(async (filePath: string, options: { output?: string }) => {
    try {
      const data = await fs.readFile(filePath);
      const otab = await fromGpx(data);
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, otab, "utf8");
      } else {
        writeStdout(otab);
      }
    } catch (error) {
      writeErrorAndExit(`GP import failed: ${formatError(error)}`);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  writeErrorAndExit(`Command failed: ${formatError(error)}`);
});
