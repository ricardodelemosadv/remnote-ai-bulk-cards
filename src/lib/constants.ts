export const SOURCE_SESSION_KEY = 'bulk-cards-source';
export const LEGACY_API_KEY_LOCAL_KEY = 'openai-api-key';
export const BRIDGE_TOKEN_SYNCED_KEY = 'remnote-ai-bridge-token-v1';
export const BRIDGE_CARDS_ENDPOINT = 'https://remnote-ai-cards.vercel.app/api/cards';
export const DEFAULT_MAX_CARDS = 12;

export type SourceSelection = {
  sourceText: string;
  sourceRemId: string;
};

export type DraftCard = {
  question: string;
  answer: string;
  enabled: boolean;
};
