import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import { readSelectedSource, openBulkCardsPopup } from '../lib/remnote';
import '../style.css';
import '../index.css';

function SelectedTextMenu() {
  const plugin = usePlugin();
  const hasSelection = useTrackerPlugin(async (reactivePlugin) => {
    try {
      return Boolean(await readSelectedSource(reactivePlugin));
    } catch {
      return false;
    }
  });

  return (
    <div className="bulk-selection-action">
      <button
        className="bulk-primary bulk-selection-button"
        disabled={!hasSelection}
        onClick={() => openBulkCardsPopup(plugin)}
      >
        ✨ Cartões em massa
      </button>
    </div>
  );
}

renderWidget(SelectedTextMenu);
