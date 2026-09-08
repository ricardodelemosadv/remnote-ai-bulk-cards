import type { DraftCard } from './constants';

export function normalizeCards(value: unknown, limit: number): DraftCard[] {
  if (!value || typeof value !== 'object') return [];
  const cards = (value as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];

  return cards
    .slice(0, Math.max(1, limit))
    .map((card) => {
      if (!card || typeof card !== 'object') return undefined;
      const question = String((card as { question?: unknown }).question ?? '').trim();
      const answer = String((card as { answer?: unknown }).answer ?? '').trim();
      return question && answer ? { question, answer, enabled: true } : undefined;
    })
    .filter((card): card is DraftCard => Boolean(card));
}
