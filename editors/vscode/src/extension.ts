import * as vscode from 'vscode';
import { format, validate } from './language-service/index.js';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('opentab');

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

  context.subscriptions.push(
    diagnostics,
    saveDisposable,
    closeDisposable,
    formatProvider,
    formatCommand,
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

export function deactivate(): void {}
