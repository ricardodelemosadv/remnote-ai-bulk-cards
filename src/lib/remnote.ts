import type { RNPlugin } from '@remnote/plugin-sdk';
import { SOURCE_SESSION_KEY, type DraftCard, type SourceSelection } from './constants';

export async function readSelectedSource(plugin: RNPlugin): Promise<SourceSelection | undefined> {
  const selection = await plugin.editor.getSelectedText();
  if (!selection) return undefined;
  const sourceText = (await plugin.richText.toString(selection.richText)).trim();
  if (!sourceText) return undefined;
  return { sourceText, sourceRemId: selection.remId };
}

export async function openBulkCardsPopup(plugin: RNPlugin): Promise<void> {
  const source = await readSelectedSource(plugin);
  if (!source) {
    await plugin.app.toast('Selecione um trecho antes de criar cartões.');
    return;
  }
  await plugin.storage.setSession(SOURCE_SESSION_KEY, source);
  await plugin.widget.openPopup('bulk_cards_popup');
}

export async function createCardsUnderSource(
  plugin: RNPlugin,
  sourceRemId: string,
  cards: DraftCard[],
): Promise<number> {
  const parent = await plugin.rem.findOne(sourceRemId);
  if (!parent) throw new Error('Não foi possível localizar a nota de origem.');

  const approved = cards.filter(
    (card) => card.enabled && card.question.trim() && card.answer.trim(),
  );
  let created = 0;
  for (const card of approved) {
    const rem = await plugin.rem.createRem();
    if (!rem) throw new Error(`Falha após criar ${created} cartão(ões).`);
    await rem.setText([card.question.trim()]);
    await rem.setBackText([card.answer.trim()]);
    await rem.setParent(parent._id);
    await rem.setIsCardItem(true);
    await rem.setEnablePractice(true);
    await rem.setPracticeDirection('forward');
    created += 1;
  }
  return created;
}
