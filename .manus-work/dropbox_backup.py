from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

PROJECT_PATH = Path("/home/ubuntu/complilink_operativo_v1")
WORK_DIR = PROJECT_PATH / ".manus-work"
LOCAL_BACKUP_DIR = WORK_DIR / "backups"
DROPBOX_FOLDER = "/Backups/AuditaPatron"
API_CONTENT = "https://content.dropboxapi.com/2/files"
API_RPC = "https://api.dropboxapi.com/2/files"
LATEST_README_PATH = f"{DROPBOX_FOLDER}/README.md"
KEEP_BACKUPS = 5
CHUNK_SIZE = 8 * 1024 * 1024
TIME_FORMAT = "%Y%m%d_%H%M"
BACKUP_RE = re.compile(r"AuditaPatron_backup_(\d{8}_\d{4})\.zip$")
README_RE = re.compile(r"AuditaPatron_backup_(\d{8}_\d{4})_README\.md$")
CONFIG_DOCS = ["README.md", "CONFIGURACION.md", "ARQUITECTURA.md"]
THIRD_PARTY_SERVICES = [
    "Dropbox",
    "MySQL/TiDB",
    "S3",
    "Manus OAuth",
    "OpenAI",
    "Gemini",
    "Grok",
    "Resend",
]


@dataclass
class DropboxEntry:
    name: str
    path_lower: str
    server_modified: str | None


def get_token() -> str:
    token = os.environ.get("DROPBOX_API_KEY", "").strip()
    if not token:
        raise RuntimeError("DROPBOX_API_KEY no está configurada")
    return token


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def ensure_folder(token: str, path: str) -> None:
    resp = requests.post(
        f"{API_RPC}/create_folder_v2",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json={"path": path, "autorename": False},
        timeout=60,
    )
    if resp.status_code == 409:
        return
    resp.raise_for_status()


