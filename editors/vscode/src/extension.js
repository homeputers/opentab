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

function formatText(document) {
  const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
  const lines = document.getText().split(/\r?\n/);
  const formattedLines = [];

  for (const line of lines) {
    formattedLines.push(formatLine(line));
  }

  const normalizedLines = [];
  for (const line of formattedLines) {
    if (line.trim() === '---') {
      while (
        normalizedLines.length > 0 &&
        normalizedLines[normalizedLines.length - 1].trim() === ''
      ) {
        normalizedLines.pop();
      }
      if (normalizedLines.length > 0) {
        normalizedLines.push('');
      }
      normalizedLines.push('---');
      continue;
    }
    normalizedLines.push(line);
  }

  return normalizedLines.join(eol);
}

function formatLine(line) {
  const trimmedEnd = line.replace(/\s+$/, '');
  if (trimmedEnd.trim().startsWith('#')) {
    return trimmedEnd;
  }

  const commentIndex = trimmedEnd.indexOf('#');
  const hasInlineComment = commentIndex > -1;
  const codePart = hasInlineComment
    ? trimmedEnd.slice(0, commentIndex)
    : trimmedEnd;
  const commentPart = hasInlineComment ? trimmedEnd.slice(commentIndex) : '';

  const formattedCode = formatMeasureLine(codePart);
  if (commentPart) {
    const spacer = formattedCode.length > 0 ? ' ' : '';
    return `${formattedCode}${spacer}${commentPart}`.replace(/\s+$/, '');
  }
  return formattedCode;
}

function formatMeasureLine(line) {
  const match = line.match(/^\s*(m\d+)\s*:\s*\|\s*(.*?)\s*\|\s*$/);
  if (!match) {
    return line.replace(/\s+$/, '');
  }

  const tokens = match[2].trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return `${match[1]}: | |`;
  }
  return `${match[1]}: | ${tokens.join(' ')} |`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
