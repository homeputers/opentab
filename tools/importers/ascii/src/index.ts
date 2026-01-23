import { formatOtab } from "@opentab/formatter";

export type ImportOptions = {
  defaultTuning?: string[];
  defaultTempoBpm?: number;
  rhythmStrategy?: "unknown" | "fixed-eighth" | "column-grid";
};

export type ImportResult = {
  otab: string;
  warnings: string[];
  metadata: {
    title?: string;
    tuning?: string[];
    capo?: number | null;
    key?: string | null;
  };
};

type ParsedMetadata = {
  title?: string;
  tuning?: string[];
  capo?: number | null;
  key?: string | null;
};

type TabRow = {
  label: string;
  content: string;
};

type TabBlock = {
  rows: TabRow[];
  section?: string;
  chordLine?: string;
};

type DetectedNote = {
  column: number;
  string: number;
  ref: string;
  annotations?: Record<string, string | number | boolean>;
};

type EventToken = {
  column: number;
  token: string;
  annotations?: Record<string, string | number | boolean>;
  duration: "w" | "h" | "q" | "e" | "s" | "t";
};

const DEFAULT_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];
const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_TIME_SIGNATURE = "4/4";
const SUPPORTED_TECHNIQUES = ["h", "p", "/", "\\"] as const;

