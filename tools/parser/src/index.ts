import type {
  AnnotationValue,
  Annotations,
  Duration,
  Event,
  Header,
  Measure,
  NoteRef,
  OpenTabDocument,
  Technique,
  TimeSignature,
  Track,
  TrackMeasure,
} from "@opentab/ast";

export const packageName = "@opentab/parser";

const HEADER_DELIMITER = "---";
const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4,
};

export class OpenTabParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenTabParseError";
  }
}

interface ParsedHeader {
  format?: string;
  version?: string;
  header: Record<string, unknown>;
  tracks: Track[];
}

interface DirectiveState {
  trackId: string | null;
  voiceId: string | null;
}

function stripComment(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) {
    return "";
  }
  return line;
}

function parseTomlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return splitCommaSeparated(inner).map((value) =>
      parseTomlValue(value.trim())
    );
  }
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }
  return trimmed;
}

function buildTrack(candidate: Partial<Track>): Track {
  if (!candidate.id) {
    throw new OpenTabParseError("Track definition missing id");
  }
  return {
    id: candidate.id,
    name: candidate.name,
    instrument: candidate.instrument,
    tuning: candidate.tuning,
    capo: candidate.capo,
  };
}

function parseHeader(lines: string[]): ParsedHeader {
  const header: Record<string, unknown> = {};
  const tracks: Track[] = [];
  let currentTrack: Partial<Track> | null = null;
  let format: string | undefined;
  let version: string | undefined;

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }

    if (line === "[[tracks]]") {
      if (currentTrack) {
        tracks.push(buildTrack(currentTrack));
      }
      currentTrack = {};
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!match) {
      throw new OpenTabParseError(`Invalid header line: ${line}`);
    }
    const [, key, valueRaw] = match;
    const value = parseTomlValue(valueRaw);

    if (currentTrack) {
      if (key === "id") {
        currentTrack.id = String(value);
      } else if (key === "name") {
        currentTrack.name = String(value);
      } else if (key === "instrument") {
        currentTrack.instrument = String(value);
      } else if (key === "tuning") {
        currentTrack.tuning = Array.isArray(value)
          ? value.map((item) => String(item))
          : undefined;
      } else if (key === "capo") {
        currentTrack.capo = Number(value);
      }
      continue;
    }

    if (key === "format") {
      format = String(value);
    } else if (key === "version") {
      version = String(value);
    } else {
      header[key] = value;
    }
  }

  if (currentTrack) {
    tracks.push(buildTrack(currentTrack));
  }

  return { format, version, header, tracks };
}

function parseTimeSignature(value: unknown): TimeSignature | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = value.match(/^(\d+)\/(\d+)$/);
  if (!match) {
    return undefined;
  }
  return {
    numerator: Number(match[1]),
    denominator: Number(match[2]) as TimeSignature["denominator"],
  };
}

function normalizeTimeSignature(value: unknown): TimeSignature {
  if (typeof value === "string") {
    const parsed = parseTimeSignature(value);
    if (!parsed) {
      throw new OpenTabParseError(`Invalid time signature: ${value}`);
    }
    return parsed;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      numerator?: unknown;
      denominator?: unknown;
    };
    if (
      typeof candidate.numerator === "number" &&
      Number.isInteger(candidate.numerator) &&
      typeof candidate.denominator === "number" &&
      Number.isInteger(candidate.denominator) &&
      [1, 2, 4, 8, 16, 32].includes(candidate.denominator)
    ) {
      return {
        numerator: candidate.numerator,
        denominator: candidate.denominator as TimeSignature["denominator"],
      };
    }
  }

  throw new OpenTabParseError("Invalid time signature value");
}

function normalizeHeader(raw: Record<string, unknown>): Header {
  const header: Record<string, unknown> = { ...raw };

  const stringFields = [
    "title",
    "artist",
    "album",
    "composer",
    "source",
    "copyright",
  ];

  for (const field of stringFields) {
    if (field in raw && typeof raw[field] !== "string") {
      throw new OpenTabParseError(`Invalid header field: ${field}`);
    }
  }

  if ("tempo_bpm" in raw) {
    const tempo = raw.tempo_bpm;
    if (typeof tempo !== "number" || Number.isNaN(tempo) || tempo < 1) {
      throw new OpenTabParseError("Invalid tempo_bpm");
    }
    header.tempo_bpm = tempo;
  } else {
    header.tempo_bpm = DEFAULT_TEMPO_BPM;
  }

  if ("time_signature" in raw) {
    header.time_signature = normalizeTimeSignature(raw.time_signature);
  } else {
    header.time_signature = DEFAULT_TIME_SIGNATURE;
  }

  if ("swing" in raw) {
    if (raw.swing !== "none" && raw.swing !== "eighth") {
      throw new OpenTabParseError("Invalid swing value");
    }
    header.swing = raw.swing;
  }

  return header as Header;
}

