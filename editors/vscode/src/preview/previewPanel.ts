import path from 'node:path';

import * as vscode from 'vscode';

import { toAsciiTab } from '../opentab-tools/converters-ascii/index';
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
    <pre>${escapeHtml(ascii)}</pre>
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
      { enableScripts: false },
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

export const updatePreview = (documentText: string): void => {
  if (!panel) {
    return;
  }

  const filename = getFilename();

  try {
    const document = parseOpenTab(documentText);
    const ascii = toAsciiTab(document);
    panel.webview.html = renderPreviewPanel(filename, ascii);
  } catch (error) {
    panel.webview.html = renderErrorPanel(filename, error);
  }
};

export const hasPreviewPanel = (): boolean => Boolean(panel);
