#!/usr/bin/env bash
# setup-hetzner.sh — configura n8n + nginx + Let's Encrypt em uma VM Hetzner
# Testado em: Ubuntu 22.04 / Debian 12
# Uso: bash setup-hetzner.sh <dominio> <email-letsencrypt>
set -euo pipefail

DOMAIN="${1:?Informe o domínio: bash setup-hetzner.sh sync.seudominio.com email@exemplo.com}"
EMAIL="${2:?Informe o e-mail para o Let's Encrypt}"
INSTALL_DIR="/opt/notion-obsidian-sync"

info()  { echo -e "\033[1;32m[INFO]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[AVISO]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERRO]\033[0m  $*" >&2; exit 1; }

# ── 1. Dependências do sistema ────────────────────────────────────────────────
info "Atualizando pacotes e instalando Docker..."
apt-get update -qq
apt-get install -y -qq curl git openssl ufw

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version &>/dev/null; then
  apt-get install -y -qq docker-compose-plugin
fi

systemctl enable --now docker

# ── 2. Firewall básico ────────────────────────────────────────────────────────
info "Configurando UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 3. Diretório do projeto ───────────────────────────────────────────────────
info "Copiando arquivos para $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_DIR="$(dirname "$SCRIPT_DIR")"

cp -r "$SYNC_DIR/docker-compose.yml" "$INSTALL_DIR/"
cp -r "$SYNC_DIR/nginx"              "$INSTALL_DIR/"
cp -r "$SYNC_DIR/n8n"                "$INSTALL_DIR/"

# ── 4. Arquivo .env ───────────────────────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn ".env já existe — não será sobrescrito."
else
  info "Gerando .env com valores iniciais..."

  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
  N8N_BASIC_AUTH_PASSWORD=$(openssl rand -hex 16)

  cat > "$ENV_FILE" <<EOF
N8N_HOST=${DOMAIN}

POSTGRES_USER=n8n
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=n8n

N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}

NOTION_TOKEN=PREENCHA_AQUI
NOTION_DATABASE_ID=PREENCHA_AQUI

OBSIDIAN_BASE_URL=http://localhost:27123
OBSIDIAN_API_KEY=PREENCHA_AQUI
OBSIDIAN_VAULT_FOLDER=Notion Sync

SYNC_CRON=*/15 * * * *
SYNC_PAGE_SIZE=50
EOF

  chmod 600 "$ENV_FILE"
  warn "Credenciais geradas automaticamente:"
  warn "  Usuário n8n:      admin"
  warn "  Senha n8n:        ${N8N_BASIC_AUTH_PASSWORD}"
  warn "  Salvas em:        ${ENV_FILE}"
  warn "Preencha NOTION_TOKEN, NOTION_DATABASE_ID e OBSIDIAN_API_KEY no .env antes de continuar."
fi

# ── 5. Substituir variáveis no nginx.conf ─────────────────────────────────────
info "Configurando nginx para o domínio ${DOMAIN}..."
sed -i "s/\${N8N_HOST}/${DOMAIN}/g" "$INSTALL_DIR/nginx/default.conf"

# ── 6. Certificado TLS via Let's Encrypt (antes de subir o nginx completo) ───
info "Obtendo certificado Let's Encrypt para ${DOMAIN}..."

# Sobe o nginx em modo apenas HTTP para validação ACME
docker run --rm -d \
  --name nginx-acme \
  -p 80:80 \
  -v "$INSTALL_DIR/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:alpine || true

sleep 3

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/acme:/var/www/acme \
  certbot/certbot certonly \
    --webroot -w /var/www/acme \
    --non-interactive --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" || warn "Certbot falhou — verifique se o DNS aponta para este IP."

docker stop nginx-acme 2>/dev/null || true

# ── 7. Subir os serviços ──────────────────────────────────────────────────────
info "Iniciando serviços..."
cd "$INSTALL_DIR"
docker compose pull
docker compose up -d

# ── 8. Importar workflows n8n ─────────────────────────────────────────────────
info "Aguardando n8n ficar pronto..."
sleep 15

for wf in "$INSTALL_DIR/n8n/workflows/"*.json; do
  info "Importando workflow: $(basename "$wf")..."
  docker compose exec -T n8n n8n import:workflow --input="/home/node/.n8n/workflows/$(basename "$wf")" 2>/dev/null \
    || warn "Falha ao importar $(basename "$wf"). Importe manualmente pela UI."
done

# ── 9. Resumo ─────────────────────────────────────────────────────────────────
echo ""
info "══════════════════════════════════════════════════════"
info " Setup concluído!"
info ""
info " Interface n8n:    https://${DOMAIN}"
info " Usuário:          admin"
info " Senha:            (ver ${ENV_FILE})"
info ""
info " Próximos passos:"
info " 1. Edite ${ENV_FILE} com NOTION_TOKEN, NOTION_DATABASE_ID e OBSIDIAN_API_KEY"
info " 2. Reinicie:  cd ${INSTALL_DIR} && docker compose restart n8n"
info " 3. Na UI do n8n, configure as credenciais 'Notion API' apontando para o token"
info " 4. Ative os dois workflows importados"
info " 5. No Obsidian, configure o plugin 'Obsidian → n8n' (ver sync/scripts/obsidian-webhook-plugin.js)"
info "══════════════════════════════════════════════════════"
