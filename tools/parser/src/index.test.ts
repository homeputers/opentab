import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAst } from "@opentab/ast";
import { describe, expect, it } from "vitest";

import { parseOpenTab } from "./index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(currentDir, "../../../samples");

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

    expect(document).toMatchInlineSnapshot(`
      {
        "format": "opentab",
        "version": "0.1",
        "header": {
          "title": "Minimal Example",
          "tempo_bpm": 100,
          "time_signature": {
            "numerator": 4,
            "denominator": 4,
          },
        },
        "tracks": [
          {
            "id": "gtr1",
            "name": "Guitar",
            "instrument": "electric_guitar",
            "tuning": [
              "E2",
              "A2",
              "D3",
              "G3",
              "B3",
              "E4",
            ],
            "capo": 0,
          },
        ],
        "measures": [
          {
            "index": 1,
            "tracks": {
              "gtr1": {
                "voices": {
                  "v1": [
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 6,
                        "fret": 3,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 5,
                        "fret": 5,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 4,
                        "fret": 5,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 3,
                        "fret": 3,
                      },
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
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 6,
                        "fret": 3,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 5,
                        "fret": 5,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 4,
                        "fret": 5,
                      },
                    },
                    {
                      "type": "note",
                      "duration": {
                        "base": "q",
                      },
                      "note": {
                        "string": 3,
                        "fret": 3,
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      }
    `);
  });
});