function parseDuration(token: string): Duration | null {
  const match = token.match(/^([whqest])(\.)?(?:\/(\d+))?$/);
  if (!match) {
    return null;
  }
  const [, base, dot, tuplet] = match;
  const duration: Duration = { base: base as Duration["base"] };
  if (dot) {
    duration.dots = 1;
  }
  if (tuplet) {
    duration.tuplet = Number(tuplet);
  }
  return duration;
}

function splitTokens(content: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === "[" || char === "(" || char === "{") {
      depth += 1;
    } else if (char === "]" || char === ")" || char === "}") {
      depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }
  return tokens.filter((token) => token.length > 0);
}

function splitAnnotations(token: string): { main: string; annotation?: string } {
  let depth = 0;
  for (let i = 0; i < token.length; i += 1) {
    const char = token[i];
    if (char === "[" || char === "(") {
      depth += 1;
    } else if (char === "]" || char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === "{" && depth === 0) {
      return {
        main: token.slice(0, i),
        annotation: token.slice(i),
      };
    }
  }
  return { main: token };
}

function splitCommaSeparated(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "\"") {
      inString = !inString;
    }
    if (char === "," && !inString) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function parseAnnotations(raw?: string): Annotations | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return undefined;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return undefined;
  }
  const entries = splitCommaSeparated(inner);
  const annotations: Annotations = {};
  for (const entry of entries) {
    const [keyPart, ...rest] = entry.split("=");
    if (!keyPart || rest.length === 0) {
      continue;
    }
    const key = keyPart.trim();
    const valueRaw = rest.join("=").trim();
    annotations[key] = parseAnnotationValue(valueRaw);
  }
  return Object.keys(annotations).length > 0 ? annotations : undefined;
}

function parseAnnotationValue(raw: string): AnnotationValue {
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  const numberValue = Number(trimmed);
  if (!Number.isNaN(numberValue)) {
    return numberValue;
  }
  return trimmed;
}

function parseNoteRef(raw: string): NoteRef {
  const match = raw.match(/^(\d+):(.+)$/);
  if (!match) {
    throw new OpenTabParseError(`Invalid note reference: ${raw}`);
  }
  const [, stringRaw, restRaw] = match;
  let currentFretMatch = restRaw.match(/^(\d+)/);
  if (!currentFretMatch) {
    throw new OpenTabParseError(`Invalid fret in note reference: ${raw}`);
  }
  let currentFret = Number(currentFretMatch[1]);
  const techniques: Technique[] = [];
  let index = currentFretMatch[1].length;

  while (index < restRaw.length) {
    const op = restRaw[index];
    if (op === "~") {
      techniques.push({ type: "vibrato" });
      index += 1;
      continue;
    }
    if (!["h", "p", "/", "\\"].includes(op)) {
      throw new OpenTabParseError(`Unknown technique in note: ${raw}`);
    }
    index += 1;
    const nextMatch = restRaw.slice(index).match(/^(\d+)/);
    if (!nextMatch) {
      throw new OpenTabParseError(`Technique missing fret in note: ${raw}`);
    }
    const nextFret = Number(nextMatch[1]);
    if (op === "h") {
      techniques.push({
        type: "hammer_on",
        fromFret: currentFret,
        toFret: nextFret,
      });
    } else if (op === "p") {
      techniques.push({
        type: "pull_off",
        fromFret: currentFret,
        toFret: nextFret,
      });
    } else {
      techniques.push({
        type: "slide",
        fromFret: currentFret,
        toFret: nextFret,
        direction: op === "/" ? "up" : "down",
      });
    }
    currentFret = nextFret;
    index += nextMatch[1].length;
  }

  return {
    string: Number(stringRaw),
    fret: Number(currentFretMatch[1]),
    inlineTechniques: techniques.length > 0 ? techniques : undefined,
  };
}

function parseChord(token: string): { notes: NoteRef[]; annotations?: Annotations } {
  const { main, annotation } = splitAnnotations(token);
  if (!main.startsWith("[") || !main.endsWith("]")) {
    throw new OpenTabParseError(`Invalid chord token: ${token}`);
  }
  const inner = main.slice(1, -1).trim();
  const notes: NoteRef[] = [];
  const noteMatches = inner.matchAll(/\(([^)]+)\)/g);
  for (const match of noteMatches) {
    notes.push(parseNoteRef(match[1]));
  }
  if (notes.length === 0) {
    throw new OpenTabParseError(`Chord has no notes: ${token}`);
  }
  return { notes, annotations: parseAnnotations(annotation) };
}

