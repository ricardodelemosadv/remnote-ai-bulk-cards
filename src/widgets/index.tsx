import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { applyFormatToSelection, openBulkCardsPopup, readSelectedSource } from '../lib/remnote';
import {
  speak,
  stopSpeaking,
  isSpeaking,
  TTS_SPEED_SETTING,
  DEFAULT_TTS_SPEED,
  type TtsSpeed,
} from '../lib/tts';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  // ── Widgets ────────────────────────────────────────────────────────────
  await plugin.app.registerWidget('selected_text_menu', WidgetLocation.SelectedTextMenu, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabIcon: `${plugin.rootURL}magic.svg`,
    widgetTabTitle: 'Cartões em massa',
  });

  await plugin.app.registerWidget('bulk_cards_popup', WidgetLocation.Popup, {
    dimensions: { height: 680, width: 820 },
  });

  // ── Settings ───────────────────────────────────────────────────────────
  await plugin.settings.registerDropdownSetting({
    id: TTS_SPEED_SETTING,
    title: 'Velocidade da leitura em voz alta',
    description: 'Velocidade padrão do TTS em pt-BR.',
    defaultValue: String(DEFAULT_TTS_SPEED),
    options: [
      { key: '0.75', value: '0.75', label: '0.75× (Lenta)' },
      { key: '1',    value: '1',    label: '1× (Normal)' },
      { key: '1.25', value: '1.25', label: '1.25× (Um pouco mais rápida)' },
      { key: '1.5',  value: '1.5',  label: '1.5× (Rápida)' },
      { key: '2',    value: '2',    label: '2× (Muito rápida)' },
    ],
  });

  // ── Comando: gerar cartões IA ──────────────────────────────────────────
  await plugin.app.registerCommand({
    id: 'ai-bulk-cards-from-selection',
    name: 'IA: criar cartões em massa da seleção',
    description: 'Gera uma prévia editável de flashcards a partir do texto selecionado.',
    keywords: 'IA flashcards cartões seleção massa',
    quickCode: 'cartoes',
    action: () => openBulkCardsPopup(plugin),
  });

  // ── Comandos de formatação ─────────────────────────────────────────────
  await plugin.app.registerCommand({
    id: 'format-bold',
    name: 'Formatar: Negrito',
    description: 'Aplica/remove negrito no texto selecionado.',
    keywords: 'negrito bold formato',
    quickCode: 'negrito',
    keyboardShortcut: 'mod+b',
    action: () => applyFormatToSelection(plugin, 'bold'),
  });

  await plugin.app.registerCommand({
    id: 'format-underline',
    name: 'Formatar: Sublinhar',
    description: 'Aplica/remove sublinhado no texto selecionado.',
    keywords: 'sublinhar underline formato',
    quickCode: 'sublinhar',
    keyboardShortcut: 'mod+u',
    action: () => applyFormatToSelection(plugin, 'underline'),
  });

  await plugin.app.registerCommand({
    id: 'highlight-yellow',
    name: 'Destacar: Amarelo',
    description: 'Destaca o texto selecionado em amarelo.',
    keywords: 'destacar amarelo highlight cor',
    quickCode: 'amarelo',
    action: () => applyFormatToSelection(plugin, 'Yellow'),
  });

  await plugin.app.registerCommand({
    id: 'highlight-green',
    name: 'Destacar: Verde',
    description: 'Destaca o texto selecionado em verde.',
    keywords: 'destacar verde highlight cor',
    quickCode: 'verde',
    action: () => applyFormatToSelection(plugin, 'Green'),
  });

  await plugin.app.registerCommand({
    id: 'highlight-red',
    name: 'Destacar: Vermelho',
    description: 'Destaca o texto selecionado em vermelho.',
    keywords: 'destacar vermelho highlight cor',
    quickCode: 'vermelho',
    action: () => applyFormatToSelection(plugin, 'Red'),
  });

  // ── Comandos TTS ───────────────────────────────────────────────────────
  await plugin.app.registerCommand({
    id: 'tts-speak-selection',
    name: 'TTS: Ouvir texto selecionado (pt-BR)',
    description: 'Lê em voz alta o texto selecionado em português do Brasil.',
    keywords: 'ouvir ler voz falar tts áudio',
    quickCode: 'falar',
    action: async () => {
      if (isSpeaking()) { stopSpeaking(); return; }
      const source = await readSelectedSource(plugin);
      if (!source) {
        await plugin.app.toast('Selecione um texto antes de usar o TTS.');
        return;
      }
      const savedSpeed = await plugin.settings.getSetting<string>(TTS_SPEED_SETTING);
      const rate = (parseFloat(savedSpeed ?? '1') || DEFAULT_TTS_SPEED) as TtsSpeed;
      speak(source.sourceText, rate);
    },
  });

  await plugin.app.registerCommand({
    id: 'tts-stop',
    name: 'TTS: Parar leitura',
    description: 'Para a leitura em voz alta.',
    keywords: 'parar leitura voz tts',
    quickCode: 'parar',
    action: () => stopSpeaking(),
  });
}

async function onDeactivate(_: ReactRNPlugin) {
  stopSpeaking();
}

declareIndexPlugin(onActivate, onDeactivate);
