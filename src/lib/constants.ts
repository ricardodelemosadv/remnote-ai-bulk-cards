export const SOURCE_SESSION_KEY = 'bulk-cards-source';
export const API_KEY_LOCAL_KEY = 'openai-api-key';
export const DEFAULT_MODEL = 'gpt-5.4-mini';
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
