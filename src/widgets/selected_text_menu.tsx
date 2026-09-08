import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import type { RichTextFormatName } from '@remnote/plugin-sdk';
import { useState, useEffect, useCallback } from 'react';
import { readSelectedSource, openBulkCardsPopup, applyFormatToSelection } from '../lib/remnote';
import {
  speak,
  stopSpeaking,
  isSpeaking,
  nextSpeed,
  formatSpeed,
  DEFAULT_TTS_SPEED,
  TTS_SPEED_SETTING,
  type TtsSpeed,
} from '../lib/tts';
import '../style.css';
import '../index.css';

function SelectedTextMenu() {
  const plugin = usePlugin();

  const hasSelection = useTrackerPlugin(async (reactivePlugin) =>
    Boolean(await readSelectedSource(reactivePlugin)),
  );

  const [speed, setSpeed] = useState<TtsSpeed>(DEFAULT_TTS_SPEED);
  const [speaking, setSpeaking] = useState(false);

  // Load persisted speed from plugin settings
  useEffect(() => {
    plugin.settings.getSetting<TtsSpeed>(TTS_SPEED_SETTING).then((v) => {
      if (v) setSpeed(v);
    });
  }, []);

  // Sync speaking state while speech plays
  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => {
      if (!isSpeaking()) {
        setSpeaking(false);
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [speaking]);

  const fmt = (format: RichTextFormatName) => () => applyFormatToSelection(plugin, format);

  const handleSpeak = useCallback(async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const source = await readSelectedSource(plugin);
    if (!source) return;
    speak(source.sourceText, speed);
    setSpeaking(true);
  }, [speaking, speed, plugin]);

  const handleCycleSpeed = useCallback(async () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    // Persist in settings
    await plugin.storage.setSynced(TTS_SPEED_SETTING, next);
    // If already speaking, restart with new speed
    if (isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
      const source = await readSelectedSource(plugin);
      if (source) {
        speak(source.sourceText, next);
        setSpeaking(true);
      }
    }
  }, [speed, plugin]);

  return (
    <div className="sel-toolbar-wrap">
      {/* Formatting */}
      <button className="sel-btn sel-fmt" disabled={!hasSelection} title="Negrito" onClick={fmt('bold')}>
        <b>B</b>
      </button>
      <button className="sel-btn sel-fmt sel-underline-btn" disabled={!hasSelection} title="Sublinhar" onClick={fmt('underline')}>
        <u>U</u>
      </button>

      <div className="sel-divider" />

      {/* Highlight colours */}
      <button className="sel-btn sel-color sel-yellow" disabled={!hasSelection} title="Destacar amarelo" onClick={fmt('Yellow')} aria-label="Destacar amarelo" />
      <button className="sel-btn sel-color sel-green"  disabled={!hasSelection} title="Destacar verde"    onClick={fmt('Green')}  aria-label="Destacar verde" />
      <button className="sel-btn sel-color sel-red"    disabled={!hasSelection} title="Destacar vermelho" onClick={fmt('Red')}    aria-label="Destacar vermelho" />

      <div className="sel-divider" />

      {/* TTS */}
      <button
        className={`sel-btn sel-fmt sel-tts${speaking ? ' sel-tts-active' : ''}`}
        disabled={!hasSelection && !speaking}
        title={speaking ? 'Parar leitura' : 'Ouvir texto (pt-BR)'}
        onClick={handleSpeak}
      >
        {speaking ? '⏹' : '🔊'}
      </button>
      <button
        className="sel-btn sel-speed"
        title="Velocidade da leitura (clique para mudar)"
        onClick={handleCycleSpeed}
      >
        {formatSpeed(speed)}
      </button>

      <div className="sel-divider" />

      {/* AI cards */}
      <button
        className="sel-btn sel-ai-btn bulk-primary"
        disabled={!hasSelection}
        title="Gerar cartões com IA"
        onClick={() => openBulkCardsPopup(plugin)}
      >
        ✨ Cartões IA
      </button>
    </div>
  );
}

renderWidget(SelectedTextMenu);
