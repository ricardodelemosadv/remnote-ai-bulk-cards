#!/usr/bin/env python3
"""
generate-checkpoint.py
Gera CHECKPOINT-LEGAL-DELTA-YYYYMMDD.json a partir de arquivos do OneDrive local.
Calcula SHA-256 e grava no JSON gerado.

Uso:
    python generate-checkpoint.py --onedrive "C:\\Users\\MPSP\\OneDrive\\JurisMPSP\\delta-20260924"
    python generate-checkpoint.py --onedrive "..." --output CHECKPOINT-LEGAL-DELTA-20260924.json
    python generate-checkpoint.py --onedrive "..." --since 2026-09-20
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extrai frontmatter YAML simples (key: value) de um .md."""
    meta = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            fm_block = text[3:end].strip()
            body = text[end+4:].strip()
            for line in fm_block.splitlines():
                m = re.match(r'^(\w[\w_-]*):\s*(.+)$', line)
                if m:
                    key, val = m.group(1), m.group(2).strip().strip('"').strip("'")
                    meta[key] = val
    return meta, body


def md_to_note(path: Path, since: datetime | None) -> dict | None:
    """Converte arquivo .md em objeto note para o checkpoint."""
    stat = path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
    if since and mtime < since:
        return None

    text = path.read_text(encoding="utf-8", errors="replace")
    meta, body = parse_frontmatter(text)

    # H1 como título fallback
    title = meta.get("title") or ""
    if not title:
        m = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
        title = m.group(1).strip() if m else path.stem

    stable_id = meta.get("stable_id") or path.stem.lower().replace(" ", "-")

    tags_raw = meta.get("tags", "")
    tags = [t.strip() for t in re.split(r'[,\[\]]', tags_raw) if t.strip()]

    return {
        "stable_id": stable_id,
        "title": title,
        "type": meta.get("type", "jurisprudencia"),
        "tribunal": meta.get("tribunal", ""),
        "numero": meta.get("numero", ""),
        "data_julgamento": meta.get("data_julgamento", ""),
        "ementa": meta.get("ementa", ""),
        "tags": tags,
        "source": meta.get("source", ""),
        "created_at": meta.get("created_at", mtime.isoformat()),
        "content": body,
    }


def run(args):
    onedrive_dir = Path(args.onedrive).resolve()
    if not onedrive_dir.exists():
        print(f"ERRO: diretório OneDrive não encontrado: {onedrive_dir}", file=sys.stderr)
        sys.exit(1)

    since = None
    if args.since:
        since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)

    today = datetime.now().strftime("%Y%m%d")
    batch_id = f"LEGAL-DELTA-{today}"
    output_path = Path(args.output or f"CHECKPOINT-{batch_id}.json").resolve()

    print(f"Varrendo: {onedrive_dir}")
    md_files = sorted(onedrive_dir.rglob("*.md"))
    print(f"Arquivos .md encontrados: {len(md_files)}")

    notes = []
    seen_ids = set()
    for f in md_files:
        note = md_to_note(f, since)
        if note is None:
            continue
        sid = note["stable_id"]
        if sid in seen_ids:
            # Sufixo para evitar duplicata
            note["stable_id"] = f"{sid}-dup-{len(notes)}"
        seen_ids.add(note["stable_id"])
        notes.append(note)

    print(f"Notas elegíveis: {len(notes)}")

    payload = {
        "sha256": "",  # preenchido abaixo
        "batch_id": batch_id,
        "generated_at": now_iso(),
        "source": str(onedrive_dir),
        "total": len(notes),
        "notes": notes,
    }

    # Serializar sem sha256 para calcular hash
    raw = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    payload["sha256"] = sha256_bytes(raw.encode("utf-8"))

    # Serializar com sha256
    final = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    output_path.write_text(final, encoding="utf-8")

    file_sha = sha256_file(output_path)
    print(f"\nGerado: {output_path}")
    print(f"SHA-256 do arquivo: {file_sha}")
    print(f"Notas incluídas   : {len(notes)}")
    print(f"\nPara importar:")
    print(f"  python import-legal-delta.py \"{output_path}\" --expected-sha256 {file_sha}")


def main():
    parser = argparse.ArgumentParser(description="Gera checkpoint de delta jurídico a partir do OneDrive local.")
    parser.add_argument("--onedrive", required=True,
                        help="Caminho da pasta OneDrive com os .md do delta")
    parser.add_argument("--output", default=None,
                        help="Nome do arquivo JSON de saída (padrão: CHECKPOINT-LEGAL-DELTA-YYYYMMDD.json)")
    parser.add_argument("--since", default=None,
                        help="Filtrar apenas arquivos modificados após esta data (ISO: 2026-09-20)")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
