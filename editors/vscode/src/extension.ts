import path from 'node:path';
import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { format, validate } from './language-service/index.js';
import { toAsciiTab } from './opentab-tools/converters-ascii/index.js';
import { fromGpx } from './opentab-tools/converters-guitarpro/index.js';
import { toMusicXml } from './opentab-tools/converters-musicxml/index.js';
import { toMidi } from './opentab-tools/converters-midi/index.js';
import { toSvgTab } from './opentab-tools/converters-svg/index.js';
import { importAsciiTab } from './opentab-tools/importers-ascii/index.js';
import { OpenTabParseError, parseOpenTab } from './opentab-tools/parser/index.js';
import { hasPreviewPanel, showPreview, updatePreview } from './preview/previewPanel';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('opentab');
  let previewUpdateTimeout: NodeJS.Timeout | undefined;
  const previewDebounceMs = 300;

  const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId !== 'opentab') {
      return;
    }
    updateDiagnostics(document, diagnostics);
  });

  const closeDisposable = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnostics.delete(document.uri);
  });

  const formatProvider = vscode.languages.registerDocumentFormattingEditProvider(
    'opentab',
    {
      provideDocumentFormattingEdits(document) {
        const lastLine = Math.max(document.lineCount - 1, 0);
        const lastLineText = document.lineAt(lastLine).text;
        const fullRange = new vscode.Range(0, 0, lastLine, lastLineText.length);
        return [vscode.TextEdit.replace(fullRange, formatText(document))];
      },
    },
  );

  const formatCommand = vscode.commands.registerCommand(
    'opentab.formatDocument',
    () => vscode.commands.executeCommand('editor.action.formatDocument'),
  );

  const previewCommand = vscode.commands.registerCommand(
    'opentab.preview',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'opentab') {
        return;
      }
      showPreview(context, editor.document);
    },
  );

  const exportAsciiCommand = vscode.commands.registerCommand(
    'opentab.exportAscii',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      const parsed = parseActiveDocument(document);
      if (!parsed) {
        return;
      }
      const asciiTab = toAsciiTab(parsed);
      const saveUri = await promptForExportPath(document, 'tab.txt', 'txt');
      if (!saveUri) {
        return;
      }
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(asciiTab, 'utf8'));
      void vscode.window.showInformationMessage('OpenTab: ASCII export saved.');
    },
  );

  const exportMidiCommand = vscode.commands.registerCommand(
    'opentab.exportMidi',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      const parsed = parseActiveDocument(document);
      if (!parsed) {
        return;
      }
      const midiBytes = toMidi(parsed);
      const saveUri = await promptForExportPath(document, 'mid');
      if (!saveUri) {
        return;
      }
      await vscode.workspace.fs.writeFile(saveUri, midiBytes);
      void vscode.window.showInformationMessage('OpenTab: MIDI export saved.');
    },
  );

  const exportMusicXmlCommand = vscode.commands.registerCommand(
    'opentab.exportMusicXml',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      const parsed = parseActiveDocument(document);
      if (!parsed) {
        return;
      }
      const musicXml = toMusicXml(parsed);
      const saveUri = await promptForExportPath(document, 'musicxml');
      if (!saveUri) {
        return;
      }
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(musicXml, 'utf8'));
      void vscode.window.showInformationMessage('OpenTab: MusicXML export saved.');
    },
  );

  const exportPdfCommand = vscode.commands.registerCommand(
    'opentab.exportPdf',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      await exportPdf(document);
    },
  );

  const printPdfCommand = vscode.commands.registerCommand(
    'opentab.printPdf',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      await exportPdf(document);
    },
  );

  const playMidiCommand = vscode.commands.registerCommand(
    'opentab.playMidi',
    async () => {
      const document = getActiveOpenTabDocument();
      if (!document) {
        return;
      }
      const parsed = parseActiveDocument(document);
      if (!parsed) {
        return;
      }

      const midiBytes = toMidi(parsed);
      const storageUri = context.storageUri ?? context.globalStorageUri;
      const tmpUri = vscode.Uri.joinPath(storageUri, 'tmp');
      await vscode.workspace.fs.createDirectory(tmpUri);

      const baseName = getDocumentBaseName(document);
      const fileName = `${baseName}-preview.mid`;
      const midiUri = vscode.Uri.joinPath(tmpUri, fileName);
      await vscode.workspace.fs.writeFile(midiUri, midiBytes);

      const opened = await openMidiExternal(midiUri.fsPath);
      if (!opened) {
        void vscode.window.showWarningMessage(
          `OpenTab: Unable to open MIDI file. Saved at ${midiUri.fsPath}`,
        );
        return;
      }

      void vscode.window.showInformationMessage(
        `Playing MIDI… Saved at ${midiUri.fsPath}`,
      );
    },
  );

  const importGuitarProCommand = vscode.commands.registerCommand(
    'opentab.importGuitarPro',
    async () => {
      const sourceUri = await promptForGuitarProFile();
      if (!sourceUri) {
        return;
      }

      let convertedText = '';
      try {
        const fileBytes = await vscode.workspace.fs.readFile(sourceUri);
        convertedText = await fromGpx(fileBytes);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to import Guitar Pro file.';
        void vscode.window.showErrorMessage(`OpenTab: ${message}`);
        return;
      }

      const targetUri = await getDefaultImportTargetUri(sourceUri);
      if (!targetUri) {
        return;
      }

      await vscode.workspace.fs.writeFile(
        targetUri,
        Buffer.from(convertedText, 'utf8'),
      );
      const document = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(document);
      void vscode.window.showInformationMessage('OpenTab: Guitar Pro import complete.');
    },
  );

  const importAsciiCommand = vscode.commands.registerCommand(
    'opentab.importAscii',
    async () => {
      const sourceUri = await promptForAsciiFile();
      if (!sourceUri) {
        return;
      }

      let converted = '';
      let warnings: string[] = [];
      try {
        const fileBytes = await vscode.workspace.fs.readFile(sourceUri);
        const source = Buffer.from(fileBytes).toString('utf8');
        const result = importAsciiTab(source);
        converted = result.otab;
        warnings = result.warnings;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to import ASCII tab.';
        void vscode.window.showErrorMessage(`OpenTab: ${message}`);
        return;
      }

      const targetUri = await getDefaultImportTargetUri(sourceUri);
      if (!targetUri) {
        return;
      }

      await vscode.workspace.fs.writeFile(
        targetUri,
        Buffer.from(converted, 'utf8'),
      );
      const document = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(document);
      if (warnings.length > 0) {
        void vscode.window.showWarningMessage(
          `OpenTab: ASCII import complete with ${warnings.length} warning(s). ${formatImportWarnings(warnings)}`,
        );
      } else {
        void vscode.window.showInformationMessage('OpenTab: ASCII import complete.');
      }
    },
  );

  const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) {
      return;
    }
    if (event.document.languageId !== 'opentab' || !hasPreviewPanel()) {
      return;
    }
    if (previewUpdateTimeout) {
      clearTimeout(previewUpdateTimeout);
    }
    previewUpdateTimeout = setTimeout(() => {
      updatePreview(event.document.getText());
    }, previewDebounceMs);
  });

  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!editor || editor.document.languageId !== 'opentab') {
        return;
      }
      if (hasPreviewPanel()) {
        showPreview(context, editor.document);
      }
    },
  );

  context.subscriptions.push(
    diagnostics,
    saveDisposable,
    closeDisposable,
    formatProvider,
    formatCommand,
    previewCommand,
    exportAsciiCommand,
    exportMidiCommand,
    exportMusicXmlCommand,
    exportPdfCommand,
    printPdfCommand,
    playMidiCommand,
    importGuitarProCommand,
    importAsciiCommand,
    changeDisposable,
    activeEditorDisposable,
  );
}

