import type { Event, NoteRef, OpenTabDocument, Track } from "@opentab/ast";

export const packageName = "@opentab/converters-svg";

export type SvgRenderOptions = {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  padding?: number;
  background?: string | null;
};

export type SvgRenderResult = {
  svg: string;
  width: number;
  height: number;
};

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_LINE_HEIGHT_RATIO = 1.4;
const DEFAULT_CHAR_WIDTH_RATIO = 0.6;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

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
    for (const events of Object.values(trackMeasure.voices) as Event[][]) {
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

  const widths = event.chord.map((note: NoteRef) => String(note.fret).length);
  const width = Math.max(...widths, 1);
  return Array.from({ length: stringCount }, (_, lineIndex) => {
    const note = event.chord.find(
      (entry: NoteRef) => entry.string === lineIndex + 1
    );
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

const toAsciiTab = (document: OpenTabDocument): string => {
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

export const toSvgTab = (
  document: OpenTabDocument,
  options: SvgRenderOptions = {},
): SvgRenderResult => {
  const ascii = toAsciiTab(document);
  const lines = ascii.split(/\r?\n/);

  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
  const lineHeight =
    options.lineHeight ?? Math.round(fontSize * DEFAULT_LINE_HEIGHT_RATIO);
  const padding = options.padding ?? fontSize;
  const fontFamily =
    options.fontFamily ??
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  const background = options.background ?? "#ffffff";

  const maxLineLength = lines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  );
  const charWidth = fontSize * DEFAULT_CHAR_WIDTH_RATIO;

  const width = Math.max(1, Math.ceil(padding * 2 + maxLineLength * charWidth));
  const height = Math.max(1, Math.ceil(padding * 2 + lines.length * lineHeight));

  const textElements = lines
    .map((line, index) => {
      const y = padding + index * lineHeight;
      return `<text x="${padding}" y="${y}" xml:space="preserve">${escapeXml(
        line,
      )}</text>`;
    })
    .join("");

  const backgroundRect = background
    ? `<rect width="100%" height="100%" fill="${background}" />`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text {
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      dominant-baseline: hanging;
    }
  </style>
  ${backgroundRect}
  ${textElements}
</svg>`;

  return { svg, width, height };
};
