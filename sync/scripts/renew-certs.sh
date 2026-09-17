#!/usr/bin/env bash
# Executa via cron: 0 3 * * 1 /opt/notion-obsidian-sync/scripts/renew-certs.sh
set -euo pipefail
cd /opt/notion-obsidian-sync

docker compose run --rm certbot renew --quiet
docker compose exec nginx nginx -s reload
echo "[$(date -Iseconds)] Certificados renovados com sucesso."
