import path from 'node:path';

import * as vscode from 'vscode';

import { toAsciiTab } from '../opentab-tools/converters-ascii/index';
import { toMidi } from '../opentab-tools/converters-midi/index';
import { parseOpenTab } from '../opentab-tools/parser/index';

const PANEL_TITLE = 'OpenTab Preview';

let panel: vscode.WebviewPanel | undefined;
let activeDocument: vscode.TextDocument | undefined;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getErrorDetails = (
  error: unknown,
): { message: string; lineNumber?: string } => {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/line\s+(\d+)/i);
  return { message, lineNumber: match?.[1] };
};

const renderErrorPanel = (filename: string, error: unknown): string => {
  const details = getErrorDetails(error);
  const lineInfo = details.lineNumber
    ? `<p class="error-line">Line: ${escapeHtml(details.lineNumber)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PANEL_TITLE}</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 16px;
      }
      h1 {
        margin: 0 0 8px 0;
        font-size: 20px;
      }
      .filename {
        margin-bottom: 16px;
        color: var(--vscode-descriptionForeground);
      }
      .error {
        border: 1px solid var(--vscode-inputValidation-errorBorder);
        background: var(--vscode-inputValidation-errorBackground);
        padding: 12px;
        border-radius: 6px;
      }
      .error h2 {
        margin: 0 0 8px 0;
        font-size: 16px;
      }
      .error-message {
        margin: 0;
      }
      .error-line {
        margin: 8px 0 0 0;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <h1>${PANEL_TITLE}</h1>
    <div class="filename">${escapeHtml(filename)}</div>
    <div class="error">
      <h2>Preview unavailable</h2>
      <p class="error-message">${escapeHtml(details.message)}</p>
      ${lineInfo}
    </div>
  </body>
</html>`;
};

