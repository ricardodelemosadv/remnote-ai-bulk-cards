'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '..', 'src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

const sources = sourceFiles(sourceRoot)
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

assert.doesNotMatch(sources, /https:\/\/api\.openai\.com/i);
assert.doesNotMatch(sources, /http:\/\/localhost:\d+\/bridge/i);
assert.doesNotMatch(sources, /placeholder=["']sk-/i);
assert.match(sources, /https:\/\/remnote-ai-cards\.vercel\.app\/api\/cards/i);
assert.match(sources, /Authorization:\s*`Bearer \$\{bridgeToken\}`/);

console.log('client security tests: ok');
