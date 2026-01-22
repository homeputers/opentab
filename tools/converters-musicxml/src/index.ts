import type { Duration, Event, NoteRef, OpenTabDocument, Track } from "@opentab/ast";

export const packageName = "@opentab/converters-musicxml";

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 } as const;
const DEFAULT_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];
const DEFAULT_DIVISIONS = 480;

type PitchParts = {
  step: string;
  alter?: number;
  octave: number;
};

type RenderNote = {
  xml: string[];
  duration: number;
};

const NOTE_TYPE_MAP: Record<Duration["base"], string> = {
  w: "whole",
  h: "half",
  q: "quarter",
  e: "eighth",
  s: "16th",
  t: "32nd",
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const durationToDivisions = (duration: Duration, divisions = DEFAULT_DIVISIONS): number => {
  const baseDivisions: Record<Duration["base"], number> = {
    w: divisions * 4,
    h: divisions * 2,
    q: divisions,
    e: divisions / 2,
    s: divisions / 4,
    t: divisions / 8,
  };

  let value = baseDivisions[duration.base];
  const dots = duration.dots ?? 0;
  let dotFactor = 1;
  let current = 1;
  for (let i = 0; i < dots; i += 1) {
    current *= 0.5;
    dotFactor += current;
  }
  value *= dotFactor;

  if (duration.tuplet) {
    value *= 2 / duration.tuplet;
  }

  return Math.max(1, Math.round(value));
};

const parsePitch = (note: string): number | null => {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) {
    return null;
  }
  const [, letterRaw, accidental, octaveRaw] = match;
  const letter = letterRaw.toUpperCase();
  const octave = Number(octaveRaw);
  const baseMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const base = baseMap[letter];
  if (base === undefined || Number.isNaN(octave)) {
    return null;
  }
  const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const midi = (octave + 1) * 12 + base + accidentalOffset;
  if (midi < 0 || midi > 127) {
    return null;
  }
  return midi;
};

const midiToPitchParts = (midi: number): PitchParts => {
  const semitone = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const mapping: Record<number, PitchParts> = {
    0: { step: "C", octave },
    1: { step: "C", alter: 1, octave },
    2: { step: "D", octave },
    3: { step: "D", alter: 1, octave },
    4: { step: "E", octave },
    5: { step: "F", octave },
    6: { step: "F", alter: 1, octave },
    7: { step: "G", octave },
    8: { step: "G", alter: 1, octave },
    9: { step: "A", octave },
    10: { step: "A", alter: 1, octave },
    11: { step: "B", octave },
  };

  return mapping[semitone] ?? { step: "C", octave };
};

const resolveStringPitch = (track: Track, noteRef: NoteRef): PitchParts | null => {
  const tuning = track.tuning ?? DEFAULT_TUNING;
  const tuningIndex = noteRef.string - 1;
  if (tuningIndex < 0 || tuningIndex >= tuning.length) {
    return null;
  }
  const basePitch = parsePitch(tuning[tuningIndex]);
  if (basePitch === null) {
    return null;
  }
  const capo = track.capo ?? 0;
  const pitch = basePitch + noteRef.fret + capo;
  if (pitch < 0 || pitch > 127) {
    return null;
  }
  return midiToPitchParts(pitch);
};

const buildPitchXml = (parts: PitchParts): string[] => {
  const pitchXml: string[] = ["<pitch>", `  <step>${parts.step}</step>`];
  if (parts.alter) {
    pitchXml.push(`  <alter>${parts.alter}</alter>`);
  }
  pitchXml.push(`  <octave>${parts.octave}</octave>`, "</pitch>");
  return pitchXml;
};

const buildTechnicalXml = (noteRef: NoteRef): string[] => [
  "<notations>",
  "  <technical>",
  `    <string>${noteRef.string}</string>`,
  `    <fret>${noteRef.fret}</fret>`,
  "  </technical>",
  "</notations>",
];

const buildDurationXml = (duration: Duration, divisions: number): string[] => {
  const output: string[] = [];
  const durationValue = durationToDivisions(duration, divisions);
  output.push(`<duration>${durationValue}</duration>`);
  const type = NOTE_TYPE_MAP[duration.base];
  if (type) {
    output.push(`<type>${type}</type>`);
  }
  const dots = duration.dots ?? 0;
  for (let i = 0; i < dots; i += 1) {
    output.push("<dot/>");
  }
  if (duration.tuplet) {
    output.push(
      "<time-modification>",
      `  <actual-notes>${duration.tuplet}</actual-notes>`,
      "  <normal-notes>2</normal-notes>",
      "</time-modification>"
    );
  }

  return output;
};

