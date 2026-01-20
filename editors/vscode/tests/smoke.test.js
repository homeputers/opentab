const assert = require('assert');
const { format, validate } = require('../src/language-service');

const input = ['format="opentab"', 'version="0.1"', '---', '@track gtr1', 'm1: | q (6:3) |'].join('\n');

const diagnostics = validate(input);
assert.ok(Array.isArray(diagnostics));

const formatted = format(input);
assert.ok(formatted.includes('m1: | q (6:3) |'));

console.log('smoke tests passed');
