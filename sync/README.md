# Notion ↔ Obsidian ↔ Site — Auto Sync

Infraestrutura completa de sincronização automática via n8n.

## Arquitetura

```
Notion ──(n8n cloud, 15min)──► Obsidian (RICARDO MPSP, C:\OBSIDIAN)
  │                                │
  └──(n8n cloud, Seg/Qui 20h BRT)──► GitHub ──► Vercel ──► jurismp.xyz
                                               ↓
                                        Telegram (notificações)
```

## Pré-requisitos

| Serviço | Onde obter |
|---|---|
| n8n cloud | `ric88k.app.n8n.cloud` (já configurado) |
| Notion API Key | notion.com → Settings → Connections → Develop |
| ngrok Auth Token | ngrok.com → Your Authtoken |
| Obsidian API Key | Obsidian → Settings → Local REST API → API Key |
| GitHub Token | github.com → Settings → Developer Settings → Fine-grained tokens |
| Vercel Deploy Hook | vercel.com → cockpit-mpsp → Settings → Git → Deploy Hooks |
| Telegram Bot Token | @BotFather no Telegram → /newbot |
| Telegram Chat ID | Enviar msg ao bot → `https://api.telegram.org/bot<TOKEN>/getUpdates` |

---

## Setup rápido

### 1. Obsidian — RICARDO MPSP

```powershell
# No PowerShell como Administrador, na máquina RICARDO MPSP:
.\sync\scripts\setup-ngrok-windows.ps1 -NgrokAuthToken "SEU_TOKEN_NGROK"
```

O script:
- Instala ngrok em `C:\ngrok\`
- Autentica com seu token
- Expõe `localhost:27123` publicamente
- Registra no Task Scheduler para iniciar no login
- Exibe a URL pública gerada

**Anote a URL gerada** (ex: `https://abc123.ngrok-free.app`) — você vai precisar no passo 2.

### 2. Variáveis no n8n cloud

Acesse `ric88k.app.n8n.cloud` → **Settings** → **Variables** e adicione:

| Variável | Valor |
|---|---|
| `NOTION_API_KEY` | Sua chave da Notion API |
| `NOTION_JURIS_DATABASE_ID` | `6be2d8b624f54620acc0720498e22bbb` |
| `NOTION_LEGISLACAO_DATABASE_ID` | `12649f17d3fc42f8a54b5f68eb1afc42` |
| `NOTION_EXECUCOES_DATABASE_ID` | `abe2a811745b41e990ddfb7a7889aea5` |
| `OBSIDIAN_BASE_URL` | URL gerada pelo ngrok (passo 1) |
| `OBSIDIAN_API_KEY` | Chave do plugin Local REST API |
| `OBSIDIAN_VAULT_FOLDER` | `01-Entrada` |
| `GITHUB_TOKEN` | Token com acesso ao repo `cockpit-mpsp` |
| `GITHUB_REPO_OWNER` | `ricardodelemosadv` |
| `GITHUB_REPO_NAME` | `cockpit-mpsp` |
| `VERCEL_DEPLOY_HOOK_URL` | URL do Deploy Hook do Vercel |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `TELEGRAM_CHAT_ID` | Seu chat ID no Telegram |

### 3. Importar workflows no n8n cloud

No n8n cloud: **Settings** → **Import from File**, importe nesta ordem:

1. `sync/n8n/workflows/notion-to-obsidian.json` — Sync Notion → Obsidian (15min)
2. `sync/n8n/workflows/obsidian-to-notion.json` — Sync Obsidian → Notion (webhook)
3. `sync/n8n/workflows/notion-to-site-deploy.json` — Deploy site (Seg/Qui 20h BRT)
4. `sync/n8n/workflows/health-check.json` — Monitoramento horário

**Ative todos os workflows** após importar.

### 4. Testar

```bash
# Forçar deploy do site imediatamente:
curl -X POST https://ric88k.app.n8n.cloud/webhook/force-site-deploy

# Verificar resultado:
# - Telegram receberá notificação
# - jurismp.xyz mostrará conteúdo atualizado
# - Banco "Execuções de Automação" no Notion terá novo registro
```

---

## Estrutura do cofre Obsidian

**Máquina:** RICARDO MPSP  
**Caminho:** `C:\OBSIDIAN`  
**Plugin:** Local REST API (coddingtonbear), porta 27123

```
C:\OBSIDIAN\
  00-Sistema\
  01-Entrada\        ← arquivos sincronizados do Notion chegam aqui
  02-Legislação\
  03-Doutrina Revisional\
  04-Conceitos\
  05-Jurisprudência\
  06-Mapas\
  07-Questões\
  08-Vade Mecum\
  09-Arquivo\
```

---

## Workflows

### `notion-to-obsidian.json`
- **Gatilho:** a cada 15 minutos
- **O que faz:** busca páginas editadas desde o último sync → converte blocos Notion para Markdown → salva via `PUT /vault/{path}` na API do Obsidian
- **Destino:** `01-Entrada/{Título da página}.md`

### `obsidian-to-notion.json`
- **Gatilho:** webhook `POST /webhook/obsidian-changed` (disparado pelo Shell Commands plugin do Obsidian ao salvar arquivo)
- **O que faz:** lê frontmatter YAML → converte Markdown para blocos Notion → cria ou atualiza página no banco correspondente

### `notion-to-site-deploy.json`
- **Gatilho:** Segunda e Quinta, 20h BRT (`0 23 * * 1,4`) + webhook manual
- **O que faz:** busca Jurisprudência + Legislação → monta `notion-content.json` → faz commit no GitHub → dispara Vercel Deploy Hook → notifica Telegram → registra no banco Execuções

### `health-check.json`
- **Gatilho:** a cada hora
- **O que faz:** pinga Obsidian REST API + verifica última execução no banco Execuções → envia alerta Telegram se algo falhar ou sync estiver desatualizado (> 2h)

---

## Setup Hetzner (opcional — n8n self-hosted)

Se quiser migrar do n8n cloud para uma VPS própria:

```bash
# No servidor Ubuntu 22.04:
bash sync/scripts/setup-hetzner.sh seu-dominio.com seu@email.com
```

Consulte `sync/docker-compose.yml` para detalhes da stack (n8n + PostgreSQL + nginx + Certbot).

---

## Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| Obsidian não atualiza | ngrok offline | Rodar `C:\ngrok\start-obsidian-tunnel.bat` em RICARDO MPSP |
| URL do ngrok mudou | ngrok free reiniciou | Rodar script novamente → atualizar `OBSIDIAN_BASE_URL` no n8n |
| Site não atualiza | Workflow inativo ou variáveis faltando | Verificar variáveis no n8n → ativar workflow → testar webhook |
| Sem notificação Telegram | Token/Chat ID errados | Verificar com `https://api.telegram.org/bot<TOKEN>/getUpdates` |
| Alerta "sync estale" | Workflow parado ou com erro | n8n cloud → Executions → ver último erro |
