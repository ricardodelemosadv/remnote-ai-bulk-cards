import { BRIDGE_CARDS_ENDPOINT, type DraftCard } from './constants';
import { normalizeCards } from './core';

export async function generateCards(
  bridgeToken: string,
  sourceText: string,
  maxCards: number,
): Promise<DraftCard[]> {
  const response = await fetch(BRIDGE_CARDS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bridgeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceText,
      maxCards,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = typeof body?.error === 'string' ? body.error : undefined;
    if (response.status === 401) {
      throw new Error('O código de acesso está inválido ou foi revogado. Configure-o novamente.');
    }
    throw new Error(apiMessage || `Falha no serviço de cartões (HTTP ${response.status}).`);
  }

  const cards = normalizeCards(body, maxCards);
  if (!cards.length) throw new Error('A IA não produziu cartões válidos para esse trecho.');
  return cards;
}
