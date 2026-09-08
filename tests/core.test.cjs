const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCards, outputTextFromResponse, parseEnvApiKey } = require('../.test-build/core.cjs');

test('extracts quoted and unquoted API keys without returning other variables', () => {
  assert.equal(parseEnvApiKey('OTHER=x\nOPENAI_API_KEY="secret-value"\n'), 'secret-value');
  assert.equal(parseEnvApiKey('OPENAI_API_KEY=plain-value'), 'plain-value');
  assert.equal(parseEnvApiKey('OTHER=x'), undefined);
});

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

test('reads output text from both response shapes', () => {
  assert.equal(outputTextFromResponse({ output_text: '{"cards":[]}' }), '{"cards":[]}');
  assert.equal(
    outputTextFromResponse({ output: [{ content: [{ type: 'output_text', text: 'ok' }] }] }),
    'ok',
  );
});
