import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseOpenTab } from "@opentab/parser";

import { toMidi } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSample(name: string): string {
  const samplePath = path.resolve(__dirname, "../../../samples", name);
  return fs.readFileSync(samplePath, "utf8");
}

describe("toMidi", () => {
  it("converts a sample to a MIDI byte array", () => {
    const sample = loadSample("minimal.otab");
    const document = parseOpenTab(sample);

    const midi = toMidi(document);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opentab-midi-"));
    const outputPath = path.join(tempDir, "minimal.mid");
    fs.writeFileSync(outputPath, midi);

    expect(midi.length).toBeGreaterThan(0);
    const signature = new TextDecoder().decode(midi.slice(0, 4));
    expect(signature).toBe("MThd");
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
