<p align="center">
  <img src="logofull.png" alt="OpenTab logo" />
</p>

<p align="center">
  <!-- Badge URL placeholders (replace when available). -->
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Homeputers.opentab-vscode"><img alt="VS Code Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/Homeputers.opentab-vscode" /></a>
  <a href="https://homeputers.com/opentab/"><img alt="Docs" src="https://img.shields.io/badge/docs-online-brightgreen.svg" /></a>
</p>

# OpenTab 🎸

OpenTab is an **open, text-based, computer-friendly format for guitar tablature**.

It is designed to treat tablature as **structured musical data**, not ASCII art, while remaining readable and writable by humans.

---

## Why OpenTab?

Existing options all fall short in different ways:

### ASCII tablature
- ✅ Easy for humans
- ❌ Ambiguous timing
- ❌ Impossible to parse reliably
- ❌ Loses musical intent

### Guitar Pro (`.gp*`)
- ✅ Very expressive
- ❌ Proprietary and binary
- ❌ Hard to diff, version, or extend
- ❌ Tied to specific software

### MusicXML
- ✅ Open standard
- ❌ Notation-first, not tab-first
- ❌ Verbose and hard to author by hand
- ❌ Guitar techniques are second-class

**OpenTab exists to fill this gap.**

---

## Design goals

- 🎯 **Explicit timing** — no spacing-based inference
- 🧠 **Semantic model** — notes, chords, techniques as data
- 📄 **Plain text** — UTF-8, git-friendly, diffable
- 🔌 **Extensible** — forward-compatible annotations
- 🧑‍💻 **Developer-friendly** — parsers, schemas, tooling
- 🎸 **Musician-friendly** — compact, readable DSL

---

## What OpenTab is (and isn’t)

**OpenTab is:**
- A canonical source format
- Suitable for version control
- Convertible to MIDI, MusicXML, ASCII tab

**OpenTab is not:**
- A visual engraving/layout format
- A replacement for notation software
- An attempt to encode “ASCII tab with metadata”

---

## Example

```otab
m1: | q (6:3) q (5:5) q (4:5) q (3:3) |
m2: | e (3:2h4) (2:3) q [ (4:2) (3:2) (2:3) ] q r |
```

---

## Quick start

- Open any `.otab` sample in [samples/](samples/) with your editor of choice.
- Read the specification in [spec/opentab-spec-v0.1.md](spec/opentab-spec-v0.1.md).
- Explore the VS Code extension source in [editors/vscode/](editors/vscode/).
- Visit the docs site: [OpenTab docs](https://homeputers.com/opentab/).

## Project links

- Specification: [spec/opentab-spec-v0.1.md](spec/opentab-spec-v0.1.md)
- Documentation site: [https://homeputers.com/opentab/](https://homeputers.com/opentab/)
- VS Code extension: [editors/vscode/](editors/vscode/)
- Samples: [samples/](samples/)

---

## Repository structure

```
opentab/
├── spec/        # Versioned specifications
├── samples/     # Example .otab files
├── tools/       # Parsers, formatters, converters
├── editors/     # Editor integrations (VS Code, etc.)
├── docs/        # Documentation website
└── README.md
```

---

## Brand assets

<p>
  <img src="iconfull.png" alt="OpenTab icon preview" width="192" />
</p>

`icon128x128.png` is used for the VS Code extension icon and the docs favicon.

---

## Status

- Spec: **v0.1 (draft)**
- Reference implementations: planned
- VS Code support: planned

---

## License

MIT — see [LICENSE](LICENSE)
