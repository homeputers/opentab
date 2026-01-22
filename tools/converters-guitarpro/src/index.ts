import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export const packageName = "@opentab/converters-guitarpro";

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_TIME_SIGNATURE = "4/4";
const DEFAULT_INSTRUMENT = "electric_guitar";

const DURATION_MAP: Record<number, string> = {
  1: "w",
  2: "h",
  4: "q",
  8: "e",
  16: "s",
  32: "t",
};

type GpifEntity = Record<string, unknown>;

type NoteRef = {
  string: number;
  fret: number;
};

type BeatData = {
  duration: string;
  notes: NoteRef[];
  isRest: boolean;
};

type TrackData = {
  id: string;
  name: string;
  instrument: string;
  tuning: string[];
  measures: BeatData[][];
};

const normalizeArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
};

const findKeyInsensitive = (value: GpifEntity | undefined, key: string): unknown => {
  if (!value) {
    return undefined;
  }
  if (key in value) {
    return value[key];
  }
  const lowered = key.toLowerCase();
  for (const [candidateKey, candidateValue] of Object.entries(value)) {
    if (candidateKey.toLowerCase() === lowered) {
      return candidateValue;
    }
  }
  return undefined;
};

const findNestedArray = (
  value: GpifEntity | undefined,
  containerKey: string,
  itemKey: string
): GpifEntity[] => {
  const container = findKeyInsensitive(value, containerKey);
  if (!container || typeof container !== "object") {
    return [];
  }
  const items = findKeyInsensitive(container as GpifEntity, itemKey);
  if (!items || typeof items !== "object") {
    return [];
  }
  return normalizeArray(items as GpifEntity | GpifEntity[]);
};

const toId = (value: GpifEntity | undefined): string | null => {
  if (!value) {
    return null;
  }
  const id = value.id ?? value.ID ?? value.Id ?? value.ref ?? value.Ref;
  if (typeof id === "string" || typeof id === "number") {
    return String(id);
  }
  return null;
};

const mapById = (items: GpifEntity[]): Map<string, GpifEntity> => {
  const map = new Map<string, GpifEntity>();
  items.forEach((item) => {
    const id = toId(item);
    if (id) {
      map.set(id, item);
    }
  });
  return map;
};

const midiToNoteName = (midi: number): string => {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const name = noteNames[((midi % 12) + 12) % 12] ?? "C";
  return `${name}${octave}`;
};

const resolveDuration = (beat: GpifEntity, warnings: string[]): string => {
  const durationNode = findKeyInsensitive(beat, "Duration") as GpifEntity | undefined;
  const value = toNumber(
    (durationNode && (findKeyInsensitive(durationNode, "Value") ?? durationNode.value)) ??
      findKeyInsensitive(beat, "Duration")
  );
  const base = value ? DURATION_MAP[value] : undefined;
  if (!base) {
    warnings.push("Unknown duration encountered; defaulted to quarter notes.");
  }
  const dots = toNumber(
    (durationNode && (findKeyInsensitive(durationNode, "Dots") ?? durationNode.dots)) ??
      findKeyInsensitive(beat, "Dots")
  );
  const tuplet = toNumber(
    (durationNode && (findKeyInsensitive(durationNode, "Tuplet") ?? durationNode.tuplet)) ??
      findKeyInsensitive(beat, "Tuplet")
  );
  const dotSuffix = dots && dots > 0 ? ".".repeat(Math.min(2, dots)) : "";
  const tupletSuffix = tuplet && tuplet > 0 ? `/${tuplet}` : "";
  return `${base ?? "q"}${dotSuffix}${tupletSuffix}`;
};

const resolveNotes = (beat: GpifEntity, noteMap: Map<string, GpifEntity>): GpifEntity[] => {
  const notesContainer = findKeyInsensitive(beat, "Notes") as GpifEntity | undefined;
  const noteRefs = normalizeArray(
    (notesContainer && (findKeyInsensitive(notesContainer, "Note") as GpifEntity | GpifEntity[])) ??
      (findKeyInsensitive(beat, "Note") as GpifEntity | GpifEntity[])
  );
  return noteRefs.map((noteRef) => {
    const refId = toId(noteRef);
    if (refId && noteMap.has(refId)) {
      return noteMap.get(refId) as GpifEntity;
    }
    return noteRef;
  });
};

const noteRefFromEntity = (note: GpifEntity): NoteRef | null => {
  const stringValue = toNumber(findKeyInsensitive(note, "String"));
  const fretValue = toNumber(findKeyInsensitive(note, "Fret"));
  if (!stringValue || fretValue === null) {
    return null;
  }
  return {
    string: stringValue,
    fret: fretValue,
  };
};

const detectEffects = (entity: GpifEntity): boolean => {
  const effects = findKeyInsensitive(entity, "Effects");
  return Boolean(effects);
};

const escapeOtabString = (value: string): string => value.replace(/"/g, "\\\"");

const formatNoteToken = (noteRef: NoteRef): string => `(${noteRef.string}:${noteRef.fret})`;

