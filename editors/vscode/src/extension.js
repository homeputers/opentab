const vscode = require('vscode');
const { validateText } = require('./validator');

function activate(context) {
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

  context.subscriptions.push(diagnostics, saveDisposable, closeDisposable);
}

function updateDiagnostics(document, diagnostics) {
  const results = validateText(document.getText());
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

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
