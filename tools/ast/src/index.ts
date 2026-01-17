import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type AnySchema } from "ajv";

export const packageName = "@opentab/ast";

export type VoiceId = string;

export interface TimeSignature {
  numerator: number;
  denominator: 1 | 2 | 4 | 8 | 16 | 32;
}

export interface Header {
  title?: string;
  artist?: string;
  album?: string;
  composer?: string;
  source?: string;
  copyright?: string;
  tempo_bpm?: number;
  time_signature?: TimeSignature;
  swing?: "none" | "eighth";
}

export interface Track {
  id: string;
  name?: string;
  instrument?: string;
  tuning?: string[];
  capo?: number;
}

export interface Duration {
  base: "w" | "h" | "q" | "e" | "s" | "t";
  dots?: number;
  tuplet?: number;
}

export type AnnotationValue = string | number | boolean;
export type Annotations = Record<string, AnnotationValue>;

export interface Technique {
  type: "hammer_on" | "pull_off" | "slide" | "vibrato";
  fromFret?: number;
  toFret?: number;
  direction?: "up" | "down";
}

export interface NoteRef {
  string: number;
  fret: number;
  inlineTechniques?: Technique[];
  annotations?: Annotations;
}

export interface NoteEvent {
  type: "note";
  duration: Duration;
  note: NoteRef;
  annotations?: Annotations;
}

export interface ChordEvent {
  type: "chord";
  duration: Duration;
  chord: NoteRef[];
  annotations?: Annotations;
}

export interface RestEvent {
  type: "rest";
  duration: Duration;
  annotations?: Annotations;
}

export type Event = NoteEvent | ChordEvent | RestEvent;

export interface TrackMeasure {
  voices: Record<VoiceId, Event[]>;
}

export interface Measure {
  index: number;
  tracks: Record<string, TrackMeasure>;
}

export interface OpenTabDocument {
  format: "opentab";
  version: "0.1";
  header: Header;
  tracks: Track[];
  measures: Measure[];
}

const SCHEMA_RELATIVE_PATH = path.join("spec", "opentab-ast-schema-v0.1.json");
let cachedValidator: ReturnType<Ajv["compile"]> | null = null;

export function getSchemaPath(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(currentDir, SCHEMA_RELATIVE_PATH);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  throw new Error(
    `Unable to locate ${SCHEMA_RELATIVE_PATH}. Expected to find it relative to the repo root.`
  );
}

export function loadSchema(): unknown {
  const schemaPath = getSchemaPath();
  const raw = fs.readFileSync(schemaPath, "utf8");
  return JSON.parse(raw);
}

export function validateAst(document: unknown): {
  ok: boolean;
  errors?: string[];
} {
  if (!cachedValidator) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    cachedValidator = ajv.compile(loadSchema() as AnySchema);
  }

  const ok = cachedValidator(document) as boolean;
  if (ok) {
    return { ok };
  }

  const errors = cachedValidator.errors?.map((error) => {
    const location = error.instancePath || "(root)";
    return `${location} ${error.message ?? "is invalid"}`.trim();
  });

  return { ok: false, errors };
}
