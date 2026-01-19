export const packageName = "@opentab/formatter";

const HEADER_DELIMITER = "---";

interface Duration {
  base: "w" | "h" | "q" | "e" | "s" | "t";
  dots?: number;
  tuplet?: number;
}

function parseDuration(token: string): Duration | null {
  const match = token.match(/^([whqest])(\.)?(?:\/(\d+))?$/);
  if (!match) {
    return null;
  }
  const [, base, dot, tuplet] = match;
  const duration: Duration = { base: base as Duration["base"] };
  if (dot) {
    duration.dots = 1;
  }
  if (tuplet) {
    duration.tuplet = Number(tuplet);
  }
  return duration;
}

function formatDuration(duration: Duration): string {
  const dot = duration.dots ? "." : "";
  const tuplet = duration.tuplet ? `/${duration.tuplet}` : "";
  return `${duration.base}${dot}${tuplet}`;
}

function splitTokens(content: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === "[" || char === "(" || char === "{") {
      depth += 1;
    } else if (char === "]" || char === ")" || char === "}") {
      depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens.filter((token) => token.length > 0);
}

function normalizeMeasureTokens(content: string): string {
  const tokens = splitTokens(content.trim());
  if (tokens.length === 0) {
    return "";
  }

  const output: string[] = [];
  let currentDuration: Duration | null = null;

  for (const token of tokens) {
    const duration = parseDuration(token);
    if (duration) {
      currentDuration = duration;
      continue;
    }

    if (currentDuration) {
      output.push(formatDuration(currentDuration), token);
    } else {
      output.push(token);
    }
  }

  return output.join(" ");
}

function formatMeasureLine(line: string): string | null {
  const match = line.match(/^\s*m(\d+):\s*\|\s*(.*?)\s*\|\s*$/);
  if (!match) {
    return null;
  }
  const [, index, content] = match;
  const normalized = normalizeMeasureTokens(content ?? "");
  const tokens = normalized ? ` ${normalized} ` : " ";
  return `m${index}: |${tokens}|`;
}

function splitInlineComment(line: string): { content: string; comment: string | null } {
  const commentIndex = line.indexOf("#");
  if (commentIndex === -1) {
    return { content: line, comment: null };
  }
  return {
    content: line.slice(0, commentIndex),
    comment: line.slice(commentIndex),
  };
}

function trimTrailingBlankLines(lines: string[]): string[] {
  let endIndex = lines.length;
  while (endIndex > 0 && lines[endIndex - 1].trim() === "") {
    endIndex -= 1;
  }
  return lines.slice(0, endIndex);
}

function trimLeadingBlankLines(lines: string[]): string[] {
  let startIndex = 0;
  while (startIndex < lines.length && lines[startIndex].trim() === "") {
    startIndex += 1;
  }
  return lines.slice(startIndex);
}

function formatBodyLine(line: string): string {
  const trimmedLine = line.trimEnd();
  if (trimmedLine.trim().startsWith("#")) {
    return trimmedLine;
  }

  const { content, comment } = splitInlineComment(trimmedLine);
  const formattedMeasure = formatMeasureLine(content);
  if (!formattedMeasure) {
    return trimmedLine;
  }

  if (!comment) {
    return formattedMeasure;
  }

  return `${formattedMeasure} ${comment.trimEnd()}`;
}

export function formatOtab(input: string): string {
  const lines = input.split(/\r?\n/);
  const delimiterIndex = lines.findIndex(
    (line) => line.trim() === HEADER_DELIMITER
  );

  if (delimiterIndex === -1) {
    return lines.map((line) => line.trimEnd()).join("\n");
  }

  const headerLines = trimTrailingBlankLines(
    lines.slice(0, delimiterIndex).map((line) => line.trimEnd())
  );
  const bodyLines = trimLeadingBlankLines(lines.slice(delimiterIndex + 1));

  const formattedBody = bodyLines.map((line) => formatBodyLine(line));

  return [
    ...headerLines,
    "",
    HEADER_DELIMITER,
    "",
    ...formattedBody,
  ]
    .map((line) => line.trimEnd())
    .join("\n");
}
