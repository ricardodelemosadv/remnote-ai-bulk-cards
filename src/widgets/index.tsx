import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { LEGACY_API_KEY_LOCAL_KEY, SOURCE_SESSION_KEY } from '../lib/constants';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  // v0.0.2 could persist an OpenAI key in this device. v0.0.3 removes it;
  // only a revocable bridge token may remain in plugin storage.
  if (await plugin.storage.getLocal<string>(LEGACY_API_KEY_LOCAL_KEY)) {
    await plugin.storage.setLocal(LEGACY_API_KEY_LOCAL_KEY, null);
  }

  const operatingSystem = await plugin.app.getOperatingSystem();
  const isMobile = operatingSystem === 'ios' || operatingSystem === 'android';

  await plugin.app.registerWidget('selected_text_menu', WidgetLocation.SelectedTextMenu, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabIcon: `${plugin.rootURL}magic.svg`,
    widgetTabTitle: 'Cartões em massa',
  });

  await plugin.app.registerWidget('bulk_cards_popup', WidgetLocation.Popup, {
    dimensions: isMobile
      ? { height: 'auto', width: '100%' }
      : { height: 680, width: 820 },
  });

  await plugin.app.registerCommand({
    id: 'configure-ai-bulk-cards',
    name: 'IA: configurar serviço de cartões',
    description: 'Configura o código privado usado para gerar cartões no computador e no tablet.',
    keywords: 'IA configurar acesso tablet cartões',
    action: async () => {
      await plugin.storage.setSession(SOURCE_SESSION_KEY, null);
      await plugin.widget.openPopup('bulk_cards_popup');
    },
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