const isTabRowLine = (line: string): boolean => {
  const trimmed = line.trimEnd();
  if (!trimmed.includes("|")) {
    return false;
  }
  const match = trimmed.match(/^([A-Ga-g])([#b]?)(\d?)\s*\|/);
  if (!match) {
    return false;
  }
  return /[-0-9()\/\\hpbt~|]/.test(trimmed);
};

const parseTabRow = (line: string): TabRow => {
  const trimmed = line.trimEnd();
  const match = trimmed.match(/^\s*([^|]+)\|(.*)$/);
  if (!match) {
    return { label: "", content: "" };
  }
  const label = match[1].trim();
  const content = match[2] ?? "";
  return { label, content };
};

const isSectionHeader = (line: string): string | null => {
  const trimmed = line.trim();
  const match = trimmed.match(/^\[(.+?)\]$/);
  if (!match) {
    return null;
  }
  return match[1].trim();
};

const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes("|")) {
    return false;
  }
  if (trimmed.includes(":")) {
    return false;
  }
  const chordRegex = /\b[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g;
  const matches = trimmed.match(chordRegex) ?? [];
  return matches.length > 0;
};

const normalizeToken = (token: string): string | null => {
  const match = token.match(/^([A-Ga-g])([#b]?)(\d?)$/);
  if (!match) {
    return null;
  }
  const [, letter, accidental, octave] = match;
  const base = `${letter.toUpperCase()}${accidental}`;
  return `${base}${octave ?? ""}`;
};

const applyDefaultOctaves = (
  tokens: string[],
  fallback: string[],
  warn: (message: string) => void
): string[] => {
  const normalized = tokens.map((token, index) => {
    const cleaned = normalizeToken(token);
    if (!cleaned) {
      warn(`Unrecognized tuning token: "${token}". Using default.`);
      return fallback[index] ?? fallback[fallback.length - 1];
    }
    if (/[0-9]$/.test(cleaned)) {
      return cleaned;
    }
    const fallbackToken = fallback[index] ?? fallback[fallback.length - 1];
    const octave = fallbackToken.match(/\d+$/)?.[0] ?? "";
    return `${cleaned}${octave}`;
  });
  return normalized;
};

const buildDefaultTuning = (stringCount: number, defaultTuning: string[]): string[] => {
  if (stringCount <= defaultTuning.length) {
    return defaultTuning.slice(0, stringCount);
  }
  const extra = Array.from({ length: stringCount - defaultTuning.length }, () => "E4");
  return [...defaultTuning, ...extra];
};

const parseMetadata = (lines: string[]): ParsedMetadata => {
  let title: string | undefined;
  let tuning: string[] | undefined;
  let capo: number | null | undefined;
  let key: string | null | undefined;

  const firstTabIndex = lines.findIndex(isTabRowLine);
  const scanLines = firstTabIndex === -1 ? lines : lines.slice(0, firstTabIndex);

  for (const line of scanLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (isSectionHeader(trimmed)) {
      continue;
    }
    const tuningMatch = trimmed.match(/^tuning\s*[:=]\s*(.+)$/i);
    if (tuningMatch) {
      const tokens = tuningMatch[1]
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      if (tokens.length > 0) {
        tuning = tokens;
      }
      continue;
    }
    const capoMatch = trimmed.match(/^capo\s*[:=]\s*(.+)$/i);
    if (capoMatch) {
      const value = capoMatch[1].trim();
      if (/no\s*capo/i.test(value)) {
        capo = 0;
      } else {
        const capoNumber = Number(value.replace(/[^0-9]/g, ""));
        capo = Number.isFinite(capoNumber) ? capoNumber : null;
      }
      continue;
    }
    const keyMatch = trimmed.match(/^key\s*[:=]\s*(.+)$/i);
    if (keyMatch) {
      key = keyMatch[1].trim();
      continue;
    }
    const titleMatch = trimmed.match(/^title\s*[:=]\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    if (!title && !isChordLine(trimmed)) {
      title = trimmed;
    }
  }

  return { title, tuning, capo, key };
};

const detectTabBlocks = (lines: string[], warn: (message: string) => void): TabBlock[] => {
  const blocks: TabBlock[] = [];
  let currentSection: string | undefined;
  let pendingChordLine: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = isSectionHeader(line);
    if (section) {
      currentSection = section;
      pendingChordLine = undefined;
      continue;
    }
    if (isChordLine(line)) {
      pendingChordLine = line.trim();
      continue;
    }
    if (!isTabRowLine(line)) {
      if (line.trim()) {
        pendingChordLine = undefined;
      }
      continue;
    }

    const rows: TabRow[] = [];
    while (index < lines.length && isTabRowLine(lines[index])) {
      rows.push(parseTabRow(lines[index]));
      index += 1;
    }
    index -= 1;

    if (rows.length === 0) {
      continue;
    }
    if (rows.length !== 6) {
      warn(
        `Detected tab block with ${rows.length} strings. Importing best effort.`
      );
    }

    blocks.push({
      rows,
      section: currentSection,
      chordLine: pendingChordLine,
    });
    pendingChordLine = undefined;
  }

  return blocks;
};

const normalizeRowContent = (content: string): string =>
  content.replace(/\s/g, "-");

const splitMeasures = (
  rows: TabRow[],
  warn: (message: string) => void
): string[][] => {
  const normalized = rows.map((row) => normalizeRowContent(row.content));
  const lengthSet = new Set(normalized.map((row) => row.length));
  if (lengthSet.size > 1) {
    warn("Tab row lengths differ; padding shorter rows for alignment.");
  }
  const maxLength = Math.max(...normalized.map((row) => row.length), 0);
  let padded = normalized.map((row) => row.padEnd(maxLength, "-"));

  const barPositions = padded.map((row) => {
    const positions: number[] = [];
    for (let i = 0; i < row.length; i += 1) {
      if (row[i] === "|") {
        positions.push(i);
      }
    }
    return positions;
  });

  const { referencePositions, referenceIndex } = barPositions.reduce(
    (best, current, index) => {
      if (current.length > best.referencePositions.length) {
        return { referencePositions: current, referenceIndex: index };
      }
      return best;
    },
    { referencePositions: barPositions[0] ?? [], referenceIndex: 0 }
  );

  const referenceLength = normalized[referenceIndex]?.length ?? maxLength;
  if (referenceLength > 0 && maxLength > referenceLength) {
    warn("Extra trailing columns detected; trimming to reference row length.");
    padded = normalized.map((row) => row.padEnd(referenceLength, "-").slice(0, referenceLength));
  }

  if (referencePositions.length === 0) {
    warn("No measure separators detected; treating entire block as one measure.");
    return [padded.map((row) => row.replace(/\|/g, ""))];
  }

  const hasMisalignedBars = barPositions.some((positions) => {
    if (positions.length !== referencePositions.length) {
      return true;
    }
    return positions.some((position, index) => position !== referencePositions[index]);
  });

  if (hasMisalignedBars) {
    warn("Measure separators are misaligned across strings; aligning to reference row.");
  }

  const sortedBars = [...referencePositions];
  if (
    sortedBars.length > 0 &&
    sortedBars[sortedBars.length - 1] < referenceLength - 1
  ) {
    sortedBars.push(referenceLength);
  }

  const boundaries = [-1, ...sortedBars];
  const measures: string[][] = [];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i] + 1;
    const end = boundaries[i + 1];
    const slice = padded.map((row) => row.slice(start, end).replace(/\|/g, ""));
    measures.push(slice);
  }

  return measures;
};

const scanMeasure = (
  slices: string[],
  stringCount: number,
  warn: (message: string) => void
): DetectedNote[] => {
  const width = Math.max(...slices.map((slice) => slice.length), 0);
  const padded = slices.map((slice) => slice.padEnd(width, "-"));
  const notes: DetectedNote[] = [];

  for (let lineIndex = 0; lineIndex < padded.length; lineIndex += 1) {
    const line = padded[lineIndex];
    const stringNumber = stringCount - lineIndex;
    let column = 0;

    while (column < line.length) {
      const char = line[column];
      if (char === "(" && /\d/.test(line[column + 1] ?? "")) {
        const start = column + 1;
        let end = start;
        while (end < line.length && /\d/.test(line[end])) {
          end += 1;
        }
        if (line[end] === ")") {
          const { ref, annotations, nextIndex } = parseNoteRef(
            line,
            start,
            end,
            true
          );
          notes.push({
            column: start,
            string: stringNumber,
            ref,
            annotations,
          });
          column = nextIndex;
          continue;
        }
      }

      if (/\d/.test(char)) {
        let end = column + 1;
        while (end < line.length && /\d/.test(line[end])) {
          end += 1;
        }
        const { ref, annotations, nextIndex } = parseNoteRef(
          line,
          column,
          end,
          false
        );
        notes.push({
          column,
          string: stringNumber,
          ref,
          annotations,
        });
        column = nextIndex;
        continue;
      }
      column += 1;
    }
  }

  if (notes.length === 0) {
    warn("No notes detected in a measure.");
  }

  return notes;
};

const parseNoteRef = (
  line: string,
  start: number,
  end: number,
  ghost: boolean
): { ref: string; annotations?: Record<string, string | number | boolean>; nextIndex: number } => {
  let ref = line.slice(start, end);
  const annotations: Record<string, string | number | boolean> = {};
  let index = end;

  let searching = true;
  while (searching && index < line.length) {
    const char = line[index];
    if (char === "~") {
      ref += "~";
      index += 1;
      continue;
    }
    if (SUPPORTED_TECHNIQUES.includes(char as (typeof SUPPORTED_TECHNIQUES)[number])) {
      const nextMatch = line.slice(index + 1).match(/^(\d+)/);
      if (!nextMatch) {
        searching = false;
        continue;
      }
      ref += `${char}${nextMatch[1]}`;
      index += 1 + nextMatch[1].length;
      continue;
    }
    if (char === "b") {
      const nextMatch = line.slice(index + 1).match(/^(\d+)/);
      if (nextMatch) {
        annotations.bend_to = Number(nextMatch[1]);
        index += 1 + nextMatch[1].length;
      } else {
        annotations.bend = true;
        index += 1;
      }
      continue;
    }
    searching = false;
  }

  if (ghost) {
    annotations.ghost = true;
    if (line[index] === ")") {
      index += 1;
    }
  }

  return {
    ref,
    annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
    nextIndex: index,
  };
};

const groupChordEvents = (notes: DetectedNote[]): DetectedNote[][] => {
  const sorted = [...notes].sort((a, b) => a.column - b.column);
  const groups: DetectedNote[][] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([note]);
      continue;
    }
    if (Math.abs(note.column - last[0].column) <= 1) {
      last.push(note);
      continue;
    }
    groups.push([note]);
  }

  return groups;
};

const pickGridCount = (width: number): number => {
  const candidates = [4, 8, 16, 32];
  return candidates.reduce((closest, candidate) => {
    if (Math.abs(width - candidate) < Math.abs(width - closest)) {
      return candidate;
    }
    return closest;
  }, 16);
};

const stepsToDuration = (
  steps: number,
  gridCount: number,
  warn: (message: string) => void
): "w" | "h" | "q" | "e" | "s" | "t" => {
  const denominator = Math.round(gridCount / steps);
  const durationMap: Record<number, "w" | "h" | "q" | "e" | "s" | "t"> = {
    1: "w",
    2: "h",
    4: "q",
    8: "e",
    16: "s",
    32: "t",
  };
  const duration = durationMap[denominator];
  if (duration) {
    return duration;
  }
  warn("Column-grid rhythm produced a non-standard duration; using eighth notes.");
  return "e";
};

const formatAnnotations = (
  annotations?: Record<string, string | number | boolean>
): string => {
  if (!annotations || Object.keys(annotations).length === 0) {
    return "";
  }
  const parts = Object.entries(annotations).map(([key, value]) => {
    if (typeof value === "string") {
      return `${key}="${value}"`;
    }
    return `${key}=${value}`;
  });
  return `{${parts.join(", ")}}`;
};

const buildEventTokens = (
  notes: DetectedNote[],
  options: Required<ImportOptions>,
  warn: (message: string) => void
): EventToken[] => {
  const groups = groupChordEvents(notes);
  const width = Math.max(...notes.map((note) => note.column), 0) + 1;
  const rhythm = options.rhythmStrategy;

  if (rhythm === "unknown") {
    warn(
      "Rhythm is ambiguous in ASCII tabs; using eighth notes with rhythm=\"unknown\" annotations."
    );
  }
  if (rhythm === "column-grid") {
    warn(
      "Rhythm inferred from column spacing; durations are approximate."
    );
  }

  const gridCount = rhythm === "column-grid" ? pickGridCount(width) : 16;
  const gridSize = width / gridCount;
  const eventTokens: EventToken[] = [];

  groups.forEach((group, index) => {
    const sortedNotes = [...group].sort((a, b) => b.string - a.string);
    const column = group[0]?.column ?? 0;
    const nextGroup = groups[index + 1];
    const nextColumn = nextGroup ? nextGroup[0]?.column ?? width : width;
    const startStep = rhythm === "column-grid" ? Math.round(column / gridSize) : 0;
    const nextStep = rhythm === "column-grid" ? Math.max(startStep + 1, Math.round(nextColumn / gridSize)) : 0;
    const steps = rhythm === "column-grid" ? Math.max(1, nextStep - startStep) : 1;
    const duration =
      rhythm === "column-grid" ? stepsToDuration(steps, gridCount, warn) : "e";

    const annotations: Record<string, string | number | boolean> = {};
    if (rhythm === "unknown") {
      annotations.rhythm = "unknown";
    }

    for (const note of sortedNotes) {
      if (note.annotations) {
        for (const [key, value] of Object.entries(note.annotations)) {
          annotations[key] = value;
        }
      }
    }

    const annotationText = formatAnnotations(annotations);

    if (sortedNotes.length === 1) {
      const note = sortedNotes[0];
      const token = `(${note.string}:${note.ref})${annotationText}`;
      eventTokens.push({ column, token, duration });
      return;
    }

    const noteTokens = sortedNotes.map((note) => `(${note.string}:${note.ref})`);
    const token = `[ ${noteTokens.join(" ")} ]${annotationText}`;
    eventTokens.push({ column, token, duration });
  });

  return eventTokens;
};

const buildTuning = (
  metadata: ParsedMetadata,
  stringCount: number,
  blocks: TabBlock[],
  defaultTuning: string[],
  warn: (message: string) => void
): string[] => {
  const fallback = buildDefaultTuning(stringCount, defaultTuning);
  if (metadata.tuning && metadata.tuning.length > 0) {
    return applyDefaultOctaves(metadata.tuning, fallback, warn);
  }

  const firstBlock = blocks[0];
  if (firstBlock) {
    const tokens = firstBlock.rows.map((row) => row.label.trim()).reverse();
    const normalized = applyDefaultOctaves(tokens, fallback, warn);
    warn("No tuning metadata found; inferred tuning from string labels.");
    return normalized;
  }

  warn("No tuning metadata found; defaulting to standard EADGBE.");
  return fallback;
};

const buildOtab = (
  blocks: TabBlock[],
  metadata: ParsedMetadata,
  options: Required<ImportOptions>,
  warn: (message: string) => void,
  getWarningCount: () => number
): { otab: string; tuning: string[] } => {
  const stringCount = blocks[0]?.rows.length ?? DEFAULT_TUNING.length;
  const tuning = buildTuning(
    metadata,
    stringCount,
    blocks,
    options.defaultTuning,
    warn
  );

  if (!metadata.capo && metadata.capo !== 0) {
    warn("Capo not specified; assuming no capo.");
  }

  warn("Time signature not specified; defaulting to 4/4.");

  const bodyLines: string[] = [];
  bodyLines.push("@track gtr1 voice v1");
  if (metadata.title) {
    bodyLines.push(`# Title: ${metadata.title}`);
  }
  if (metadata.key) {
    bodyLines.push(`# Key: ${metadata.key}`);
  }

  let measureIndex = 1;
  for (const block of blocks) {
    if (block.section) {
      bodyLines.push(`# [${block.section}]`);
    }
    if (block.chordLine) {
      bodyLines.push(`# Chords: ${block.chordLine}`);
    }

    const measures = splitMeasures(block.rows, warn);
    for (const slices of measures) {
      const notes = scanMeasure(slices, stringCount, warn);
      const tokens = buildEventTokens(notes, options, warn);
      const eventTokens = tokens
        .sort((a, b) => a.column - b.column)
        .map((token) => `${token.duration} ${token.token}`);
      const content = eventTokens.join(" ");
      bodyLines.push(`m${measureIndex}: | ${content} |`);
      measureIndex += 1;
    }
  }

  const headerLines = [
    "format=\"opentab\"",
    "version=\"0.1\"",
  ];

  if (metadata.title) {
    headerLines.push(`title=\"${metadata.title}\"`);
  }

  headerLines.push(`tempo_bpm=${options.defaultTempoBpm}`);
  headerLines.push(`time_signature=\"${DEFAULT_TIME_SIGNATURE}\"`);
  headerLines.push(`imported_from=\"ascii\"`);
  headerLines.push(`import_warnings=${getWarningCount()}`);
  if (metadata.key) {
    headerLines.push(`key=\"${metadata.key}\"`);
  }

  headerLines.push("", "[[tracks]]");
  headerLines.push("id=\"gtr1\"");
  headerLines.push("name=\"Guitar\"");
  headerLines.push("instrument=\"guitar\"");
  headerLines.push(
    `tuning=[${tuning.map((note) => `\"${note}\"`).join(",")}]`
  );
  if (metadata.capo !== undefined && metadata.capo !== null) {
    headerLines.push(`capo=${metadata.capo}`);
  }

  const otab = [headerLines.join("\n"), "---", bodyLines.join("\n")].join("\n");
  return { otab: formatOtab(otab), tuning };
};

export function importAsciiTab(
  input: string,
  opts: ImportOptions = {}
): ImportResult {
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const warn = (message: string): void => {
    if (warningSet.has(message)) {
      return;
    }
    warningSet.add(message);
    warnings.push(message);
  };
  const getWarningCount = (): number => warnings.length;
  const options: Required<ImportOptions> = {
    defaultTuning: opts.defaultTuning ?? DEFAULT_TUNING,
    defaultTempoBpm: opts.defaultTempoBpm ?? DEFAULT_TEMPO_BPM,
    rhythmStrategy: opts.rhythmStrategy ?? "unknown",
  };
  const lines = input.split(/\r?\n/);
  const metadata = parseMetadata(lines);
  const blocks = detectTabBlocks(lines, warn);

  if (blocks.length === 0) {
    warn("No ASCII tab blocks detected; output will be empty.");
  }

  const { otab, tuning } = buildOtab(blocks, metadata, options, warn, getWarningCount);

  return {
    otab,
    warnings,
    metadata: {
      title: metadata.title,
      tuning,
      capo: metadata.capo ?? null,
      key: metadata.key ?? null,
    },
  };
}
