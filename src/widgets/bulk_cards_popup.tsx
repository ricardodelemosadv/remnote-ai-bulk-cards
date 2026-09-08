import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BRIDGE_TOKEN_SYNCED_KEY,
  DEFAULT_MAX_CARDS,
  SOURCE_SESSION_KEY,
  type DraftCard,
  type SourceSelection,
} from '../lib/constants';
import { generateCards } from '../lib/openai';
import { createCardsUnderSource } from '../lib/remnote';
import '../style.css';
import '../index.css';

function BulkCardsPopup() {
  const plugin = usePlugin();
  const [source, setSource] = useState<SourceSelection>();
  const [loaded, setLoaded] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [maxCards, setMaxCards] = useState(DEFAULT_MAX_CARDS);
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const generatingRef = useRef(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const [savedSource, bridgeToken] = await Promise.all([
        plugin.storage.getSession<SourceSelection>(SOURCE_SESSION_KEY),
        plugin.storage.getSynced<string>(BRIDGE_TOKEN_SYNCED_KEY),
      ]);
      setSource(savedSource);
      setHasAccess(Boolean(bridgeToken));
      setLoaded(true);
    })();
  }, [plugin]);

  const enabledCount = useMemo(
    () => cards.filter((card) => card.enabled && card.question.trim() && card.answer.trim()).length,
    [cards],
  );

  async function saveAccessCode() {
    const accessCode = accessCodeInput.trim();
    if (accessCode.length < 32 || /\s/.test(accessCode)) {
      setError('Digite o código de acesso fornecido para este plugin.');
      return;
    }
    await plugin.storage.setSynced(BRIDGE_TOKEN_SYNCED_KEY, accessCode);
    setAccessCodeInput('');
    setError('');
    setHasAccess(true);
  }

  async function resetAccessCode() {
    await plugin.storage.setSynced(BRIDGE_TOKEN_SYNCED_KEY, null);
    setCards([]);
    setHasAccess(false);
    setError('');
  }

  async function generate() {
    if (!source || generatingRef.current) return;
    generatingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const bridgeToken = await plugin.storage.getSynced<string>(BRIDGE_TOKEN_SYNCED_KEY);
      if (!bridgeToken) throw new Error('Configure o código de acesso antes de gerar.');
      setCards(await generateCards(bridgeToken, source.sourceText, maxCards));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar os cartões.');
    } finally {
      generatingRef.current = false;
      setBusy(false);
    }
  }

  async function createCards() {
    if (!source || !enabledCount || creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const created = await createCardsUnderSource(plugin, source.sourceRemId, cards);
      setDone(true);
      await plugin.app.toast(`${created} cartão(ões) criado(s) abaixo do trecho de origem.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar os cartões.');
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  }

  function updateCard(index: number, patch: Partial<DraftCard>) {
    setCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, ...patch } : card)),
    );
  }

  if (!loaded) {
    return (
      <main className="bulk-popup">
        <p>Carregando…</p>
      </main>
    );
  }

  if (!source) {
    return (
      <main className="bulk-popup">
        <header className="bulk-header">
          <div>
            <p className="bulk-eyebrow">REMNOTE + OPENAI</p>
            <h1>Configurar IA</h1>
          </div>
          <button className="bulk-close" onClick={() => plugin.widget.closePopup()}>×</button>
        </header>
        {!hasAccess ? (
          <section className="bulk-key-panel">
            <h2>Ativar nos seus dispositivos</h2>
            <p>
              Digite o código privado do serviço. Ele será sincronizado pela sua conta do RemNote;
              a chave da OpenAI continuará somente no servidor.
            </p>
            <label>
              Código de acesso
              <input
                type="password"
                autoComplete="off"
                placeholder="Código privado…"
                value={accessCodeInput}
                onChange={(event) => setAccessCodeInput(event.target.value)}
              />
            </label>
            <button className="bulk-primary" onClick={() => void saveAccessCode()}>
              Salvar código
            </button>
          </section>
        ) : (
          <section className="bulk-success">
            <h2>Serviço conectado</h2>
            <p>O código está disponível para o plugin nos seus dispositivos sincronizados.</p>
            <button className="bulk-secondary" onClick={() => void resetAccessCode()}>
              Trocar código
            </button>
          </section>
        )}
        {error && <p className="bulk-error">{error}</p>}
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

      {!hasAccess ? (
        <section className="bulk-key-panel">
          <h2>Ativar a IA neste dispositivo</h2>
          <p>
            Digite o código de acesso do serviço. Sua chave da OpenAI permanece protegida no
            servidor e nunca é enviada ao tablet ou ao RemNote.
          </p>
          <label>
            Código de acesso
            <input
              type="password"
              autoComplete="off"
              placeholder="Código privado…"
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value)}
            />
          </label>
          <button className="bulk-primary" onClick={() => void saveAccessCode()}>
            Salvar e continuar
          </button>
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
          <button className="bulk-secondary" disabled={busy} onClick={() => void resetAccessCode()}>
            Trocar código
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
      <footer>
        O trecho selecionado é enviado ao serviço protegido e à OpenAI. Nada é gravado na nota
        antes de você confirmar “Criar cartões”.
      </footer>
    </main>
  );
}

renderWidget(BulkCardsPopup);
