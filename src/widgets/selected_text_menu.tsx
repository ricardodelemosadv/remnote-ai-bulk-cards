import { renderWidget, usePlugin, useTracker } from '@remnote/plugin-sdk';
import { readSelectedSource, openBulkCardsPopup } from '../lib/remnote';
import '../style.css';
import '../index.css';

function SelectedTextMenu() {
  const plugin = usePlugin();
  const hasSelection = useTracker(async (reactivePlugin) =>
    Boolean(await readSelectedSource(reactivePlugin)),
  );

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