const formatBeat = (beat: BeatData): string => {
  const duration = beat.duration;
  if (beat.isRest || beat.notes.length === 0) {
    return `${duration} r`;
  }
  if (beat.notes.length === 1) {
    return `${duration} ${formatNoteToken(beat.notes[0])}`;
  }
  const sorted = [...beat.notes].sort((a, b) => b.string - a.string);
  const chordNotes = sorted.map((note) => formatNoteToken(note)).join(" ");
  return `${duration} [ ${chordNotes} ]`;
};

const parseGpif = (gpifXml: string): { tracks: TrackData[]; warnings: string[]; tempo: number; timeSignature: string; title: string } => {
  const warnings: string[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });
  const document = parser.parse(gpifXml) as GpifEntity;
  const root =
    (findKeyInsensitive(document, "GPIF") as GpifEntity | undefined) ??
    (findKeyInsensitive(document, "Score") as GpifEntity | undefined) ??
    document;
  const score =
    (findKeyInsensitive(root, "Score") as GpifEntity | undefined) ??
    (findKeyInsensitive(document, "Score") as GpifEntity | undefined) ??
    root;

  const title =
    (findKeyInsensitive(score, "Title") as string | undefined) ??
    (findKeyInsensitive(score, "Name") as string | undefined) ??
    "Guitar Pro Import";

  const masterTrack = findKeyInsensitive(score, "MasterTrack") as GpifEntity | undefined;
  const tempoValue =
    toNumber(findKeyInsensitive(masterTrack, "Tempo")) ??
    toNumber(findKeyInsensitive(findKeyInsensitive(masterTrack, "Tempo") as GpifEntity, "Value")) ??
    DEFAULT_TEMPO_BPM;

  const masterBarsContainer = findKeyInsensitive(score, "MasterBars") as GpifEntity | undefined;
  const masterBars = normalizeArray(
    (masterBarsContainer && (findKeyInsensitive(masterBarsContainer, "MasterBar") as GpifEntity | GpifEntity[])) ??
      (findKeyInsensitive(score, "MasterBar") as GpifEntity | GpifEntity[])
  );
  let timeSignature = DEFAULT_TIME_SIGNATURE;
  if (masterBars.length > 0) {
    const signatures = masterBars
      .map((bar) => findKeyInsensitive(bar, "TimeSignature") as GpifEntity | undefined)
      .map((ts) => {
        if (!ts) {
          return null;
        }
        const numerator = toNumber(findKeyInsensitive(ts, "Numerator"));
        const denominator = toNumber(findKeyInsensitive(ts, "Denominator"));
        if (!numerator || !denominator) {
          return null;
        }
        return `${numerator}/${denominator}`;
      })
      .filter((value): value is string => Boolean(value));
    if (signatures.length > 0) {
      timeSignature = signatures[0];
    }
    const uniqueSignatures = new Set(signatures);
    if (uniqueSignatures.size > 1) {
      warnings.push("Multiple time signatures detected; only the first is used.");
    }
  }

  const notes = findNestedArray(score, "Notes", "Note");
  const beats = findNestedArray(score, "Beats", "Beat");
  const voices = findNestedArray(score, "Voices", "Voice");
  const bars = findNestedArray(score, "Bars", "Bar");

  const noteMap = mapById(notes);
  const beatMap = mapById(beats);
  const voiceMap = mapById(voices);
  const barMap = mapById(bars);

  const trackEntries = findNestedArray(score, "Tracks", "Track");

  const tracks: TrackData[] = trackEntries.map((trackEntry, index) => {
    const trackId = toId(trackEntry) ?? `gpx${index + 1}`;
    const trackName =
      (findKeyInsensitive(trackEntry, "Name") as string | undefined) ??
      (findKeyInsensitive(trackEntry, "Title") as string | undefined) ??
      `Track ${index + 1}`;
    const instrument =
      (findKeyInsensitive(trackEntry, "Instrument") as string | undefined) ??
      DEFAULT_INSTRUMENT;

    const stringsContainer = findKeyInsensitive(trackEntry, "Strings") as GpifEntity | undefined;
    const strings = normalizeArray(
      (stringsContainer && (findKeyInsensitive(stringsContainer, "String") as GpifEntity | GpifEntity[])) ??
        (findKeyInsensitive(trackEntry, "String") as GpifEntity | GpifEntity[])
    );
    const tuning = strings
      .map((stringEntry) => ({
        number: toNumber(findKeyInsensitive(stringEntry, "Number")) ?? 0,
        tuning: toNumber(findKeyInsensitive(stringEntry, "Tuning")) ?? 0,
      }))
      .sort((a, b) => b.number - a.number)
      .map((entry) => midiToNoteName(entry.tuning))
      .filter((entry) => entry);

    if (tuning.length === 0) {
      warnings.push(`Missing tuning for ${trackName}; defaulting to standard tuning.`);
    }

    const barRefs = (() => {
      const refs = findNestedArray(trackEntry, "Bars", "Bar");
      if (refs.length > 0) {
        return refs;
      }
      return normalizeArray(findKeyInsensitive(trackEntry, "Bar") as GpifEntity | GpifEntity[]);
    })();
    const measures: BeatData[][] = barRefs.map((barRef) => {
      const barId = toId(barRef);
      const bar = barId && barMap.has(barId) ? (barMap.get(barId) as GpifEntity) : barRef;
      const voiceContainer = findKeyInsensitive(bar, "Voices") as GpifEntity | undefined;
      const voiceRefs = normalizeArray(
        (voiceContainer && (findKeyInsensitive(voiceContainer, "Voice") as GpifEntity | GpifEntity[])) ??
          (findKeyInsensitive(bar, "Voice") as GpifEntity | GpifEntity[])
      );
      const firstVoiceRef = voiceRefs[0];
      const voiceId = toId(firstVoiceRef);
      const voice = voiceId && voiceMap.has(voiceId) ? (voiceMap.get(voiceId) as GpifEntity) : firstVoiceRef;

      const beatContainer = findKeyInsensitive(voice, "Beats") as GpifEntity | undefined;
      const beatRefs = normalizeArray(
        (beatContainer && (findKeyInsensitive(beatContainer, "Beat") as GpifEntity | GpifEntity[])) ??
          (findKeyInsensitive(voice, "Beat") as GpifEntity | GpifEntity[])
      );
      return beatRefs.map((beatRef) => {
        const beatId = toId(beatRef);
        const beat = beatId && beatMap.has(beatId) ? (beatMap.get(beatId) as GpifEntity) : beatRef;
        if (detectEffects(beat)) {
          warnings.push(`Effects detected in ${trackName}; effects are ignored.`);
        }
        const duration = resolveDuration(beat, warnings);
        const noteEntities = resolveNotes(beat, noteMap);
        if (noteEntities.some((note) => detectEffects(note))) {
          warnings.push(`Note effects detected in ${trackName}; effects are ignored.`);
        }
        const noteRefs = noteEntities
          .map((note) => noteRefFromEntity(note))
          .filter((noteRef): noteRef is NoteRef => Boolean(noteRef));
        const isRest = Boolean(findKeyInsensitive(beat, "Rest")) || noteRefs.length === 0;
        return {
          duration,
          notes: noteRefs,
          isRest,
        };
      });
    });

    return {
      id: trackId,
      name: trackName,
      instrument,
      tuning: tuning.length > 0 ? tuning : ["E2", "A2", "D3", "G3", "B3", "E4"],
      measures,
    };
  });

  if (tracks.length === 0) {
    warnings.push("No tracks were found in the GPX file.");
  }

  return {
    tracks,
    warnings,
    tempo: tempoValue,
    timeSignature,
    title,
  };
};

