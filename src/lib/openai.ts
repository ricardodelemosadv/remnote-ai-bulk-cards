import { DEFAULT_MODEL, type DraftCard } from './constants';
import { normalizeCards, outputTextFromResponse } from './core';

export async function generateCards(
  apiKey: string,
  sourceText: string,
  maxCards: number,
): Promise<DraftCard[]> {
  const endpoint = apiKey
    ? 'https://api.openai.com/v1/responses'
    : 'http://localhost:8080/bridge/openai';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: 2400,
      instructions: [
        'Você cria flashcards jurídicos em português do Brasil.',
        'Use exclusivamente o trecho fornecido; não complete lacunas com conhecimento externo.',
        'Crie cartões atômicos, autossuficientes e úteis para revisão ativa.',
        'Divida enumerações, requisitos, exceções, prazos e competências em cartões separados quando isso melhorar a memorização.',
        'Preserve ressalvas e condições. Não invente artigos, números, precedentes ou fundamentos.',
        'Evite perguntas vagas e respostas excessivamente longas.',
      ].join(' '),
      input: `Converta o trecho abaixo em até ${maxCards} flashcards.\n\nTRECHO:\n${sourceText}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'bulk_flashcards',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              cards: {
                type: 'array',
                minItems: 1,
                maxItems: maxCards,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    question: { type: 'string' },
                    answer: { type: 'string' },
                  },
                  required: ['question', 'answer'],
                },
              },
            },
            required: ['cards'],
          },
        },
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = body?.error?.message;
    if (response.status === 429 && body?.error?.code === 'credit_balance_exhausted') {
      throw new Error('A conta da API está sem créditos. Adicione saldo na plataforma da OpenAI.');
    }
    throw new Error(apiMessage || `Falha na API da OpenAI (HTTP ${response.status}).`);
  }

  const output = outputTextFromResponse(body);
  if (!output) throw new Error('A IA retornou uma resposta vazia.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error('A resposta da IA não veio no formato esperado.');
  }

  const cards = normalizeCards(parsed, maxCards);
  if (!cards.length) throw new Error('A IA não produziu cartões válidos para esse trecho.');
  return cards;
}
