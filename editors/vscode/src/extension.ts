import path from 'node:path';
import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import { format, validate } from './language-service/index.js';
import { toAsciiTab } from './opentab-tools/converters-ascii/index.js';
import { toMidi } from './opentab-tools/converters-midi/index.js';
import { OpenTabParseError, parseOpenTab } from './opentab-tools/parser/index.js';
import { hasPreviewPanel, showPreview, updatePreview } from './preview/previewPanel';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('opentab');
  let previewUpdateTimeout: NodeJS.Timeout | undefined;

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
    }, 200);
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
    playMidiCommand,
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

export function deactivate(): void {}
