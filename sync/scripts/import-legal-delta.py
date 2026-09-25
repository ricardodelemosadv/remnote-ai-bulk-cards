#!/usr/bin/env python3
"""
import-legal-delta.py
Importa notas jurídicas de um arquivo CHECKPOINT-LEGAL-DELTA-*.json para o vault Obsidian.
- Verifica SHA-256 do arquivo de entrada
- Retoma do último checkpoint em caso de interrupção
- Grava progresso a cada N notas (padrão: 10)
- Não usa GUI do Obsidian — escreve .md diretamente no vault

Uso:
    python import-legal-delta.py CHECKPOINT-LEGAL-DELTA-20260924.json
    python import-legal-delta.py CHECKPOINT-LEGAL-DELTA-20260924.json --vault C:\\OBSIDIAN
    python import-legal-delta.py CHECKPOINT-LEGAL-DELTA-20260924.json --interval 20
    python import-legal-delta.py CHECKPOINT-LEGAL-DELTA-20260924.json --dry-run
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Configuração padrão ────────────────────────────────────────────────────────
DEFAULT_VAULT = r"C:\OBSIDIAN"
DEFAULT_FOLDER = "01-Entrada"
DEFAULT_INTERVAL = 10          # grava checkpoint a cada N notas
PROGRESS_FILE_SUFFIX = ".progress.json"


# ── Utilitários ───────────────────────────────────────────────────────────────

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_filename(title: str) -> str:
    """Converte título em nome de arquivo seguro para Windows."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", title)
    name = name.strip(". ")
    return name[:200] or "sem-titulo"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str, level: str = "INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {level:5s} {msg}", flush=True)


# ── Checkpoint de progresso ───────────────────────────────────────────────────

def progress_path(source_path: Path) -> Path:
    return source_path.with_suffix("").with_suffix(PROGRESS_FILE_SUFFIX)


def load_progress(source_path: Path) -> dict:
    p = progress_path(source_path)
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        log(f"Retomando checkpoint: {data['processed']} notas já importadas", "RESUME")
        return data
    return {"processed": [], "failed": [], "started_at": now_iso(), "last_saved": None}


def save_progress(source_path: Path, progress: dict, force: bool = False):
    progress["last_saved"] = now_iso()
    p = progress_path(source_path)
    tmp = p.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)
    tmp.replace(p)  # atômico no mesmo volume
    if force:
        log(f"Checkpoint salvo: {len(progress['processed'])} processadas, {len(progress['failed'])} falhas")


# ── Formatação Markdown ───────────────────────────────────────────────────────

def note_to_markdown(note: dict) -> str:
    """Converte um objeto note do JSON em conteúdo .md com frontmatter YAML."""
    stable_id = note.get("stable_id", "")
    title = note.get("title", "Sem título")
    source = note.get("source", "")
    tags = note.get("tags", [])
    created = note.get("created_at", now_iso())
    body = note.get("content", note.get("body", ""))
    note_type = note.get("type", "jurisprudencia")
    tribunal = note.get("tribunal", "")
    numero = note.get("numero", "")
    data_julgamento = note.get("data_julgamento", "")
    ementa = note.get("ementa", "")

    # Frontmatter
    lines = ["---"]
    lines.append(f"stable_id: {stable_id}")
    lines.append(f"title: \"{title.replace(chr(34), chr(39))}\"")
    lines.append(f"type: {note_type}")
    if tribunal:
        lines.append(f"tribunal: {tribunal}")
    if numero:
        lines.append(f"numero: \"{numero}\"")
    if data_julgamento:
        lines.append(f"data_julgamento: {data_julgamento}")
    if source:
        lines.append(f"source: \"{source}\"")
    if tags:
        lines.append(f"tags: [{', '.join(tags)}]")
    lines.append(f"imported_at: {now_iso()}")
    lines.append(f"created_at: {created}")
    lines.append("---")
    lines.append("")

    # H1 único
    lines.append(f"# {title}")
    lines.append("")

    if ementa:
        lines.append(f"> {ementa}")
        lines.append("")

    if body:
        lines.append(body)

    return "\n".join(lines)


# ── Importação ────────────────────────────────────────────────────────────────

def import_note(note: dict, vault_dir: Path, dry_run: bool) -> tuple[bool, str]:
    """Escreve nota no vault. Retorna (ok, caminho_relativo)."""
    title = note.get("title", "Sem título")
    filename = safe_filename(title) + ".md"
    dest = vault_dir / filename

    if dry_run:
        return True, str(dest)

    try:
        content = note_to_markdown(note)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        return True, str(dest)
    except Exception as e:
        return False, str(e)


