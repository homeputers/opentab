# Importing ASCII tabs

OpenTab ships with a **best-effort ASCII tab importer** for the common “internet tab” formats.
It aims to preserve string/fret data, measure boundaries, and section labels while being honest
about timing ambiguity.

## Supported patterns

The importer looks for:

- 6-line tab blocks with string labels like `e|`, `B|`, `G|`, `D|`, `A|`, `E|`.
- Measures separated by `|` characters.
- Fret numbers in columns, including multi-digit frets (e.g., `10`, `12`, `15`).
- Optional section headers like `[Intro]`, `[Verse]`, `[Chorus]`.
- Optional metadata near the top of the file:
  - `Title: ...`
  - `Tuning: Eb Ab Db Gb Bb Eb`
  - `Capo: 2` or `Capo: No capo`
  - `Key: Db`
- Optional chord labels above measures (e.g., `G5   C5`).

## CLI usage

```bash
opentab import ascii <file.txt> -o out.otab
```

You can control rhythm approximation with:

```bash
opentab import ascii <file.txt> --rhythm unknown
opentab import ascii <file.txt> --rhythm fixed-eighth
opentab import ascii <file.txt> --rhythm column-grid
```

## Rhythm limitations

ASCII tabs rarely encode timing. By default, the importer:

- Emits eighth notes for each event.
- Adds `{rhythm="unknown"}` annotations to remind you to review timing.

If you enable `column-grid`, the importer infers a timing grid based on column spacing, but still
emits warnings because the result is approximate.

## Example

Input:

```text
[Chorus]
G5     C5

e|----------------|
B|----------------|
G|--0-----5-------|
D|--0-----5-------|
A|--2-----3-------|
E|--3-------------|
```

Output (OpenTab):

```otab
m1: | e [ (4:0) (3:0) (2:2) (1:3) ]{rhythm="unknown"} e [ (4:5) (3:5) (2:3) ]{rhythm="unknown"} |
```

## Notes & warnings

- Import is **best effort**: unexpected spacing or non-standard formats may produce warnings.
- Unknown annotations are preserved as warnings rather than silently dropped.
- Always review and refine rhythm after import.
