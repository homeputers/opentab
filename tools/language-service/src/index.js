function validate(text) {
  const diagnostics = [];
  const lines = text.split(/\r?\n/);
  const delimiterIndex = lines.findIndex((line) => line.trim() === '---');

  if (delimiterIndex === -1) {
    diagnostics.push({
      message: 'Missing --- delimiter.',
      line: 0,
      startCol: 0,
      endCol: Math.max(lines[0]?.length ?? 0, 1),
      severity: 'error',
    });
  }

  const headerLines = delimiterIndex >= 0 ? lines.slice(0, delimiterIndex) : [];
  const headerKeys = new Set();
  for (const line of headerLines) {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    if (match) {
      headerKeys.add(match[1]);
    }
  }

  for (const key of ['format', 'version']) {
    if (!headerKeys.has(key)) {
      diagnostics.push({
        message: `Missing required header key: ${key}.`,
        line: 0,
        startCol: 0,
        endCol: Math.max(lines[0]?.length ?? 0, 1),
        severity: 'error',
      });
    }
  }

  const bodyStartIndex = delimiterIndex >= 0 ? delimiterIndex + 1 : 0;
  let sawTrackSelection = false;
  let reportedMissingTrack = false;

  for (let i = bodyStartIndex; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('@track')) {
      sawTrackSelection = true;
    }

    const measurePrefixMatch = trimmed.match(/^m\d+:/);
    if (measurePrefixMatch) {
      if (!sawTrackSelection && !reportedMissingTrack) {
        diagnostics.push({
          message: 'Track selection (@track ...) missing before first measure.',
          line: i,
          startCol: 0,
          endCol: Math.max(line.length, 1),
          severity: 'error',
        });
        reportedMissingTrack = true;
      }

      const measureMatch = line.match(/^m\d+:\s*\|(.*)\|\s*$/);
      if (!measureMatch) {
        diagnostics.push({
          message: "Invalid measure line format. Expected 'mN: | ... |'.",
          line: i,
          startCol: 0,
          endCol: Math.max(line.length, 1),
          severity: 'error',
        });
        continue;
      }

      const content = measureMatch[1];
      if (hasUnbalancedDelimiters(content)) {
        diagnostics.push({
          message: 'Unbalanced brackets/parens/braces in measure line.',
          line: i,
          startCol: 0,
          endCol: Math.max(line.length, 1),
          severity: 'error',
        });
      }

      const tokens =
        content.trim().length === 0 ? [] : content.trim().split(/\s+/);
      let searchStart = line.indexOf('|') + 1;
      for (const token of tokens) {
        const tokenIndex = line.indexOf(token, searchStart);
        const startCol = tokenIndex >= 0 ? tokenIndex : 0;
        const endCol = tokenIndex >= 0 ? tokenIndex + token.length : line.length;
        searchStart = tokenIndex >= 0 ? endCol : searchStart;

        if (token.startsWith('(')) {
          if (!/^\(\d+:\d+[^)]*\)(\{[^}]*\})*$/.test(token)) {
            diagnostics.push({
              message: `Invalid note token: ${token}`,
              line: i,
              startCol,
              endCol,
              severity: 'error',
            });
          }
          continue;
        }

        if (/^[whqest]/.test(token)) {
          if (!/^(w|h|q|e|s|t)(\.|\/\d+)?$/.test(token)) {
            diagnostics.push({
              message: `Invalid duration token: ${token}`,
              line: i,
              startCol,
              endCol,
              severity: 'error',
            });
          }
        }
      }
    }
  }

  return diagnostics;
}

function hasUnbalancedDelimiters(content) {
  const stack = [];
  const pairs = {
    ')': '(',
    ']': '[',
    '}': '{',
  };
  for (const char of content) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      if (stack.length === 0) {
        return true;
      }
      const last = stack.pop();
      if (last !== pairs[char]) {
        return true;
      }
    }
  }
  return stack.length > 0;
}

function format(text) {
  const lines = text.split(/\r?\n/);
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

  return normalizedLines.join('\n');
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

module.exports = {
  validate,
  format,
};
