const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCards } = require('../.test-build/core.cjs');

test('normalizes only complete cards and respects the limit', () => {
  assert.deepEqual(
    normalizeCards(
      {
        cards: [
          { question: ' Q1 ', answer: ' A1 ' },
          { question: '', answer: 'A2' },
          { question: 'Q3', answer: 'A3' },
        ],
      },
      1,
    ),
    [{ question: 'Q1', answer: 'A1', enabled: true }],
  );
});
