import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { applyFormatToSelection, openBulkCardsPopup } from '../lib/remnote';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerWidget('selected_text_menu', WidgetLocation.SelectedTextMenu, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabIcon: `${plugin.rootURL}magic.svg`,
    widgetTabTitle: 'Cartões em massa',
  });

  await plugin.app.registerWidget('bulk_cards_popup', WidgetLocation.Popup, {
    dimensions: { height: 680, width: 820 },
  });

  // ── Comando principal: gerar cartões IA ────────────────────────────────
  await plugin.app.registerCommand({
    id: 'ai-bulk-cards-from-selection',
    name: 'IA: criar cartões em massa da seleção',
    description: 'Gera uma prévia editável de flashcards a partir do texto selecionado.',
    keywords: 'IA flashcards cartões seleção massa',
    quickCode: 'cartoes',
    action: () => openBulkCardsPopup(plugin),
  });

  // ── Comandos de formatação (acessíveis via omnibar no mobile/tablet) ───
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
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