def list_folder(token: str, path: str) -> list[DropboxEntry]:
    resp = requests.post(
        f"{API_RPC}/list_folder",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json={"path": path},
        timeout=60,
    )
    if resp.status_code == 409:
        return []
    resp.raise_for_status()
    data = resp.json()
    entries = [
        DropboxEntry(
            name=item["name"],
            path_lower=item["path_lower"],
            server_modified=item.get("server_modified"),
        )
        for item in data.get("entries", [])
        if item.get(".tag") == "file"
    ]
    while data.get("has_more"):
        resp = requests.post(
            f"{API_RPC}/list_folder/continue",
            headers={**auth_headers(token), "Content-Type": "application/json"},
            json={"cursor": data["cursor"]},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        entries.extend(
            DropboxEntry(
                name=item["name"],
                path_lower=item["path_lower"],
                server_modified=item.get("server_modified"),
            )
            for item in data.get("entries", [])
            if item.get(".tag") == "file"
        )
    return entries


def delete_file(token: str, path: str) -> None:
    resp = requests.post(
        "https://api.dropboxapi.com/2/files/delete_v2",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json={"path": path},
        timeout=60,
    )
    resp.raise_for_status()


def upload_small(token: str, source: Path, dropbox_path: str, mode: str = "add") -> dict[str, Any]:
    with source.open("rb") as fh:
        content = fh.read()
    resp = requests.post(
        f"{API_CONTENT}/upload",
        headers={
            **auth_headers(token),
            "Dropbox-API-Arg": json.dumps(
                {
                    "path": dropbox_path,
                    "mode": mode,
                    "autorename": False,
                    "mute": True,
                }
            ),
            "Content-Type": "application/octet-stream",
        },
        data=content,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def upload_large(token: str, source: Path, dropbox_path: str, mode: str = "add") -> dict[str, Any]:
    session_id = None
    offset = 0
    total_size = source.stat().st_size
    with source.open("rb") as fh:
        first_chunk = fh.read(CHUNK_SIZE)
        resp = requests.post(
            f"{API_CONTENT}/upload_session/start",
            headers={
                **auth_headers(token),
                "Dropbox-API-Arg": json.dumps({"close": False}),
                "Content-Type": "application/octet-stream",
            },
            data=first_chunk,
            timeout=120,
        )
        resp.raise_for_status()
        session_id = resp.json()["session_id"]
        offset = len(first_chunk)

        while offset < total_size:
            chunk = fh.read(CHUNK_SIZE)
            is_last = offset + len(chunk) >= total_size
            if is_last:
                resp = requests.post(
                    f"{API_CONTENT}/upload_session/finish",
                    headers={
                        **auth_headers(token),
                        "Dropbox-API-Arg": json.dumps(
                            {
                                "cursor": {"session_id": session_id, "offset": offset},
                                "commit": {
                                    "path": dropbox_path,
                                    "mode": mode,
                                    "autorename": False,
                                    "mute": True,
                                },
                            }
                        ),
                        "Content-Type": "application/octet-stream",
                    },
                    data=chunk,
                    timeout=120,
                )
                resp.raise_for_status()
                return resp.json()
            resp = requests.post(
                f"{API_CONTENT}/upload_session/append_v2",
                headers={
                    **auth_headers(token),
                    "Dropbox-API-Arg": json.dumps(
                        {
                            "cursor": {"session_id": session_id, "offset": offset},
                            "close": False,
                        }
                    ),
                    "Content-Type": "application/octet-stream",
                },
                data=chunk,
                timeout=120,
            )
            resp.raise_for_status()
            offset += len(chunk)
    raise RuntimeError("La subida grande a Dropbox terminó sin finalizar correctamente")


def upload_file(token: str, source: Path, dropbox_path: str, mode: str = "add") -> dict[str, Any]:
    if source.stat().st_size <= CHUNK_SIZE:
        return upload_small(token, source, dropbox_path, mode=mode)
    return upload_large(token, source, dropbox_path, mode=mode)


def should_skip(path: Path, current_zip_path: Path | None = None) -> bool:
    relative = path.relative_to(PROJECT_PATH)
    parts = relative.parts
    skip_prefixes = {
        ".git",
        ".turbo",
        ".next",
        "node_modules",
        "dist",
    }
    if any(part in skip_prefixes for part in parts):
        return True
    if parts[:2] == (".manus-work", "backups"):
        return True
    if current_zip_path is not None and path == current_zip_path:
        return True
    return False


def make_zip(zip_path: Path) -> dict[str, Any]:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    file_count = 0
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(PROJECT_PATH):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if not should_skip(root_path / d, current_zip_path=zip_path)]
            for file_name in files:
                full_path = root_path / file_name
                if should_skip(full_path, current_zip_path=zip_path):
                    continue
                arcname = full_path.relative_to(PROJECT_PATH)
                zf.write(full_path, arcname.as_posix())
                file_count += 1
    return {
        "zip_path": str(zip_path),
        "file_count": file_count,
        "size_bytes": zip_path.stat().st_size,
    }


def parse_timestamp_from_name(name: str, regex: re.Pattern[str]) -> datetime | None:
    match = regex.search(name)
    if not match:
        return None
    return datetime.strptime(match.group(1), TIME_FORMAT)


def build_backup_snapshot_readme(now: datetime, zip_name: str, previous_latest: str | None, zip_meta: dict[str, Any]) -> str:
    included_docs = "\n".join(f"- `{name}`" for name in CONFIG_DOCS)
    third_party = "\n".join(f"- {name}" for name in THIRD_PARTY_SERVICES)
    if previous_latest:
        changes_text = (
            f"Este respaldo reemplaza como referencia más reciente a `{previous_latest}` y añade documentación operativa actualizada dentro del ZIP."
        )
    else:
        changes_text = "Este es el primer respaldo operativo registrado en Dropbox para esta serie de snapshots."
    return f"""# Snapshot de respaldo {zip_name}

## Resumen

Este snapshot documenta el respaldo generado el **{now.isoformat(timespec='minutes')}** para **AuditaPatron / CompliLink Operativo V1**. El ZIP asociado fue subido a **`{DROPBOX_FOLDER}/{zip_name}`** y resume el estado operativo actual del proyecto.

## Contenido confirmado del respaldo

| Campo | Valor |
| --- | --- |
| Archivo ZIP | `{zip_name}` |
| Archivos empaquetados | `{zip_meta['file_count']}` |
| Tamaño del ZIP | `{zip_meta['size_bytes']}` bytes |
| Carpeta remota | `{DROPBOX_FOLDER}` |
| Retención | `{KEEP_BACKUPS}` respaldos máximos |

## Documentación incluida dentro del ZIP

{included_docs}

## Servicios de terceros activos documentados

{third_party}

## Cambios respecto al respaldo anterior

{changes_text}

## Notas operativas

El ZIP excluye artefactos regenerables y rutas autorreferenciales, en particular `node_modules`, `dist`, `.git`, `.turbo`, `.next` y `.manus-work/backups`. La intención es conservar un respaldo compacto, legible y útil para recuperación operativa.
"""


def enforce_retention(token: str, entries: list[DropboxEntry]) -> dict[str, list[str]]:
    zip_entries = []
    readme_entries = []
    for entry in entries:
        zip_ts = parse_timestamp_from_name(entry.name, BACKUP_RE)
        if zip_ts:
            zip_entries.append((zip_ts, entry))
            continue
        readme_ts = parse_timestamp_from_name(entry.name, README_RE)
        if readme_ts:
            readme_entries.append((readme_ts, entry))

    zip_entries.sort(key=lambda item: item[0], reverse=True)
    readme_entries.sort(key=lambda item: item[0], reverse=True)

    deleted = {"zip": [], "readme": []}
    for _, entry in zip_entries[KEEP_BACKUPS:]:
        delete_file(token, entry.path_lower)
        deleted["zip"].append(entry.name)
    for _, entry in readme_entries[KEEP_BACKUPS:]:
        delete_file(token, entry.path_lower)
        deleted["readme"].append(entry.name)
    return deleted


def main() -> int:
    token = get_token()
    ensure_folder(token, DROPBOX_FOLDER)

    now = datetime.now()
    stamp = now.strftime(TIME_FORMAT)
    zip_name = f"AuditaPatron_backup_{stamp}.zip"
    readme_snapshot_name = f"AuditaPatron_backup_{stamp}_README.md"
    zip_path = LOCAL_BACKUP_DIR / zip_name
    readme_path = PROJECT_PATH / "README.md"
    readme_snapshot_path = WORK_DIR / readme_snapshot_name

    if not readme_path.exists():
        raise RuntimeError("README.md no existe en la raíz del proyecto")

    before_entries = list_folder(token, DROPBOX_FOLDER)
    previous_backups = sorted(
        [entry.name for entry in before_entries if BACKUP_RE.search(entry.name)],
        reverse=True,
    )
    previous_latest = previous_backups[0] if previous_backups else None

    zip_meta = make_zip(zip_path)
    readme_snapshot = build_backup_snapshot_readme(now, zip_name, previous_latest, zip_meta)
    readme_snapshot_path.write_text(readme_snapshot, encoding="utf-8")
    upload_file(token, zip_path, f"{DROPBOX_FOLDER}/{zip_name}", mode="add")
    upload_file(token, readme_snapshot_path, f"{DROPBOX_FOLDER}/{readme_snapshot_name}", mode="add")
    upload_file(token, readme_path, LATEST_README_PATH, mode="overwrite")

    after_entries = list_folder(token, DROPBOX_FOLDER)
    deleted = enforce_retention(token, after_entries)
    remaining_entries = list_folder(token, DROPBOX_FOLDER)
    remaining_backups = sorted(
        [entry.name for entry in remaining_entries if BACKUP_RE.search(entry.name)],
        reverse=True,
    )

    result = {
        "timestamp": now.isoformat(timespec="minutes"),
        "backup_name": zip_name,
        "backup_dropbox_path": f"{DROPBOX_FOLDER}/{zip_name}",
        "readme_snapshot_name": readme_snapshot_name,
        "readme_dropbox_path": f"{DROPBOX_FOLDER}/{readme_snapshot_name}",
        "readme_snapshot_local_path": str(readme_snapshot_path),
        "latest_readme_path": LATEST_README_PATH,
        "previous_backup": previous_latest,
        "deleted_zip_backups": deleted["zip"],
        "deleted_readme_snapshots": deleted["readme"],
        "remaining_zip_backups": remaining_backups,
        "zip_file_count": zip_meta["file_count"],
        "zip_size_bytes": zip_meta["size_bytes"],
        "local_zip_path": str(zip_path),
    }

    output_path = WORK_DIR / "last_dropbox_backup_result.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        error = {"error": str(exc)}
        output_path = WORK_DIR / "last_dropbox_backup_result.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(error, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)
        raise
