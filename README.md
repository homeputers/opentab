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

## Status

- Spec: **v0.1 (draft)**
- Reference implementations: planned
- VS Code support: planned

---

## License

MIT — see [LICENSE](LICENSE)
