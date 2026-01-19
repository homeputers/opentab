import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseOpenTab } from "../../parser/src/index.js";

import { toAsciiTab } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(currentDir, "../../../samples");

const loadSample = (name: string): string =>
  fs.readFileSync(path.join(samplesDir, name), "utf8");

describe("toAsciiTab", () => {
  it("renders minimal.otab to an ASCII snapshot", () => {
    const document = parseOpenTab(loadSample("minimal.otab"));
    const ascii = toAsciiTab(document);

    expect(ascii).toMatchInlineSnapshot(`
      "# Track: Guitar
      // m1
      E4 |-------|
      B3 |-------|
      G3 |------3|
      D3 |----5--|
      A2 |--5----|
      E2 |3------|
      // m2
      E4 |-------|
      B3 |-------|
      G3 |------3|
      D3 |----5--|
      A2 |--5----|
      E2 |3------|"
    `);
  });

  it("renders all samples without throwing", () => {
    const sampleFiles = fs
      .readdirSync(samplesDir)
      .filter((file) => file.endsWith(".otab"));

    for (const file of sampleFiles) {
      const document = parseOpenTab(loadSample(file));
      expect(() => toAsciiTab(document)).not.toThrow();
    }
  });
});
