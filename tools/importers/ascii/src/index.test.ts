import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseOpenTab } from "../../../parser/src/index.js";

import { importAsciiTab } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(currentDir, "../../../../samples/ascii");

const loadSample = (name: string): string =>
  fs.readFileSync(path.join(samplesDir, name), "utf8");

describe("importAsciiTab", () => {
  it("imports a Sweet Child O' Mine excerpt", () => {
    const result = importAsciiTab(loadSample("sweet-child-omine.txt"));

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(() => parseOpenTab(result.otab)).not.toThrow();
    expect(result.otab).toMatchInlineSnapshot(`
      "format=\"opentab\"\nversion=\"0.1\"\ntitle=\"Sweet Child O' Mine (Intro)\"\ntempo_bpm=120\ntime_signature=\"4/4\"\nimported_from=\"ascii\"\nimport_warnings=6\n\n[[tracks]]\nid=\"gtr1\"\nname=\"Guitar\"\ninstrument=\"guitar\"\ntuning=[\"Eb2\",\"Ab2\",\"Db3\",\"Gb3\",\"Bb3\",\"Eb4\"]\n\n---\n\n@track gtr1 voice v1\n# Title: Sweet Child O' Mine (Intro)\n# [Intro]\nm1: | e (1:0){rhythm=\"unknown\"} e (1:0){rhythm=\"unknown\"} e (2:2){rhythm=\"unknown\"} e (2:4){rhythm=\"unknown\"} e (3:2){rhythm=\"unknown\"} e (2:4){rhythm=\"unknown\"} e (2:2){rhythm=\"unknown\"} |\nm2: | e (1:0){rhythm=\"unknown\"} e (1:0){rhythm=\"unknown\"} e (2:2){rhythm=\"unknown\"} e (2:4){rhythm=\"unknown\"} e (3:2){rhythm=\"unknown\"} e (2:4){rhythm=\"unknown\"} e (2:2){rhythm=\"unknown\"} |"
    `);
  });

  it("imports a single-note riff", () => {
    const result = importAsciiTab(loadSample("single-note-riff.txt"));

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(() => parseOpenTab(result.otab)).not.toThrow();
    expect(result.otab).toMatchInlineSnapshot(`
      "format=\"opentab\"\nversion=\"0.1\"\ntitle=\"Single Note Riff\"\ntempo_bpm=120\ntime_signature=\"4/4\"\nimported_from=\"ascii\"\nimport_warnings=3\n\n[[tracks]]\nid=\"gtr1\"\nname=\"Guitar\"\ninstrument=\"guitar\"\ntuning=[\"E2\",\"A2\",\"D3\",\"G3\",\"B3\",\"E4\"]\ncapo=2\n\n---\n\n@track gtr1 voice v1\n# Title: Single Note Riff\nm1: | e (2:0){rhythm=\"unknown\"} e (2:0){rhythm=\"unknown\"} e (3:2){rhythm=\"unknown\"} e (3:2){rhythm=\"unknown\"} e (3:2){rhythm=\"unknown\"} |"
    `);
  });

  it("imports chord-heavy sections", () => {
    const result = importAsciiTab(loadSample("chords-section.txt"));

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(() => parseOpenTab(result.otab)).not.toThrow();
    expect(result.otab).toMatchInlineSnapshot(`
      "format=\"opentab\"\nversion=\"0.1\"\ntempo_bpm=120\ntime_signature=\"4/4\"\nimported_from=\"ascii\"\nimport_warnings=4\n\n[[tracks]]\nid=\"gtr1\"\nname=\"Guitar\"\ninstrument=\"guitar\"\ntuning=[\"E2\",\"A2\",\"D3\",\"G3\",\"B3\",\"E4\"]\n\n---\n\n@track gtr1 voice v1\n# [Chorus]\n# Chords: G5     C5\nm1: | e [ (4:0) (3:0) (2:2) (1:3) ]{rhythm=\"unknown\"} e [ (4:5) (3:5) (2:3) ]{rhythm=\"unknown\"} |"
    `);
  });
});