const renderNote = (
  track: Track,
  noteRef: NoteRef,
  duration: Duration,
  divisions: number,
  voiceNumber: number,
  isChord: boolean
): RenderNote => {
  const pitch = resolveStringPitch(track, noteRef);
  if (!pitch) {
    if (isChord) {
      return { xml: [], duration: 0 };
    }
    return renderRest(duration, divisions, voiceNumber);
  }
  const output: string[] = ["<note>"];
  if (isChord) {
    output.push("  <chord/>");
  }

  buildPitchXml(pitch).forEach((line) => output.push(`  ${line}`));

  buildDurationXml(duration, divisions).forEach((line) => output.push(`  ${line}`));
  output.push(`  <voice>${voiceNumber}</voice>`, "  <staff>1</staff>");

  buildTechnicalXml(noteRef).forEach((line) => output.push(`  ${line}`));

  output.push("</note>");

  return { xml: output, duration: durationToDivisions(duration, divisions) };
};

const renderRest = (
  duration: Duration,
  divisions: number,
  voiceNumber: number
): RenderNote => {
  const output: string[] = ["<note>"];
  output.push("  <rest/>");
  buildDurationXml(duration, divisions).forEach((line) => output.push(`  ${line}`));
  output.push(`  <voice>${voiceNumber}</voice>`, "  <staff>1</staff>", "</note>");
  return { xml: output, duration: durationToDivisions(duration, divisions) };
};

const renderEvent = (
  track: Track,
  event: Event,
  divisions: number,
  voiceNumber: number
): RenderNote[] => {
  if (event.type === "rest") {
    return [renderRest(event.duration, divisions, voiceNumber)];
  }
  if (event.type === "note") {
    return [renderNote(track, event.note, event.duration, divisions, voiceNumber, false)];
  }

  return event.chord.map((noteRef, index) =>
    renderNote(track, noteRef, event.duration, divisions, voiceNumber, index > 0)
  );
};

const resolveMeasureDuration = (
  measureEvents: Record<string, Event[]>,
  divisions: number,
  timeSignature: { numerator: number; denominator: number }
): number => {
  const expected =
    divisions * timeSignature.numerator * (4 / timeSignature.denominator);
  let maxDuration = expected;
  for (const events of Object.values(measureEvents)) {
    const voiceDuration = events.reduce(
      (sum, event) => sum + durationToDivisions(event.duration, divisions),
      0
    );
    if (voiceDuration > maxDuration) {
      maxDuration = voiceDuration;
    }
  }
  return Math.round(maxDuration);
};

const renderVoiceEvents = (
  track: Track,
  events: Event[],
  divisions: number,
  voiceNumber: number
): { xml: string[]; duration: number } => {
  const output: string[] = [];
  let cursor = 0;
  for (const event of events) {
    const rendered = renderEvent(track, event, divisions, voiceNumber);
    rendered.forEach((note) => output.push(...note.xml.map((line) => `  ${line}`)));
    cursor += durationToDivisions(event.duration, divisions);
  }

  return { xml: output, duration: cursor };
};

const parseTuningStep = (note: string): PitchParts | null => {
  const midi = parsePitch(note);
  if (midi === null) {
    return null;
  }
  return midiToPitchParts(midi);
};

const buildStaffTuning = (track: Track, stringCount: number): string[] => {
  const tuning = track.tuning ?? DEFAULT_TUNING;
  const output: string[] = [];
  for (let i = 0; i < stringCount; i += 1) {
    const pitch = parseTuningStep(tuning[i] ?? "");
    if (!pitch) {
      continue;
    }
    output.push(
      `  <staff-tuning line="${i + 1}">`,
      `    <tuning-step>${pitch.step}</tuning-step>`,
      pitch.alter ? `    <tuning-alter>${pitch.alter}</tuning-alter>` : null,
      `    <tuning-octave>${pitch.octave}</tuning-octave>`,
      "  </staff-tuning>"
    );
  }
  return output.filter((line): line is string => Boolean(line));
};

