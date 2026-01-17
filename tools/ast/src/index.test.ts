import { describe, expect, it } from "vitest";

import { validateAst } from "./index.js";

describe("validateAst", () => {
  it("accepts a minimal OpenTab AST", () => {
    const document = {
      format: "opentab",
      version: "0.1",
      header: {
        title: "Unit Test",
        time_signature: {
          numerator: 4,
          denominator: 4,
        },
      },
      tracks: [
        {
          id: "guitar",
          name: "Guitar",
          tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
        },
      ],
      measures: [
        {
          index: 1,
          tracks: {
            guitar: {
              voices: {
                main: [
                  {
                    type: "note",
                    duration: {
                      base: "q",
                    },
                    note: {
                      string: 1,
                      fret: 0,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    };

    const result = validateAst(document);

    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});
