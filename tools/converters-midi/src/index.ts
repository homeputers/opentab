import type { Duration, NoteRef, OpenTabDocument, Track } from "@opentab/ast";
import { type MidiData, writeMidi } from "midi-file";

export const packageName = "@opentab/converters-midi";

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 } as const;
const DEFAULT_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];
const PPQ = 480;
const DEFAULT_VELOCITY = 64;

interface MidiNoteEvent {
  tick: number;
  type: "noteOn" | "noteOff";
  noteNumber: number;
  channel: number;
  velocity: number;
}

interface MidiMetaEvent {
  tick: number;
  type: "tempo" | "timeSignature";
}

type MidiEvent = MidiNoteEvent | MidiMetaEvent;

type MidiTrackEvent =
  | {
      deltaTime: number;
      type: "meta";
      subtype: "setTempo";
      microsecondsPerBeat: number;
    }
  | {
      deltaTime: number;
      type: "meta";
      subtype: "timeSignature";
      numerator: number;
      denominator: number;
      metronome: number;
      thirtyseconds: number;
    }
  | {
      deltaTime: number;
      type: "channel";
      subtype: "noteOn" | "noteOff";
      channel: number;
      noteNumber: number;
      velocity: number;
    }
  | {
      deltaTime: number;
      type: "meta";
      subtype: "endOfTrack";
    };

interface MidiFileData {
  header: {
    format: 0 | 1 | 2;
    numTracks: number;
    ticksPerBeat: number;
  };
  tracks: MidiTrackEvent[][];
}

function durationToTicks(duration: Duration, ppq = PPQ): number {
  const baseTicks: Record<Duration["base"], number> = {
    w: ppq * 4,
    h: ppq * 2,
    q: ppq,
    e: ppq / 2,
    s: ppq / 4,
    t: ppq / 8,
  };

  let ticks = baseTicks[duration.base];
  const dots = duration.dots ?? 0;
  let dotFactor = 1;
  let current = 1;
  for (let i = 0; i < dots; i += 1) {
    current *= 0.5;
    dotFactor += current;
  }
  ticks *= dotFactor;

  if (duration.tuplet) {
    ticks *= 2 / duration.tuplet;
  }

  return Math.max(1, Math.round(ticks));
}

function parsePitch(note: string): number | null {
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
}

function resolveStringPitch(track: Track, noteRef: NoteRef): number | null {
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
  return pitch;
}

function collectNotes(
  document: OpenTabDocument,
  track: Track,
  channel: number
): MidiEvent[] {
  const events: MidiEvent[] = [];
  const timeSignature = document.header.time_signature ?? DEFAULT_TIME_SIGNATURE;
  const beatsPerMeasure =
    timeSignature.numerator * (4 / timeSignature.denominator);
  const expectedMeasureTicks = PPQ * beatsPerMeasure;

  let measureStart = 0;
  for (const measure of document.measures) {
    const trackMeasure = measure.tracks[track.id];
    if (!trackMeasure) {
      measureStart += expectedMeasureTicks;
      continue;
    }

    let maxVoiceEnd = measureStart;
    for (const voiceEvents of Object.values(trackMeasure.voices)) {
      let cursor = measureStart;
      for (const event of voiceEvents) {
        const durationTicks = durationToTicks(event.duration);
        if (event.type === "rest") {
          cursor += durationTicks;
          continue;
        }

        if (event.type === "note") {
          const pitch = resolveStringPitch(track, event.note);
          if (pitch !== null) {
            events.push({
              tick: cursor,
              type: "noteOn",
              noteNumber: pitch,
              channel,
              velocity: DEFAULT_VELOCITY,
            });
            events.push({
              tick: cursor + durationTicks,
              type: "noteOff",
              noteNumber: pitch,
              channel,
              velocity: DEFAULT_VELOCITY,
            });
          }
          cursor += durationTicks;
          continue;
        }

        if (event.type === "chord") {
          for (const noteRef of event.chord) {
            const pitch = resolveStringPitch(track, noteRef);
            if (pitch !== null) {
              events.push({
                tick: cursor,
                type: "noteOn",
                noteNumber: pitch,
                channel,
                velocity: DEFAULT_VELOCITY,
              });
              events.push({
                tick: cursor + durationTicks,
                type: "noteOff",
                noteNumber: pitch,
                channel,
                velocity: DEFAULT_VELOCITY,
              });
            }
          }
          cursor += durationTicks;
        }
      }
      if (cursor > maxVoiceEnd) {
        maxVoiceEnd = cursor;
      }
    }

    const measureLength = Math.max(expectedMeasureTicks, maxVoiceEnd - measureStart);
    measureStart += measureLength;
  }

  return events;
}

function buildTrackEvents(
  document: OpenTabDocument,
  track: Track,
  channel: number
): MidiTrackEvent[] {
  const tempo = document.header.tempo_bpm ?? DEFAULT_TEMPO_BPM;
  const timeSignature = document.header.time_signature ?? DEFAULT_TIME_SIGNATURE;
  const metaEvents: MidiEvent[] = [
    { tick: 0, type: "tempo" },
    { tick: 0, type: "timeSignature" },
  ];

  const noteEvents = collectNotes(document, track, channel);
  const combined = [...metaEvents, ...noteEvents];
  const sortWeight = (event: MidiEvent) => {
    if (event.type === "tempo" || event.type === "timeSignature") {
      return 0;
    }
    return event.type === "noteOff" ? 1 : 2;
  };

  combined.sort((a, b) => {
    if (a.tick !== b.tick) {
      return a.tick - b.tick;
    }
    return sortWeight(a) - sortWeight(b);
  });

  let lastTick = 0;
  const trackEvents: MidiTrackEvent[] = [];

  for (const event of combined) {
    const deltaTime = event.tick - lastTick;
    lastTick = event.tick;
    if (event.type === "tempo") {
      trackEvents.push({
        deltaTime,
        type: "meta",
        subtype: "setTempo",
        microsecondsPerBeat: Math.round(60_000_000 / tempo),
      });
      continue;
    }
    if (event.type === "timeSignature") {
      trackEvents.push({
        deltaTime,
        type: "meta",
        subtype: "timeSignature",
        numerator: timeSignature.numerator,
        denominator: timeSignature.denominator,
        metronome: 24,
        thirtyseconds: 8,
      });
      continue;
    }
    if (event.type === "noteOn") {
      trackEvents.push({
        deltaTime,
        type: "channel",
        subtype: "noteOn",
        channel: event.channel,
        noteNumber: event.noteNumber,
        velocity: event.velocity,
      });
      continue;
    }
    if (event.type === "noteOff") {
      trackEvents.push({
        deltaTime,
        type: "channel",
        subtype: "noteOff",
        channel: event.channel,
        noteNumber: event.noteNumber,
        velocity: event.velocity,
      });
    }
  }

  trackEvents.push({
    deltaTime: 0,
    type: "meta",
    subtype: "endOfTrack",
  });

  return trackEvents;
}

export function toMidi(document: OpenTabDocument): Uint8Array {
  const tracks = document.tracks.map((track, index) =>
    buildTrackEvents(document, track, index % 16)
  );

  const format: MidiFileData["header"]["format"] =
    tracks.length > 1 ? 1 : 0;
  const midiData: MidiFileData = {
    header: {
      format,
      numTracks: tracks.length,
      ticksPerBeat: PPQ,
    },
    tracks,
  };

  return Uint8Array.from(writeMidi(midiData as unknown as MidiData));
}
