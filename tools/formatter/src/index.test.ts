import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseOpenTab } from "../../parser/src/index.js";

import { formatOtab } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(currentDir, "../../../samples");

function loadSampleFiles(): string[] {
  return fs.readdirSync(samplesDir).filter((file) => file.endsWith(".otab"));
}

describe("formatOtab", () => {
  const sampleFiles = loadSampleFiles();

  it.each(sampleFiles)("formats and parses %s", (file) => {
    const source = fs.readFileSync(path.join(samplesDir, file), "utf8");
    const formatted = formatOtab(source);
    const formattedAgain = formatOtab(formatted);

    expect(formattedAgain).toBe(formatted);
    expect(() => parseOpenTab(formatted)).not.toThrow();
  });

  it("expands duration carry consistently", () => {
    const input = [
      "format=\"opentab\"",
      "version=\"0.1\"",
      "---",
      "@track gtr1",
      "m1: | q (6:3) (5:5) (4:5) (3:3) |",
    ].join("\n");

    const formatted = formatOtab(input);

    expect(formatted).toContain(
      "m1: | q (6:3) q (5:5) q (4:5) q (3:3) |"
    );
    expect(formatOtab(formatted)).toBe(formatted);
  });
});