const buildAttributes = (
  track: Track,
  divisions: number,
  timeSignature: { numerator: number; denominator: number }
): string[] => {
  const stringCount = track.tuning?.length ?? DEFAULT_TUNING.length;
  const output: string[] = ["<attributes>", `  <divisions>${divisions}</divisions>`];
  output.push(
    "  <key>",
    "    <fifths>0</fifths>",
    "  </key>",
    "  <time>",
    `    <beats>${timeSignature.numerator}</beats>`,
    `    <beat-type>${timeSignature.denominator}</beat-type>`,
    "  </time>",
    "  <clef>",
    "    <sign>TAB</sign>",
    "    <line>5</line>",
    "  </clef>",
    "  <staff-details>",
    `    <staff-lines>${stringCount}</staff-lines>`
  );

  buildStaffTuning(track, stringCount).forEach((line) => output.push(`  ${line}`));
  output.push("  </staff-details>", "</attributes>");
  return output;
};

const buildTempoDirection = (tempo: number): string[] => [
  "<direction placement=\"above\">",
  "  <direction-type>",
  "    <metronome>",
  "      <beat-unit>quarter</beat-unit>",
  `      <per-minute>${tempo}</per-minute>`,
  "    </metronome>",
  "  </direction-type>",
  `  <sound tempo=\"${tempo}\"/>`,
  "</direction>",
];

const renderPartMeasures = (document: OpenTabDocument, track: Track): string[] => {
  const output: string[] = [];
  const divisions = DEFAULT_DIVISIONS;
  const timeSignature = document.header.time_signature ?? DEFAULT_TIME_SIGNATURE;
  const tempo = document.header.tempo_bpm ?? DEFAULT_TEMPO_BPM;

  document.measures.forEach((measure, index) => {
    const measureNumber = measure.index ?? index + 1;
    output.push(`<measure number=\"${measureNumber}\">`);

    if (index === 0) {
      buildAttributes(track, divisions, timeSignature).forEach((line) =>
        output.push(`  ${line}`)
      );
      buildTempoDirection(tempo).forEach((line) => output.push(`  ${line}`));
    }

    const trackMeasure = measure.tracks[track.id];
    const voices = trackMeasure?.voices ?? {};
    const voiceIds = Object.keys(voices).sort();
    const measureDuration = resolveMeasureDuration(voices, divisions, timeSignature);

    if (voiceIds.length === 0) {
      output.push("  <note>");
      output.push("    <rest/>");
      output.push(`    <duration>${measureDuration}</duration>`);
      output.push("    <voice>1</voice>");
      output.push("    <staff>1</staff>");
      output.push("  </note>");
    } else {
      voiceIds.forEach((voiceId, voiceIndex) => {
        const voiceNumber = voiceIndex + 1;
        const events = voices[voiceId] ?? [];
        const rendered = renderVoiceEvents(track, events, divisions, voiceNumber);
        output.push(...rendered.xml);
        if (rendered.duration < measureDuration) {
          output.push("  <note>");
          output.push("    <rest/>");
          output.push(`    <duration>${measureDuration - rendered.duration}</duration>`);
          output.push(`    <voice>${voiceNumber}</voice>`);
          output.push("    <staff>1</staff>");
          output.push("  </note>");
        }

        if (voiceIndex < voiceIds.length - 1) {
          output.push("  <backup>");
          output.push(`    <duration>${measureDuration}</duration>`);
          output.push("  </backup>");
        }
      });
    }

    output.push("</measure>");
  });

  return output;
};

export const toMusicXml = (document: OpenTabDocument): string => {
  const output: string[] = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<score-partwise version=\"3.1\">",
  ];

  if (document.header.title) {
    output.push("  <work>");
    output.push(`    <work-title>${escapeXml(document.header.title)}</work-title>`);
    output.push("  </work>");
  }

  const creators: string[] = [];
  if (document.header.composer) {
    creators.push(`    <creator type=\"composer\">${escapeXml(document.header.composer)}</creator>`);
  }
  if (document.header.artist) {
    creators.push(`    <creator type=\"lyricist\">${escapeXml(document.header.artist)}</creator>`);
  }
  if (creators.length > 0) {
    output.push("  <identification>");
    output.push(...creators);
    output.push("  </identification>");
  }

  output.push("  <part-list>");
  document.tracks.forEach((track, index) => {
    const partId = `P${index + 1}`;
    const partName = escapeXml(track.name ?? track.id ?? `Track ${index + 1}`);
    output.push(`    <score-part id=\"${partId}\">`);
    output.push(`      <part-name>${partName}</part-name>`);
    output.push("    </score-part>");
  });
  output.push("  </part-list>");

  document.tracks.forEach((track, index) => {
    const partId = `P${index + 1}`;
    output.push(`  <part id=\"${partId}\">`);
    renderPartMeasures(document, track).forEach((line) => output.push(`    ${line}`));
    output.push("  </part>");
  });

  output.push("</score-partwise>");

  return output.join("\n");
};
