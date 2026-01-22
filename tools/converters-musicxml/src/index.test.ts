import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseOpenTab } from "@opentab/parser";

import { toMusicXml } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSample(name: string): string {
  const samplePath = path.resolve(__dirname, "../../../samples", name);
  return fs.readFileSync(samplePath, "utf8");
}

describe("toMusicXml", () => {
  it("converts a sample to MusicXML", () => {
    const sample = loadSample("minimal.otab");
    const document = parseOpenTab(sample);

    const xml = toMusicXml(document);

    expect(xml).toContain("<score-partwise version=\"3.1\">");
    expect(xml).toContain("<measure number=\"1\">");
    expect(xml).toContain("<string>6</string>");
    expect(xml).toContain("<fret>3</fret>");
  });
});
