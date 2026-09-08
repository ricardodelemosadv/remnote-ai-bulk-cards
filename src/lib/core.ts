import type { DraftCard } from './constants';

export function parseEnvApiKey(contents: string): string | undefined {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^OPENAI_API_KEY\s*=\s*(.+)$/);
    if (!match) continue;
    const value = match[1].trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    return value || undefined;
  }
  return undefined;
}

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

export function outputTextFromResponse(data: any): string | undefined {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  return undefined;
}
