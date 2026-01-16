const assert = require('assert');
const { validateText } = require('../src/validator');

function findMessage(diagnostics, message) {
  return diagnostics.some((diag) => diag.message.includes(message));
}

function testMissingHeaderAndDelimiter() {
  const text = 'title=\"Example\"\n';
  const diagnostics = validateText(text);
  assert.ok(findMessage(diagnostics, 'Missing --- delimiter'));
  assert.ok(findMessage(diagnostics, 'Missing required header key: format'));
  assert.ok(findMessage(diagnostics, 'Missing required header key: version'));
}

function testTrackSelectionMissing() {
  const text = [
    'format=\"opentab\"',
    'version=\"0.1\"',
    '---',
    'm1: | q (6:3) |',
  ].join('\n');
  const diagnostics = validateText(text);
  assert.ok(
    findMessage(diagnostics, 'Track selection'),
    `Expected track selection diagnostic. Got: ${JSON.stringify(diagnostics)}`,
  );
}

function testMeasureFormatAndDelimiters() {
  const text = [
    'format=\"opentab\"',
    'version=\"0.1\"',
    '---',
    '@track gtr1',
    'm1: q (6:3)',
    'm2: | q (6:3 ] |',
  ].join('\n');
  const diagnostics = validateText(text);
  assert.ok(findMessage(diagnostics, 'Invalid measure line format'));
  assert.ok(findMessage(diagnostics, 'Unbalanced brackets'));
}

function testInvalidTokens() {
  const text = [
    'format=\"opentab\"',
    'version=\"0.1\"',
    '---',
    '@track gtr1',
    'm1: | q.. (6) e/ |',
  ].join('\n');
  const diagnostics = validateText(text);
  assert.ok(findMessage(diagnostics, 'Invalid duration token'));
  assert.ok(findMessage(diagnostics, 'Invalid note token'));
}

testMissingHeaderAndDelimiter();
testTrackSelectionMissing();
testMeasureFormatAndDelimiters();
testInvalidTokens();

console.log('validator tests passed');
