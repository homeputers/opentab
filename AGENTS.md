# AGENTS.md

This repository defines the OpenTab specification and related tooling.

AI agents, contributors, and automated tools should follow these guidelines.

---

## Project intent

OpenTab aims to be:
- Open
- Minimal
- Deterministic
- Forward-compatible

Changes should prioritize:
1. Explicit musical semantics
2. Backward compatibility
3. Human + machine readability

---

## Contribution guidelines

When modifying or generating content:

### Spec changes
- Never modify an existing spec version
- Add new versions as new files (e.g. `opentab-v0.2.md`)
- Document breaking changes explicitly

### Tooling
- Treat parsers/renderers as **reference implementations**
- Avoid proprietary dependencies
- Prefer clarity over cleverness

### Samples
- Keep samples small and focused
- Each sample should demonstrate one concept clearly

### Git guidelines
- Use conventional commits when adding changes

---

## Parsing rules (high-level)

- Unknown annotations must be ignored (unless strict mode)
- Explicit timing always wins over inference
- Formatting is not semantic

---

## AI usage

AI-generated contributions are welcome, but must:
- Be reviewed by a human
- Follow the spec exactly
- Avoid inventing undocumented features

---

## Philosophy

> “Tabs are data, not drawings.”

OpenTab exists to preserve musical intent across tools, time, and platforms.
