/**
 * Script para o Obsidian Templater ou "Shell Commands" plugin
 * Dispara o webhook do n8n sempre que um arquivo Markdown é salvo.
 *
 * Como usar:
 * 1. Instale o plugin "Shell Commands" no Obsidian
 * 2. Crie um comando: node /caminho/para/obsidian-webhook-plugin.js "{{file_path}}"
 * 3. Em Settings → Shell Commands → Events, ative "After saving a file"
 *
 * Alternativa sem Shell Commands: use o Obsidian Local REST API diretamente
 * pelo n8n no sentido inverso (Notion → Obsidian já cobre isso).
 *
 * Variáveis de ambiente necessárias:
 *   N8N_WEBHOOK_URL  - URL completa do webhook (ex: https://sync.seudominio.com/webhook/obsidian-to-notion)
 *   OBSIDIAN_VAULT   - Caminho absoluto do vault no sistema de arquivos
 */

const fs      = require('fs');
const https   = require('https');
const path    = require('path');
const url     = require('url');

const WEBHOOK_URL   = process.env.N8N_WEBHOOK_URL;
const VAULT_PATH    = process.env.OBSIDIAN_VAULT || process.cwd();
const SYNC_FOLDER   = process.env.OBSIDIAN_VAULT_FOLDER || 'Notion Sync';

if (!WEBHOOK_URL) {
  console.error('N8N_WEBHOOK_URL não definida.');
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node obsidian-webhook-plugin.js <caminho-do-arquivo>');
  process.exit(1);
}

// Só envia arquivos da pasta de sync (evita loops e ruído)
const relativePath = path.relative(VAULT_PATH, filePath).replace(/\\/g, '/');
if (!relativePath.startsWith(SYNC_FOLDER) && !relativePath.includes('Notion')) {
  process.exit(0);
}

const content = fs.readFileSync(filePath, 'utf8');
const payload  = JSON.stringify({
  vault:   path.basename(VAULT_PATH),
  path:    relativePath,
  content: content,
});

const parsed   = new url.URL(WEBHOOK_URL);
const options  = {
  hostname: parsed.hostname,
  port:     parsed.port || 443,
  path:     parsed.pathname,
  method:   'POST',
  headers:  {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

const req = (parsed.protocol === 'https:' ? https : require('http')).request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end',  () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`[obsidian→notion] OK — ${relativePath}`);
    } else {
      console.error(`[obsidian→notion] HTTP ${res.statusCode}: ${body}`);
    }
  });
});

req.on('error', (err) => { console.error('[obsidian→notion] Erro:', err.message); });
req.write(payload);
req.end();
