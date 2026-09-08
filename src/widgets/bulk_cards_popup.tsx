import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useMemo, useState } from 'react';
import {
  API_KEY_LOCAL_KEY,
  DEFAULT_MAX_CARDS,
  SOURCE_SESSION_KEY,
  type DraftCard,
  type SourceSelection,
} from '../lib/constants';
import { parseEnvApiKey } from '../lib/core';
import { generateCards } from '../lib/openai';
import { createCardsUnderSource } from '../lib/remnote';
import '../style.css';
import '../index.css';

function BulkCardsPopup() {
  const plugin = usePlugin();
  const [source, setSource] = useState<SourceSelection>();
  const [hasKey, setHasKey] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maxCards, setMaxCards] = useState(DEFAULT_MAX_CARDS);
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const [savedSource, apiKey] = await Promise.all([
        plugin.storage.getSession<SourceSelection>(SOURCE_SESSION_KEY),
        plugin.storage.getLocal<string>(API_KEY_LOCAL_KEY),
      ]);
      let localBridgeReady = false;
      if (!apiKey) {
        try {
          const response = await fetch('http://localhost:8080/bridge/health');
          localBridgeReady = response.ok && Boolean((await response.json()).ready);
        } catch {
          localBridgeReady = false;
        }
      }
      setSource(savedSource);
      setBridgeReady(localBridgeReady);
      setHasKey(Boolean(apiKey) || localBridgeReady);
    })();
  }, [plugin]);

  const enabledCount = useMemo(
    () => cards.filter((card) => card.enabled && card.question.trim() && card.answer.trim()).length,
    [cards],
  );

  async function importKey(file?: File) {
    if (!file) return;
    setError('');
    const key = parseEnvApiKey(await file.text());
    if (!key) {
      setError('O arquivo não contém OPENAI_API_KEY.');
      return;
    }
    await plugin.storage.setLocal(API_KEY_LOCAL_KEY, key);
    setHasKey(true);
  }

  async function savePastedKey() {
    const key = apiKeyInput.trim();
    if (!key.startsWith('sk-')) {
      setError('Cole uma chave válida da OpenAI.');
      return;
    }
    await plugin.storage.setLocal(API_KEY_LOCAL_KEY, key);
    setApiKeyInput('');
    setError('');
    setHasKey(true);
  }

  async function generate() {
    if (!source) return;
    setBusy(true);
    setError('');
    try {
      const apiKey = await plugin.storage.getLocal<string>(API_KEY_LOCAL_KEY);
      if (!apiKey && !bridgeReady) throw new Error('Conecte sua chave da OpenAI antes de gerar.');
      setCards(await generateCards(apiKey || '', source.sourceText, maxCards));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar os cartões.');
    } finally {
      setBusy(false);
    }
  }

  async function createCards() {
    if (!source || !enabledCount) return;
    setBusy(true);
    setError('');
    try {
      const created = await createCardsUnderSource(plugin, source.sourceRemId, cards);
      setDone(true);
      await plugin.app.toast(`${created} cartão(ões) criado(s) abaixo do trecho de origem.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar os cartões.');
    } finally {
      setBusy(false);
    }
  }

  function updateCard(index: number, patch: Partial<DraftCard>) {
    setCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, ...patch } : card)),
    );
  }

  if (!source) {
    return (
      <main className="bulk-popup">
        <p>Seleção não encontrada. Feche e selecione o trecho novamente.</p>
      </main>
    );
  }

  return (
    <main className="bulk-popup">
      <header className="bulk-header">
        <div>
          <p className="bulk-eyebrow">REMNOTE + OPENAI</p>
          <h1>Cartões em massa</h1>
          <p className="bulk-subtitle">Gere, revise e só então grave os flashcards na nota.</p>
        </div>
        <button className="bulk-close" onClick={() => plugin.widget.closePopup()}>×</button>
      </header>

      <section className="bulk-source">
        <strong>Trecho selecionado</strong>
        <p>{source.sourceText}</p>
      </section>

      {!hasKey ? (
        <section className="bulk-key-panel">
          <h2>Conectar sua IA</h2>
          <p>
            Cole sua chave ou importe o arquivo <code>.env.local</code>. Ela ficará somente no
            armazenamento local deste plugin.
          </p>
          <label>
            Chave da OpenAI
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-…"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
            />
          </label>
          <button className="bulk-primary" onClick={() => void savePastedKey()}>
            Salvar chave
          </button>
          <label className="bulk-file-button">
            Importar chave existente
            <input
              type="file"
              accept=".env,.local,text/plain"
              onChange={(event) => void importKey(event.target.files?.[0])}
            />
          </label>
        </section>
      ) : cards.length === 0 ? (
        <section className="bulk-generate-panel">
          <label>
            Máximo de cartões
            <input
              type="number"
              min={1}
              max={30}
              value={maxCards}
              onChange={(event) =>
                setMaxCards(Math.max(1, Math.min(30, Number(event.target.value) || 1)))
              }
            />
          </label>
          <button className="bulk-primary" disabled={busy} onClick={() => void generate()}>
            {busy ? 'Gerando rascunhos…' : 'Gerar rascunhos com IA'}
          </button>
        </section>
      ) : done ? (
        <section className="bulk-success">
          <h2>Cartões criados</h2>
          <p>Os flashcards foram adicionados como filhos do Rem que continha a seleção.</p>
          <button className="bulk-primary" onClick={() => plugin.widget.closePopup()}>Concluir</button>
        </section>
      ) : (
        <section className="bulk-drafts">
          <div className="bulk-drafts-title">
            <h2>Prévia para revisão</h2>
            <span>{enabledCount} selecionado(s)</span>
          </div>
          {cards.map((card, index) => (
            <article
              className={card.enabled ? 'bulk-card' : 'bulk-card bulk-card-disabled'}
              key={index}
            >
              <label className="bulk-check">
                <input
                  type="checkbox"
                  checked={card.enabled}
                  onChange={(event) => updateCard(index, { enabled: event.target.checked })}
                />
                Criar este cartão
              </label>
              <label>
                Pergunta
                <textarea
                  value={card.question}
                  onChange={(event) => updateCard(index, { question: event.target.value })}
                />
              </label>
              <label>
                Resposta
                <textarea
                  value={card.answer}
                  onChange={(event) => updateCard(index, { answer: event.target.value })}
                />
              </label>
            </article>
          ))}
          <div className="bulk-actions">
            <button className="bulk-secondary" disabled={busy} onClick={() => setCards([])}>
              Gerar novamente
            </button>
            <button
              className="bulk-primary"
              disabled={busy || !enabledCount}
              onClick={() => void createCards()}
            >
              {busy ? 'Criando…' : `Criar ${enabledCount} cartão(ões)`}
            </button>
          </div>
        </section>
      )}

      {error && <p className="bulk-error">{error}</p>}
      <footer>A seleção só é gravada quando você confirma “Criar cartões”.</footer>
    </main>
  );
}

renderWidget(BulkCardsPopup);