function updateDiagnostics(
  document: vscode.TextDocument,
  diagnostics: vscode.DiagnosticCollection,
): void {
  const results = validate(document.getText());
  const vscodeDiagnostics = results.map((result) => {
    const line = Math.max(0, Math.min(result.line, document.lineCount - 1));
    const lineText = document.lineAt(line).text;
    const startCol = Math.max(0, Math.min(result.startCol, lineText.length));
    const endCol = Math.max(startCol, Math.min(result.endCol, lineText.length));
    const range = new vscode.Range(line, startCol, line, endCol);
    const diagnostic = new vscode.Diagnostic(
      range,
      result.message,
      vscode.DiagnosticSeverity.Error,
    );
    return diagnostic;
  });

  diagnostics.set(document.uri, vscodeDiagnostics);
}

function formatText(document: vscode.TextDocument): string {
  const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
  const formatted = format(document.getText());
  if (eol === '\n') {
    return formatted;
  }
  return formatted.replace(/\n/g, eol);
}

function getActiveOpenTabDocument(): vscode.TextDocument | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'opentab') {
    void vscode.window.showWarningMessage('OpenTab: No active .otab document.');
    return null;
  }
  return editor.document;
}

function parseActiveDocument(
  document: vscode.TextDocument,
): ReturnType<typeof parseOpenTab> | null {
  try {
    return parseOpenTab(document.getText());
  } catch (error) {
    if (error instanceof OpenTabParseError) {
      void vscode.window.showErrorMessage(`OpenTab parse error: ${error.message}`);
      return null;
    }
    void vscode.window.showErrorMessage('OpenTab: Failed to parse document.');
    return null;
  }
}

