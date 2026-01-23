# opentab

OpenTab command line tools.

## Installation

From the workspace root:

```bash
pnpm --filter opentab build
```

## Usage

```bash
opentab parse <file.otab> [--json]
opentab fmt <file.otab> [--write]
opentab print <file.otab>
opentab to ascii <file.otab>
opentab to midi <file.otab> -o out.mid
opentab to musicxml <file.otab> [-o out.musicxml]
opentab import gp <file.gpx> [-o out.otab]
```

### Examples

```bash
opentab parse samples/minimal.otab
opentab fmt samples/minimal.otab
opentab fmt samples/minimal.otab --write
opentab print samples/minimal.otab
opentab to ascii samples/minimal.otab
opentab to midi samples/minimal.otab -o out.mid
opentab to musicxml samples/minimal.otab -o out.musicxml
opentab import gp <file.gpx> -o out.otab
```

## Manual testing

If you are not running automated tests, verify the CLI manually:

1. Build the workspace:

   ```bash
   pnpm --filter opentab build
   ```

2. Run each command against a sample:

   ```bash
   node tools/opentab/dist/index.js parse samples/minimal.otab
   node tools/opentab/dist/index.js fmt samples/minimal.otab
   node tools/opentab/dist/index.js print samples/minimal.otab
   node tools/opentab/dist/index.js to ascii samples/minimal.otab
   node tools/opentab/dist/index.js to midi samples/minimal.otab -o /tmp/out.mid
   node tools/opentab/dist/index.js to musicxml samples/minimal.otab -o /tmp/out.musicxml
   node tools/opentab/dist/index.js import gp <file.gpx> -o /tmp/out.otab
   ```

3. Confirm:
   - `parse` prints JSON.
   - `fmt` prints formatted text.
   - `print` prints ASCII tab output.
   - `to ascii` prints ASCII tab output.
   - `to midi` writes the MIDI file.
   - `to musicxml` writes the MusicXML file.
   - `import gp` prints the imported OpenTab output.
