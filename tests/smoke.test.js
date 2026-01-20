const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const esbuild = require("../tools/node_modules/esbuild");

const repoRoot = path.resolve(__dirname, "..");
const toolsDir = path.join(repoRoot, "tools");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opentab-smoke-"));
const entryPath = path.join(tempDir, "entry.ts");
const outputPath = path.join(tempDir, "bundle.cjs");

const workspaceModules = {
  "@opentab/parser": path.join(toolsDir, "parser", "src", "index.ts"),
  "@opentab/converters-ascii": path.join(
    toolsDir,
    "converters-ascii",
    "src",
    "index.ts"
  ),
  "@opentab/converters-midi": path.join(
    toolsDir,
    "converters-midi",
    "src",
    "index.ts"
  ),
  "@opentab/ast": path.join(toolsDir, "ast", "src", "index.ts"),
};

const workspacePlugin = {
  name: "opentab-workspace",
  setup(build) {
    build.onResolve({ filter: /^@opentab\// }, (args) => {
      const resolved = workspaceModules[args.path];
      if (!resolved) {
        return null;
      }
      return { path: resolved };
    });

    build.onResolve({ filter: /^midi-file$/ }, () => {
      return {
        path: require.resolve("midi-file", {
          paths: [path.join(toolsDir, "node_modules")],
        }),
      };
    });
  },
};

fs.writeFileSync(
  entryPath,
  [
    "import { parseOpenTab } from '@opentab/parser';",
    "import { toAsciiTab } from '@opentab/converters-ascii';",
    "import { toMidi } from '@opentab/converters-midi';",
    "export { parseOpenTab, toAsciiTab, toMidi };",
  ].join("\n")
);

esbuild.buildSync({
  entryPoints: [entryPath],
  outfile: outputPath,
  bundle: true,
  format: "cjs",
  platform: "node",
  resolveExtensions: [".ts", ".js", ".json"],
  absWorkingDir: repoRoot,
  logLevel: "silent",
  plugins: [workspacePlugin],
});

const { parseOpenTab, toAsciiTab, toMidi } = require(outputPath);

const sample = [
  'format="opentab"',
  'version="0.1"',
  'title="Smoke Test"',
  "tempo_bpm=120",
  'time_signature="4/4"',
  "",
  "[[tracks]]",
  'id="gtr1"',
  'name="Guitar"',
  'instrument="electric_guitar"',
  'tuning=["E2","A2","D3","G3","B3","E4"]',
  "---",
  "@track gtr1 voice v1",
  "m1: | q (6:3) |",
].join("\n");

const document = parseOpenTab(sample);
const ascii = toAsciiTab(document);
const midi = toMidi(document);

assert.ok(ascii.length > 0, "Expected ASCII output to be non-empty");
assert.ok(midi.length > 0, "Expected MIDI output to be non-empty");
assert.equal(
  Buffer.from(midi.slice(0, 4)).toString("ascii"),
  "MThd",
  "Expected MIDI header signature"
);

console.log("Smoke test passed.");