async function exportPdf(document: vscode.TextDocument): Promise<void> {
  const parsed = parseActiveDocument(document);
  if (!parsed) {
    return;
  }
  const { svg, width, height } = toSvgTab(parsed);
  const pdfBytes = await svgToPdfBytes(svg, width, height);
  const saveUri = await promptForExportPath(document, 'pdf');
  if (!saveUri) {
    return;
  }
  await vscode.workspace.fs.writeFile(saveUri, pdfBytes);
  void vscode.window.showInformationMessage('OpenTab: PDF export saved.');
}

function getDocumentBaseName(document: vscode.TextDocument): string {
  const filePath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
  return filePath ? path.parse(filePath).name : 'untitled';
}

async function promptForExportPath(
  document: vscode.TextDocument,
  primaryExtension: string,
  fallbackExtension?: string,
): Promise<vscode.Uri | undefined> {
  const filePath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
  const directory =
    (filePath ? path.dirname(filePath) : undefined) ??
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    '';
  const baseName = filePath ? path.parse(filePath).name : 'untitled';
  const defaultName = `${baseName}.${primaryExtension}`;
  const defaultUri = directory
    ? vscode.Uri.file(path.join(directory, defaultName))
    : vscode.Uri.file(defaultName);

  const filterExtensions = [primaryExtension, fallbackExtension]
    .filter((value): value is string => Boolean(value))
    .map((extension) => extension.split('.').pop() ?? extension);
  const uniqueExtensions = Array.from(new Set(filterExtensions));
  const filters: Record<string, string[]> = {
    [primaryExtension.toUpperCase()]: uniqueExtensions,
  };

  return vscode.window.showSaveDialog({
    defaultUri,
    filters,
  });
}

async function openMidiExternal(filePath: string): Promise<boolean> {
  try {
    const opened = await vscode.env.openExternal(vscode.Uri.file(filePath));
    if (opened) {
      return true;
    }
  } catch (error) {
    void error;
  }

  return openWithSystemApp(filePath);
}

function openWithSystemApp(filePath: string): boolean {
  let command = '';
  let args: string[] = [];

  switch (process.platform) {
    case 'darwin':
      command = 'open';
      args = [filePath];
      break;
    case 'win32':
      command = 'cmd';
      args = ['/c', 'start', '', filePath];
      break;
    default:
      command = 'xdg-open';
      args = [filePath];
      break;
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch (error) {
    void error;
    return false;
  }
}

async function svgToPdfBytes(
  svg: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const doc = new PDFDocument({
    size: [Math.ceil(width), Math.ceil(height)],
    margin: 0,
  });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on('error', (error) => {
      reject(error);
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    SVGtoPDF(doc, svg, 0, 0, { assumePt: true });
    doc.end();
  });
}

async function promptForGuitarProFile(): Promise<vscode.Uri | undefined> {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Import',
    filters: {
      'Guitar Pro (GPX)': ['gpx'],
    },
  };
  const result = await vscode.window.showOpenDialog(options);
  return result?.[0];
}

async function promptForAsciiFile(): Promise<vscode.Uri | undefined> {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Import',
    filters: {
      'ASCII Tab': ['txt', 'tab'],
    },
  };
  const result = await vscode.window.showOpenDialog(options);
  return result?.[0];
}

async function getDefaultImportTargetUri(
  sourceUri: vscode.Uri,
): Promise<vscode.Uri | undefined> {
  const sourcePath = sourceUri.fsPath;
  const baseName = path.parse(sourcePath).name;
  const directory = path.dirname(sourcePath);
  const targetUri = vscode.Uri.file(path.join(directory, `${baseName}.otab`));

  try {
    await vscode.workspace.fs.stat(targetUri);
    const choice = await vscode.window.showWarningMessage(
      `OpenTab: ${path.basename(targetUri.fsPath)} already exists. Overwrite?`,
      'Overwrite',
      'Cancel',
    );
    if (choice !== 'Overwrite') {
      return undefined;
    }
  } catch (error) {
    void error;
  }

  return targetUri;
}

function formatImportWarnings(warnings: string[]): string {
  const previewCount = 3;
  const displayed = warnings.slice(0, previewCount).join(' ');
  if (warnings.length <= previewCount) {
    return displayed;
  }
  return `${displayed} (+${warnings.length - previewCount} more)`;
}

export function deactivate(): void {}
