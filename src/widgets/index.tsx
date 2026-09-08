import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
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

  await plugin.app.registerCommand({
    id: 'ai-bulk-cards-from-selection',
    name: 'IA: criar cartões em massa da seleção',
    description: 'Gera uma prévia editável de flashcards a partir do texto selecionado.',
    keywords: 'IA flashcards cartões seleção massa',
    action: async () => {
      const selection = await plugin.editor.getSelectedText();
      if (!selection) {
        await plugin.app.toast('Selecione um trecho antes de criar cartões.');
        return;
      }
      const sourceText = (await plugin.richText.toString(selection.richText)).trim();
      if (!sourceText) {
        await plugin.app.toast('A seleção está vazia.');
        return;
      }
      await plugin.storage.setSession('bulk-cards-source', {
        sourceText,
        sourceRemId: selection.remId,
      });
      await plugin.widget.openPopup('bulk_cards_popup');
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
