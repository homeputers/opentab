import type { Event, NoteRef, OpenTabDocument, Track } from "@opentab/ast";

export const packageName = "@opentab/converters-ascii";

type RenderedMeasure = {
  lines: string[];
  measureIndex: number;
};

const DEFAULT_STRING_COUNT = 6;

const getTrackStringCount = (track: Track, document: OpenTabDocument): number => {
  if (track.tuning && track.tuning.length > 0) {
    return track.tuning.length;
  }

  let maxString = 0;
  for (const measure of document.measures) {
    const trackMeasure = measure.tracks[track.id];
    if (!trackMeasure) {
      continue;
    }
    for (const events of Object.values(trackMeasure.voices)) {
      for (const event of events) {
        if (event.type === "note") {
          maxString = Math.max(maxString, event.note.string);
        } else if (event.type === "chord") {
          for (const note of event.chord) {
            maxString = Math.max(maxString, note.string);
          }
        }
      }
    }
  }

  return maxString || DEFAULT_STRING_COUNT;
};

const getLineLabels = (track: Track, stringCount: number): string[] => {
  if (track.tuning && track.tuning.length > 0) {
    return [...track.tuning].reverse();
  }

  return Array.from({ length: stringCount }, (_, index) => `S${index + 1}`);
};

const noteToSegment = (note: NoteRef, width: number, lineIndex: number): string =>
  lineIndex === note.string - 1 ? String(note.fret).padEnd(width, "-") : "-".repeat(width);

const renderEventSegments = (event: Event, stringCount: number): string[] => {
  if (event.type === "rest") {
    return Array.from({ length: stringCount }, () => "-");
  }

  if (event.type === "note") {
    const width = String(event.note.fret).length;
    return Array.from({ length: stringCount }, (_, lineIndex) =>
      noteToSegment(event.note, width, lineIndex)
    );
  }

  const widths = event.chord.map((note) => String(note.fret).length);
  const width = Math.max(...widths, 1);
  return Array.from({ length: stringCount }, (_, lineIndex) => {
    const note = event.chord.find((entry) => entry.string === lineIndex + 1);
    if (!note) {
      return "-".repeat(width);
    }
    return String(note.fret).padEnd(width, "-");
  });
};

const renderMeasure = (events: Event[], stringCount: number): string[] => {
  if (events.length === 0) {
    return Array.from({ length: stringCount }, () => "-");
  }

  const segments = Array.from({ length: stringCount }, () => "");

  events.forEach((event, index) => {
    const eventSegments = renderEventSegments(event, stringCount);
    const separator = index === events.length - 1 ? "" : "-";
    for (let lineIndex = 0; lineIndex < stringCount; lineIndex += 1) {
      segments[lineIndex] += `${eventSegments[lineIndex]}${separator}`;
    }
  });

  return segments;
};

const renderTrackMeasures = (track: Track, document: OpenTabDocument): RenderedMeasure[] => {
  const stringCount = getTrackStringCount(track, document);
  const measures: RenderedMeasure[] = [];

  for (const measure of document.measures) {
    const trackMeasure = measure.tracks[track.id];
    const events = trackMeasure?.voices?.v1 ?? [];
    const lines = renderMeasure(events, stringCount);
    measures.push({ lines, measureIndex: measure.index });
  }

  return measures;
};

export const toAsciiTab = (document: OpenTabDocument): string => {
  const output: string[] = [];

  for (const track of document.tracks) {
    const stringCount = getTrackStringCount(track, document);
    const lineLabels = getLineLabels(track, stringCount);

    output.push(`# Track: ${track.name ?? track.id}`);

    const measures = renderTrackMeasures(track, document);

    for (const measure of measures) {
      output.push(`// m${measure.measureIndex}`);

      measure.lines.forEach((line, lineIndex) => {
        const label = lineLabels[lineIndex] ?? `S${lineIndex + 1}`;
        output.push(`${label.padEnd(3, " ")}|${line}|`);
      });
    }
  }

  return output.join("\n");
};