const renderWarnings = (warnings: string[]): string[] => {
  const unique = Array.from(new Set(warnings));
  return unique.map((warning) => `# warning: ${warning}`);
};

const renderTrackMeasures = (track: TrackData): string[] => {
  const lines: string[] = [];
  lines.push(`@track ${track.id} voice v1`);
  track.measures.forEach((beats, index) => {
    const tokens = beats.map((beat) => formatBeat(beat)).join(" ");
    lines.push(`m${index + 1}: | ${tokens} |`);
  });
  if (track.measures.length === 0) {
    lines.push("# warning: track contains no measures");
  }
  return lines;
};

export const fromGpx = async (data: Buffer | Uint8Array | ArrayBuffer): Promise<string> => {
  const zip = await JSZip.loadAsync(data);
  const gpifEntry = Object.values(zip.files).find((file) => file.name.toLowerCase().endsWith(".gpif"));
  if (!gpifEntry) {
    throw new Error("No GPIF data found in GPX archive.");
  }
  const gpifXml = await gpifEntry.async("string");
  const { tracks, warnings, tempo, timeSignature, title } = parseGpif(gpifXml);

  const lines: string[] = [];
  lines.push("format=\"opentab\"", "version=\"0.1\"", `title=\"${escapeOtabString(title)}\"`);
  lines.push(`tempo_bpm=${tempo}`, `time_signature=\"${timeSignature}\"`, "");

  const warningLines = renderWarnings(warnings);
  if (warningLines.length > 0) {
    lines.push(...warningLines, "");
  }

  tracks.forEach((track) => {
    lines.push("[[tracks]]");
    lines.push(`id=\"${escapeOtabString(track.id)}\"`);
    lines.push(`name=\"${escapeOtabString(track.name)}\"`);
    lines.push(`instrument=\"${escapeOtabString(track.instrument)}\"`);
    lines.push(`tuning=[${track.tuning.map((note) => `\"${note}\"`).join(",")}]");
    lines.push("");
  });

  lines.push("---");

  tracks.forEach((track) => {
    lines.push(...renderTrackMeasures(track), "");
  });

  return lines.join("\n").trimEnd() + "\n";
};
