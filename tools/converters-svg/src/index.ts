import type { OpenTabDocument } from "@opentab/ast";
import { toAsciiTab } from "@opentab/converters-ascii";

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
