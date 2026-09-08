import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import { useRef } from 'react';
import { SOURCE_SESSION_KEY, type SourceSelection } from '../lib/constants';
import { readSelectedSource } from '../lib/remnote';
import '../style.css';
import '../index.css';

function SelectedTextMenu() {
  const plugin = usePlugin();
  const trackedSource = useTrackerPlugin(async (reactivePlugin) =>
    readSelectedSource(reactivePlugin),
  );
  const openingRef = useRef(false);
  const lastTouchOpenAtRef = useRef(0);

  async function openDrafts(source?: SourceSelection) {
    if (openingRef.current) return;
    openingRef.current = true;

    try {
      // On touch devices the native selection may disappear before `click`.
      // Prefer the source captured reactively while the selection menu is open.
      const selectedSource = source ?? (await readSelectedSource(plugin));
      if (!selectedSource) {
        await plugin.app.toast('Selecione um trecho antes de criar cartões.');
        return;
      }

      await plugin.storage.setSession(SOURCE_SESSION_KEY, selectedSource);
      await plugin.widget.openPopup('bulk_cards_popup');
    } finally {
      openingRef.current = false;
    }
  }

  return (
    <div className="bulk-selection-action">
      <button
        className="bulk-primary bulk-selection-button"
        type="button"
        onPointerDown={(event) => {
          if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            event.preventDefault();
            lastTouchOpenAtRef.current = Date.now();
            void openDrafts(trackedSource);
          }
        }}
        onClick={() => {
          // A touch/pen interaction also emits `click`; ignore that duplicate.
          if (Date.now() - lastTouchOpenAtRef.current < 1_000) return;
          void openDrafts(trackedSource);
        }}
      >
        ✨ Cartões em massa
      </button>
    </div>
  );
}

renderWidget(SelectedTextMenu);
