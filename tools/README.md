# OpenTab tooling workspace

This directory hosts the OpenTab tooling workspace managed by pnpm. It contains
reference implementations and supporting utilities for the OpenTab spec.

## Packages

- `ast`: shared AST types and helpers used across tools.
- `parser`: parser implementation for the OpenTab spec.
- `formatter`: formatter for OpenTab sources.
- `language-service`: shared validation and formatting for editors.
- `converters-ascii`: converter utilities for ASCII tab formats.
- `converters-midi`: converter utilities for MIDI workflows.
- `converters-musicxml`: converter utilities for MusicXML exports.
- `converters-guitarpro`: converter utilities for Guitar Pro imports.
- `importers/ascii`: best-effort ASCII tab importer.
- `opentab`: CLI and user-facing tooling for OpenTab.

## Common commands

From the repo root:

```bash
pnpm -C tools i
pnpm -C tools -r build
pnpm -C tools -r test
```

You can also target a single package:

```bash
pnpm -C tools --filter @opentab/parser build
```
