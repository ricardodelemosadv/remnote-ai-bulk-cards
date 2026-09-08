import { renderWidget, usePlugin, useTrackerPlugin } from '@remnote/plugin-sdk';
import type { RichTextFormatName } from '@remnote/plugin-sdk';
import { readSelectedSource, openBulkCardsPopup, applyFormatToSelection } from '../lib/remnote';
import '../style.css';
import '../index.css';

function SelectedTextMenu() {
  const plugin = usePlugin();
  const hasSelection = useTrackerPlugin(async (reactivePlugin) =>
    Boolean(await readSelectedSource(reactivePlugin)),
  );

  const fmt = (format: RichTextFormatName) => () => applyFormatToSelection(plugin, format);

  return (
    <div className="sel-toolbar-wrap">
      <button
        className="sel-btn sel-fmt"
        disabled={!hasSelection}
        title="Negrito"
        onClick={fmt('bold')}
      >
        <b>B</b>
      </button>
      <button
        className="sel-btn sel-fmt sel-underline-btn"
        disabled={!hasSelection}
        title="Sublinhar"
        onClick={fmt('underline')}
      >
        <u>U</u>
      </button>
      <div className="sel-divider" />
      <button
        className="sel-btn sel-color sel-yellow"
        disabled={!hasSelection}
        title="Destacar amarelo"
        onClick={fmt('Yellow')}
        aria-label="Destacar amarelo"
      />
      <button
        className="sel-btn sel-color sel-green"
        disabled={!hasSelection}
        title="Destacar verde"
        onClick={fmt('Green')}
        aria-label="Destacar verde"
      />
      <button
        className="sel-btn sel-color sel-red"
        disabled={!hasSelection}
        title="Destacar vermelho"
        onClick={fmt('Red')}
        aria-label="Destacar vermelho"
      />
      <div className="sel-divider" />
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