def run(args):
    source_path = Path(args.source).resolve()

    # 1. Verificar existência
    if not source_path.exists():
        log(f"Arquivo não encontrado: {source_path}", "ERROR")
        sys.exit(1)

    # 2. Verificar SHA-256
    log(f"Verificando SHA-256 de {source_path.name}...")
    actual_sha = sha256_file(source_path)
    log(f"SHA-256: {actual_sha}")

    if args.expected_sha256:
        if actual_sha.lower() != args.expected_sha256.lower():
            log(f"SHA-256 INVÁLIDO! Esperado: {args.expected_sha256}", "ERROR")
            sys.exit(2)
        log("SHA-256 verificado ✓", "OK")
    else:
        log("Nenhum SHA-256 esperado fornecido — registrando apenas", "WARN")

    # 3. Carregar JSON
    with open(source_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Suporta tanto {"notes": [...]} quanto lista direta
    if isinstance(data, list):
        notes = data
        embedded_sha = None
    else:
        notes = data.get("notes", [])
        embedded_sha = data.get("sha256")

    if embedded_sha and embedded_sha.lower() != actual_sha.lower():
        log(f"SHA-256 embutido no JSON não confere: {embedded_sha}", "ERROR")
        sys.exit(2)

    total = len(notes)
    log(f"Total de notas no lote: {total}")

    if total == 0:
        log("Nada a importar.", "WARN")
        sys.exit(0)

    # 4. Carregar progresso anterior
    progress = load_progress(source_path)
    processed_ids = set(progress["processed"])
    failed_ids = set(item["id"] for item in progress.get("failed", []))

    # 5. Preparar diretório do vault
    vault_dir = Path(args.vault) / args.folder
    if not args.dry_run:
        vault_dir.mkdir(parents=True, exist_ok=True)
    log(f"Destino: {vault_dir}")

    # 6. Importar
    imported = 0
    skipped = 0
    errors = 0
    interval = args.interval

    for i, note in enumerate(notes):
        stable_id = note.get("stable_id") or note.get("id") or f"note-{i}"
        note["stable_id"] = stable_id  # garante que note_to_markdown tem o id

        if stable_id in processed_ids:
            skipped += 1
            continue

        ok, detail = import_note(note, vault_dir, args.dry_run)

        if ok:
            imported += 1
            progress["processed"].append(stable_id)
            processed_ids.add(stable_id)
            verb = "DRY" if args.dry_run else "OK"
            log(f"[{len(processed_ids):>4}/{total}] {verb} {note.get('title','?')[:60]}")
        else:
            errors += 1
            progress["failed"].append({"id": stable_id, "error": detail, "at": now_iso()})
            log(f"[{i+1:>4}/{total}] ERRO {note.get('title','?')[:40]}: {detail}", "ERROR")

        # Gravar checkpoint a cada N notas
        if imported > 0 and imported % interval == 0:
            save_progress(source_path, progress, force=True)

    # 7. Checkpoint final
    progress["finished_at"] = now_iso()
    progress["total"] = total
    progress["sha256"] = actual_sha
    save_progress(source_path, progress, force=True)

    # 8. Resumo
    print()
    print("=" * 50)
    print(f"  Importadas : {imported}")
    print(f"  Ignoradas  : {skipped}  (já no checkpoint)")
    print(f"  Erros      : {errors}")
    print(f"  Total      : {total}")
    print(f"  Vault      : {vault_dir}")
    print("=" * 50)

    if errors:
        log(f"{errors} nota(s) com erro — veja campo 'failed' no progress.json", "WARN")
        sys.exit(3)

    log("Importação concluída.", "OK")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Importa lote de notas jurídicas no vault Obsidian com checkpoint/resume."
    )
    parser.add_argument("source", help="Caminho para CHECKPOINT-LEGAL-DELTA-*.json")
    parser.add_argument("--vault", default=DEFAULT_VAULT,
                        help=f"Caminho raiz do vault (padrão: {DEFAULT_VAULT})")
    parser.add_argument("--folder", default=DEFAULT_FOLDER,
                        help=f"Subpasta dentro do vault (padrão: {DEFAULT_FOLDER})")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"Gravar checkpoint a cada N notas (padrão: {DEFAULT_INTERVAL})")
    parser.add_argument("--expected-sha256", dest="expected_sha256", default=None,
                        help="SHA-256 esperado do arquivo JSON (hex, 64 chars)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Simula importação sem escrever arquivos")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
