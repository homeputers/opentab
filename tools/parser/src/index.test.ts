import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAst } from "@opentab/ast";
import { describe, expect, it } from "vitest";

import { parseOpenTab } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(currentDir, "../../../samples");

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObject(entry));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      sorted[key] = sortObject(entryValue);
    }
    return sorted;
  }
  return value;
};

describe("parseOpenTab samples", () => {
  const sampleFiles = fs
    .readdirSync(samplesDir)
    .filter((file) => file.endsWith(".otab"));

  it.each(sampleFiles)("parses and validates %s", (file) => {
    const source = fs.readFileSync(path.join(samplesDir, file), "utf8");
    const document = parseOpenTab(source);
    const validation = validateAst(document);

    expect(validation.ok, validation.errors?.join("\n")).toBe(true);
  });

  it("matches the AST snapshot for minimal.otab", () => {
    const source = fs.readFileSync(path.join(samplesDir, "minimal.otab"), "utf8");
    const document = parseOpenTab(source);
    const snapshot = sortObject(document);

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "format": "opentab",
        "header": {
          "tempo_bpm": 100,
          "time_signature": {
            "denominator": 4,
            "numerator": 4,
          },
          "title": "Minimal Example",
        },
        "measures": [
          {
            "index": 1,
            "tracks": {
              "gtr1": {
                "voices": {
                  "v1": [
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 3,
                        "string": 6,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 5,
                        "string": 5,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 5,
                        "string": 4,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 3,
                        "string": 3,
                      },
                      "type": "note",
                    },
                  ],
                },
              },
            },
          },
          {
            "index": 2,
            "tracks": {
              "gtr1": {
                "voices": {
                  "v1": [
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 3,
                        "string": 6,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 5,
                        "string": 5,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 5,
                        "string": 4,
                      },
                      "type": "note",
                    },
                    {
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "fret": 3,
                        "string": 3,
                      },
                      "type": "note",
                    },
                  ],
                },
              },
            },
          },
        ],
        "tracks": [
          {
            "capo": 0,
            "id": "gtr1",
            "instrument": "electric_guitar",
            "name": "Guitar",
            "tuning": [
              "E2",
              "A2",
              "D3",
              "G3",
              "B3",
              "E4",
            ],
          },
        ],
        "version": "0.1",
      }
    `);
  });
});
