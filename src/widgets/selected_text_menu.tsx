import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import type { RichTextFormatName, TextSelection } from '@remnote/plugin-sdk';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SOURCE_SESSION_KEY, type SourceSelection } from '../lib/constants';
import { applyFormatToSelection } from '../lib/remnote';
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

  // Cache the selection data the moment the tracker detects it.
  // This avoids re-reading getSelectedText() on button click, when
  // the selection may already be gone.
  const cachedSourceRef = useRef<SourceSelection | undefined>();
  const cachedSelRef = useRef<TextSelection | undefined>();

  const hasSelection = useTrackerPlugin(async (reactivePlugin) => {
    const sel = await reactivePlugin.editor.getSelectedText();
    if (!sel) {
      cachedSourceRef.current = undefined;
      cachedSelRef.current = undefined;
      return false;
    }
    const sourceText = (await reactivePlugin.richText.toString(sel.richText)).trim();
    if (!sourceText) {
      cachedSourceRef.current = undefined;
      cachedSelRef.current = undefined;
      return false;
    }
    cachedSourceRef.current = { sourceText, sourceRemId: sel.remId };
    cachedSelRef.current = sel;
    return true;
  });

  const [speed, setSpeed] = useState<TtsSpeed>(DEFAULT_TTS_SPEED);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    plugin.settings.getSetting<TtsSpeed>(TTS_SPEED_SETTING).then((v) => {
      if (v) setSpeed(v);
    });
  }, []);

  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => {
      if (!isSpeaking()) { setSpeaking(false); clearInterval(timer); }
    }, 300);
    return () => clearInterval(timer);
  }, [speaking]);

  // Formatting: use cached TextSelection to keep range + richText
  const handleFormat = useCallback(async (format: RichTextFormatName) => {
    const sel = cachedSelRef.current;
    if (!sel) return;
    const formatted = await plugin.richText.toggleTextFormatOnRange(
      sel.richText, sel.range.start, sel.range.end, format,
    );
    const rem = await plugin.rem.findOne(sel.remId);
    if (rem) await rem.setText(formatted);
    else await plugin.editor.setText(formatted);
  }, [plugin]);

  const fmt = (format: RichTextFormatName) => () => handleFormat(format);

  // AI cards: use cached source — do NOT call readSelectedSource again
  const handleOpenCards = useCallback(async () => {
    const source = cachedSourceRef.current;
    if (!source) {
      await plugin.app.toast('Selecione um trecho antes de criar cartões.');
      return;
    }
    await plugin.storage.setSession(SOURCE_SESSION_KEY, source);
    await plugin.widget.openPopup('bulk_cards_popup');
  }, [plugin]);

  // TTS: use cached source text
  const handleSpeak = useCallback(async () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    const source = cachedSourceRef.current;
    if (!source) return;
    speak(source.sourceText, speed);
    setSpeaking(true);
  }, [speaking, speed]);

  const handleCycleSpeed = useCallback(async () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    await plugin.storage.setSynced(TTS_SPEED_SETTING, next);
    if (isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
      const source = cachedSourceRef.current;
      if (source) { speak(source.sourceText, next); setSpeaking(true); }
    }
  }, [speed, plugin]);

  return (
    <div className="sel-toolbar-wrap">
      <button className="sel-btn sel-fmt" disabled={!hasSelection} title="Negrito" onClick={fmt('bold')}>
        <b>B</b>
      </button>
      <button className="sel-btn sel-fmt sel-underline-btn" disabled={!hasSelection} title="Sublinhar" onClick={fmt('underline')}>
        <u>U</u>
      </button>

      <div className="sel-divider" />

      <button className="sel-btn sel-color sel-yellow" disabled={!hasSelection} title="Destacar amarelo" onClick={fmt('Yellow')} aria-label="Destacar amarelo" />
      <button className="sel-btn sel-color sel-green"  disabled={!hasSelection} title="Destacar verde"    onClick={fmt('Green')}  aria-label="Destacar verde" />
      <button className="sel-btn sel-color sel-red"    disabled={!hasSelection} title="Destacar vermelho" onClick={fmt('Red')}    aria-label="Destacar vermelho" />

      <div className="sel-divider" />

      <button
        className={`sel-btn sel-fmt sel-tts${speaking ? ' sel-tts-active' : ''}`}
        disabled={!hasSelection && !speaking}
        title={speaking ? 'Parar leitura' : 'Ouvir texto (pt-BR)'}
        onClick={handleSpeak}
      >
        {speaking ? '⏹' : '🔊'}
      </button>
      <button className="sel-btn sel-speed" title="Velocidade da leitura (clique para mudar)" onClick={handleCycleSpeed}>
        {formatSpeed(speed)}
      </button>

      <div className="sel-divider" />

      <button
        className="sel-btn sel-ai-btn bulk-primary"
        disabled={!hasSelection}
        title="Gerar cartões com IA"
        onClick={handleOpenCards}
      >
        ✨ Cartões IA
      </button>
    </div>
  );
}

renderWidget(SelectedTextMenu);
