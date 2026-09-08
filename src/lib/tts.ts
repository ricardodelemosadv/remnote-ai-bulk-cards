export const TTS_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
export type TtsSpeed = (typeof TTS_SPEEDS)[number];
export const TTS_SPEED_SETTING = 'tts-speed';
export const DEFAULT_TTS_SPEED: TtsSpeed = 1;

export function isSpeaking(): boolean {
  return typeof window !== 'undefined' && window.speechSynthesis?.speaking;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined') {
    window.speechSynthesis?.cancel();
  }
}

export function speak(text: string, rate: TtsSpeed = DEFAULT_TTS_SPEED): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = rate;
  // Prefer a pt-BR voice if available; fall back to browser default
  const voices = window.speechSynthesis.getVoices();
  const ptVoice =
    voices.find((v) => v.lang === 'pt-BR') ??
    voices.find((v) => v.lang.startsWith('pt'));
  if (ptVoice) utterance.voice = ptVoice;
  window.speechSynthesis.speak(utterance);
}

export function nextSpeed(current: TtsSpeed): TtsSpeed {
  const idx = TTS_SPEEDS.indexOf(current);
  return TTS_SPEEDS[(idx + 1) % TTS_SPEEDS.length];
}

export function formatSpeed(speed: TtsSpeed): string {
  return `${speed}×`;
}
