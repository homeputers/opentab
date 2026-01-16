# OpenTab Format Specification v0.1 (Draft)

## 1. Overview

OpenTab is a plain-text format for encoding guitar tablature as timed musical events (notes, chords, rests) with explicit durations and extensible technique annotations.

Design goals:
- Computer-friendly and deterministic
- Portable, UTF-8 text, git-friendly
- Open and extensible
- Human-readable for tech-savvy users

The file is composed of:
1. A TOML header (metadata, tracks)
2. A DSL body (measures and musical events)

---

## 2. File Structure

- Encoding: UTF-8
- Newlines: \n
- Header and body are separated by a line containing only `---`

If no body is present, the file is still valid but contains no music.

---

## 3. Header (TOML)

### Required fields

```toml
format = "opentab"
version = "0.1"
```

### Optional metadata

```toml
title = "Song Title"
artist = "Artist"
album = "Album"
composer = "Composer"
```

### Tempo and meter

```toml
tempo_bpm = 120
time_signature = "4/4"
swing = "none"
```

Defaults:
- tempo_bpm = 120
- time_signature = "4/4"

---

## 4. Tracks

Tracks are defined as TOML array tables.

```toml
[[tracks]]
id = "gtr1"
name = "Guitar"
instrument = "electric_guitar"
tuning = ["E2","A2","D3","G3","B3","E4"]
capo = 0
```

- `id` must be unique
- `tuning` is required for tablature tracks
- Strings are ordered lowest to highest pitch

---

## 5. Body (DSL)

### Track selection

```text
@track gtr1 voice v1
```

Track and voice selection is sticky.

---

## 6. Measures

```text
m1: | q (6:3) q (5:5) q (4:5) q (3:3) |
```

- Measures should sum to the current time signature
- One measure per line is recommended

---

## 7. Durations

| Token | Meaning |
|------|--------|
| w | whole |
| h | half |
| q | quarter |
| e | eighth |
| s | sixteenth |
| t | thirty-second |

Modifiers:
- Dotted: `q.`
- Tuplet: `e/3`

Duration carry is allowed within a measure.

---

## 8. Events

### Notes

```text
(3:2h4)
(1:3~)
```

- Format: (string:fret)
- Inline techniques: h, p, /, \, ~

### Chords

```text
[ (4:2) (3:2) (2:3) ]
```

### Rests

```text
r
```

---

## 9. Annotations

```text
(2:5){bend="full", pm=true}
```

- Key/value pairs
- Unknown keys must be ignored by parsers

---

## 10. Extensibility

- New features should prefer annotations
- Unknown annotations must not break parsing
- Versioning follows semantic versioning

---

## 11. Example

```toml
format="opentab"
version="0.1"
tempo_bpm=92
time_signature="4/4"

[[tracks]]
id="gtr1"
tuning=["E2","A2","D3","G3","B3","E4"]
---
@track gtr1
m1: | e (3:2h4) (2:3) q [ (4:2) (3:2) (2:3) ] q r |
```
