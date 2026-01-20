const assert = require('assert');
const { format, validate } = require('../src/language-service/index.js');

const sample = [
  'format="opentab"',
  'version="0.1"',
  '---',
  '@track gtr1',
  'm1: | q (6:3) |',
].join('\n');

const formatted = format(sample);
const diagnostics = validate(sample);

assert.ok(typeof formatted === 'string');
assert.ok(Array.isArray(diagnostics));

console.log('smoke tests passed');