const renderPreviewPanel = (filename: string, ascii: string): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PANEL_TITLE}</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 16px;
      }
      h1 {
        margin: 0 0 8px 0;
        font-size: 20px;
      }
      .filename {
        margin-bottom: 16px;
        color: var(--vscode-descriptionForeground);
      }
      .player {
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        background: var(--vscode-editor-background);
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .controls button {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
      }
      .controls button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      .controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .progress {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
      }
      .progress input[type='range'] {
        width: 100%;
      }
      .status {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      pre {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editorWidget-border);
        padding: 12px;
        border-radius: 6px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <h1>${PANEL_TITLE}</h1>
    <div class="filename">${escapeHtml(filename)}</div>
    <section class="player">
      <div class="controls">
        <button id="playButton">Play</button>
        <button id="pauseButton" class="secondary" disabled>Pause</button>
        <button id="stopButton" class="secondary" disabled>Stop</button>
        <span id="playState" class="status">Waiting for MIDI…</span>
      </div>
      <div class="progress">
        <input id="progressBar" type="range" min="0" max="100" value="0" />
        <span id="timeLabel" class="status">0:00 / 0:00</span>
      </div>
    </section>
    <pre>${escapeHtml(ascii)}</pre>
    <script>
      const vscode = acquireVsCodeApi();
      const playButton = document.getElementById('playButton');
      const pauseButton = document.getElementById('pauseButton');
      const stopButton = document.getElementById('stopButton');
      const progressBar = document.getElementById('progressBar');
      const timeLabel = document.getElementById('timeLabel');
      const playState = document.getElementById('playState');

      let audioContext = null;
      let sampleBuffer = null;
      let midiNotes = [];
      let midiDurationSeconds = 0;
      let isPlaying = false;
      let isPaused = false;
      let playStartTime = 0;
      let pausedAt = 0;
      let animationFrame = 0;
      let activeSources = [];

      const baseNote = 60;
      const soundFontSample =
        'data:audio/wav;base64,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';

      const decodeBase64 = (value) => {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      };

      const ensureAudioContext = async () => {
        if (!audioContext) {
          audioContext = new AudioContext();
        }
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        if (!sampleBuffer) {
          const response = await fetch(soundFontSample);
          const arrayBuffer = await response.arrayBuffer();
          sampleBuffer = await audioContext.decodeAudioData(arrayBuffer);
        }
      };

      const readUInt32 = (view, offset) =>
        (view.getUint8(offset) << 24) |
        (view.getUint8(offset + 1) << 16) |
        (view.getUint8(offset + 2) << 8) |
        view.getUint8(offset + 3);

      const readUInt16 = (view, offset) =>
        (view.getUint8(offset) << 8) | view.getUint8(offset + 1);

      const readVarInt = (view, offset) => {
        let result = 0;
        let index = offset;
        while (true) {
          const value = view.getUint8(index);
          result = (result << 7) | (value & 0x7f);
          index += 1;
          if ((value & 0x80) === 0) {
            break;
          }
        }
        return { value: result, nextOffset: index };
      };

      const parseMidi = (bytes) => {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let offset = 0;
        const headerId = String.fromCharCode(
          view.getUint8(0),
          view.getUint8(1),
          view.getUint8(2),
          view.getUint8(3),
        );
        if (headerId !== 'MThd') {
          throw new Error('Invalid MIDI header.');
        }
        offset += 4;
        const headerLength = readUInt32(view, offset);
        offset += 4;
        const format = readUInt16(view, offset);
        offset += 2;
        const numTracks = readUInt16(view, offset);
        offset += 2;
        const ticksPerBeat = readUInt16(view, offset);
        offset += 2;
        offset += headerLength - 6;

        const tempoEvents = [];
        const noteEvents = [];

        for (let trackIndex = 0; trackIndex < numTracks; trackIndex += 1) {
          const trackId = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3),
          );
          if (trackId !== 'MTrk') {
            throw new Error('Invalid MIDI track.');
          }
          offset += 4;
          const trackLength = readUInt32(view, offset);
          offset += 4;
          const trackEnd = offset + trackLength;
          let tick = 0;
          let runningStatus = 0;

          while (offset < trackEnd) {
            const delta = readVarInt(view, offset);
            tick += delta.value;
            offset = delta.nextOffset;

            let status = view.getUint8(offset);
            if (status < 0x80) {
              status = runningStatus;
            } else {
              offset += 1;
              runningStatus = status;
            }

            if (status === 0xff) {
              const metaType = view.getUint8(offset);
              offset += 1;
              const lengthInfo = readVarInt(view, offset);
              offset = lengthInfo.nextOffset;
              if (metaType === 0x51 && lengthInfo.value === 3) {
                const microsecondsPerBeat =
                  (view.getUint8(offset) << 16) |
                  (view.getUint8(offset + 1) << 8) |
                  view.getUint8(offset + 2);
                tempoEvents.push({ tick, microsecondsPerBeat });
              }
              offset += lengthInfo.value;
              continue;
            }

            const eventType = status & 0xf0;
            const channel = status & 0x0f;

            if (eventType === 0x80 || eventType === 0x90) {
              const noteNumber = view.getUint8(offset);
              const velocity = view.getUint8(offset + 1);
              offset += 2;
              const isNoteOn = eventType === 0x90 && velocity > 0;
              noteEvents.push({
                tick,
                type: isNoteOn ? 'noteOn' : 'noteOff',
                noteNumber,
                velocity,
                channel,
              });
              continue;
            }

            if (eventType === 0xc0 || eventType === 0xd0) {
              offset += 1;
              continue;
            }

            offset += 2;
          }
        }

        if (!tempoEvents.length) {
          tempoEvents.push({ tick: 0, microsecondsPerBeat: 500000 });
        }

        return { format, ticksPerBeat, tempoEvents, noteEvents };
      };

      const buildTempoMap = (tempoEvents, ticksPerBeat) => {
        const sorted = tempoEvents.slice().sort((a, b) => a.tick - b.tick);
        const segments = [];
        let currentSeconds = 0;
        for (let index = 0; index < sorted.length; index += 1) {
          const current = sorted[index];
          const next = sorted[index + 1];
          const secondsPerTick =
            current.microsecondsPerBeat / 1000000 / ticksPerBeat;
          segments.push({
            startTick: current.tick,
            startSeconds: currentSeconds,
            secondsPerTick,
          });
          if (next) {
            currentSeconds += (next.tick - current.tick) * secondsPerTick;
          }
        }
        return segments;
      };

      const ticksToSeconds = (tick, tempoMap) => {
        const segment = tempoMap
          .slice()
          .reverse()
          .find((entry) => tick >= entry.startTick);
        if (!segment) {
          return 0;
        }
        return (
          segment.startSeconds +
          (tick - segment.startTick) * segment.secondsPerTick
        );
      };

      const buildNotes = (parsed) => {
        const tempoMap = buildTempoMap(parsed.tempoEvents, parsed.ticksPerBeat);
        const notes = [];
        const active = new Map();

        const sortedEvents = parsed.noteEvents.slice().sort((a, b) => a.tick - b.tick);
        for (const event of sortedEvents) {
          const key = \`\${event.channel}-\${event.noteNumber}\`;
          if (event.type === 'noteOn') {
            active.set(key, { startTick: event.tick, velocity: event.velocity });
          } else {
            const start = active.get(key);
            if (start) {
              notes.push({
                noteNumber: event.noteNumber,
                velocity: start.velocity,
                startSeconds: ticksToSeconds(start.startTick, tempoMap),
                endSeconds: ticksToSeconds(event.tick, tempoMap),
              });
              active.delete(key);
            }
          }
        }

        let durationSeconds = 0;
        for (const note of notes) {
          if (note.endSeconds > durationSeconds) {
            durationSeconds = note.endSeconds;
          }
        }
        return { notes, durationSeconds };
      };

      const formatTime = (seconds) => {
        const clamped = Math.max(0, seconds);
        const minutes = Math.floor(clamped / 60);
        const secs = Math.floor(clamped % 60);
        return \`\${minutes}:\${secs.toString().padStart(2, '0')}\`;
      };

      const updateButtons = () => {
        playButton.disabled = !midiNotes.length || isPlaying;
        pauseButton.disabled = !isPlaying;
        stopButton.disabled = !midiNotes.length;
      };

      const stopPlayback = (resetPosition = true) => {
        activeSources.forEach((source) => {
          try {
            source.stop();
          } catch (error) {
            void error;
          }
        });
        activeSources = [];
        isPlaying = false;
        isPaused = !resetPosition;
        if (resetPosition) {
          pausedAt = 0;
        }
        playStartTime = 0;
        cancelAnimationFrame(animationFrame);
        updateProgress(resetPosition ? 0 : pausedAt);
        updateButtons();
        playState.textContent = resetPosition ? 'Stopped' : 'Paused';
      };

      const schedulePlayback = async (offsetSeconds = 0) => {
        await ensureAudioContext();
        activeSources = [];
        const now = audioContext.currentTime;
        playStartTime = now - offsetSeconds;
        isPlaying = true;
        isPaused = false;
        playState.textContent = 'Playing';
        updateButtons();

        for (const note of midiNotes) {
          if (note.endSeconds <= offsetSeconds) {
            continue;
          }
          const start = Math.max(note.startSeconds, offsetSeconds);
          const duration = Math.max(0, note.endSeconds - start);
          if (duration === 0) {
            continue;
          }
          const source = audioContext.createBufferSource();
          source.buffer = sampleBuffer;
          source.playbackRate.value = Math.pow(2, (note.noteNumber - baseNote) / 12);
          const gain = audioContext.createGain();
          gain.gain.value = Math.min(1, note.velocity / 127) * 0.8;
          source.connect(gain).connect(audioContext.destination);
          const startTime = now + (start - offsetSeconds);
          source.start(startTime);
          source.stop(startTime + duration);
          activeSources.push(source);
        }

        tickProgress();
      };

      const currentPlaybackTime = () => {
        if (!isPlaying) {
          return pausedAt;
        }
        return audioContext.currentTime - playStartTime;
      };

      const updateProgress = (time) => {
        const clamped = Math.min(time, midiDurationSeconds || 0);
        const percentage =
          midiDurationSeconds > 0 ? (clamped / midiDurationSeconds) * 100 : 0;
        progressBar.value = percentage.toString();
        timeLabel.textContent = \`\${formatTime(clamped)} / \${formatTime(
          midiDurationSeconds,
        )}\`;
      };

      const tickProgress = () => {
        const time = currentPlaybackTime();
        updateProgress(time);
        if (midiDurationSeconds && time >= midiDurationSeconds) {
          stopPlayback(true);
          return;
        }
        animationFrame = requestAnimationFrame(tickProgress);
      };

      playButton.addEventListener('click', async () => {
        if (!midiNotes.length) {
          return;
        }
        if (isPlaying) {
          return;
        }
        await schedulePlayback(pausedAt);
      });

      pauseButton.addEventListener('click', () => {
        if (!isPlaying) {
          return;
        }
        pausedAt = currentPlaybackTime();
        stopPlayback(false);
      });

      stopButton.addEventListener('click', () => {
        stopPlayback(true);
        updateProgress(0);
      });

      progressBar.addEventListener('input', (event) => {
        if (!midiDurationSeconds) {
          return;
        }
        const value = Number(event.target.value);
        const targetTime = (value / 100) * midiDurationSeconds;
        pausedAt = targetTime;
        updateProgress(targetTime);
        if (isPlaying) {
          stopPlayback(false);
          schedulePlayback(pausedAt);
        }
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message?.type !== 'midiData') {
          return;
        }
        try {
          const bytes = decodeBase64(message.data);
          const parsed = parseMidi(bytes);
          const result = buildNotes(parsed);
          midiNotes = result.notes;
          midiDurationSeconds = result.durationSeconds;
          pausedAt = 0;
          stopPlayback(true);
          updateProgress(0);
          playState.textContent = midiNotes.length
            ? 'Ready to play'
            : 'No MIDI notes';
        } catch (error) {
          console.error(error);
          playState.textContent = 'Failed to load MIDI';
        }
        updateButtons();
      });
    </script>
  </body>
</html>`;

const getFilename = (): string => {
  if (!activeDocument) {
    return 'Untitled';
  }
  return path.basename(activeDocument.fileName);
};

export const showPreview = (
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
): void => {
  activeDocument = document;

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'opentabPreview',
      PANEL_TITLE,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true },
    );

    panel.onDidDispose(
      () => {
        panel = undefined;
        activeDocument = undefined;
      },
      null,
      context.subscriptions,
    );
  } else {
    panel.reveal(vscode.ViewColumn.Beside, true);
  }

  updatePreview(document.getText());
};

const toBase64 = (value: Uint8Array): string =>
  Buffer.from(value).toString('base64');

export const updatePreview = (documentText: string): void => {
  if (!panel) {
    return;
  }

  const filename = getFilename();

  try {
    const document = parseOpenTab(documentText);
    const ascii = toAsciiTab(document);
    const midiBytes = toMidi(document);
    panel.webview.html = renderPreviewPanel(filename, ascii);
    void panel.webview.postMessage({
      type: 'midiData',
      data: toBase64(midiBytes),
    });
  } catch (error) {
    panel.webview.html = renderErrorPanel(filename, error);
  }
};

export const hasPreviewPanel = (): boolean => Boolean(panel);