function parseRest(token: string): { annotations?: Annotations } {
  const { main, annotation } = splitAnnotations(token);
  if (main !== "r") {
    throw new OpenTabParseError(`Invalid rest token: ${token}`);
  }
  return { annotations: parseAnnotations(annotation) };
}

function parseNote(token: string): { note: NoteRef; annotations?: Annotations } {
  const { main, annotation } = splitAnnotations(token);
  if (!main.startsWith("(") || !main.endsWith(")")) {
    throw new OpenTabParseError(`Invalid note token: ${token}`);
  }
  const inner = main.slice(1, -1);
  return { note: parseNoteRef(inner), annotations: parseAnnotations(annotation) };
}

function parseMeasureLine(
  line: string,
  state: DirectiveState,
  measureMap: Map<number, Measure>
): void {
  const match = line.match(/^m(\d+):\s*\|(.*)\|\s*$/);
  if (!match) {
    throw new OpenTabParseError(`Invalid measure line: ${line}`);
  }
  if (!state.trackId || !state.voiceId) {
    throw new OpenTabParseError(
      `Measure defined before selecting track/voice: ${line}`
    );
  }

  const measureIndex = Number(match[1]);
  const content = match[2].trim();
  const tokens = content ? splitTokens(content) : [];
  let currentDuration: Duration | null = null;
  const events: Event[] = [];

  for (const token of tokens) {
    const duration = parseDuration(token);
    if (duration) {
      currentDuration = duration;
      continue;
    }
    if (!currentDuration) {
      throw new OpenTabParseError(
        `Missing duration before token "${token}" in measure ${measureIndex}`
      );
    }

    if (token.startsWith("r")) {
      const rest = parseRest(token);
      events.push({
        type: "rest",
        duration: currentDuration,
        annotations: rest.annotations,
      });
      continue;
    }

    if (token.startsWith("[")) {
      const chord = parseChord(token);
      events.push({
        type: "chord",
        duration: currentDuration,
        chord: chord.notes,
        annotations: chord.annotations,
      });
      continue;
    }

    if (token.startsWith("(")) {
      const note = parseNote(token);
      events.push({
        type: "note",
        duration: currentDuration,
        note: note.note,
        annotations: note.annotations,
      });
      continue;
    }

    throw new OpenTabParseError(`Unknown token: ${token}`);
  }

  const measure =
    measureMap.get(measureIndex) ??
    ({
      index: measureIndex,
      tracks: {},
    } as Measure);

  const trackMeasure =
    measure.tracks[state.trackId] ??
    ({
      voices: {},
    } as TrackMeasure);

  trackMeasure.voices[state.voiceId] = events;
  measure.tracks[state.trackId] = trackMeasure;
  measureMap.set(measureIndex, measure);
}

function parseDirective(line: string, state: DirectiveState): void {
  const match = line.match(/^@track\s+(\S+)(?:\s+voice\s+(\S+))?$/);
  if (!match) {
    throw new OpenTabParseError(`Invalid directive: ${line}`);
  }
  state.trackId = match[1];
  state.voiceId = match[2] ?? "v1";
}

export function parseOpenTab(source: string): OpenTabDocument {
  const lines = source.split(/\r?\n/);
  const delimiterIndex = lines.findIndex((line) => line.trim() === HEADER_DELIMITER);
  if (delimiterIndex === -1) {
    throw new OpenTabParseError(`Missing header delimiter "${HEADER_DELIMITER}"`);
  }

  const headerLines = lines.slice(0, delimiterIndex);
  const bodyLines = lines.slice(delimiterIndex + 1);

  const parsedHeader = parseHeader(headerLines);
  if (parsedHeader.format !== "opentab") {
    throw new OpenTabParseError("Unsupported format");
  }
  if (parsedHeader.version !== "0.1") {
    throw new OpenTabParseError("Unsupported version");
  }

  const header = normalizeHeader(parsedHeader.header);

  const state: DirectiveState = { trackId: null, voiceId: null };
  const measureMap = new Map<number, Measure>();

  for (const rawLine of bodyLines) {
    const stripped = stripComment(rawLine).trim();
    if (!stripped) {
      continue;
    }
    if (stripped.startsWith("@track")) {
      parseDirective(stripped, state);
      continue;
    }
    if (stripped.startsWith("m")) {
      parseMeasureLine(stripped, state, measureMap);
      continue;
    }
    throw new OpenTabParseError(`Unknown line in body: ${stripped}`);
  }

  const measures = Array.from(measureMap.values()).sort(
    (a, b) => a.index - b.index
  );

  return {
    format: "opentab",
    version: "0.1",
    header,
    tracks: parsedHeader.tracks,
    measures,
  };
}
