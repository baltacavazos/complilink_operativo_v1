import argparse
import json
import os
import tarfile
from pathlib import Path

import dropbox
from dropbox.files import FileMetadata, FolderMetadata, ListFolderResult

DEFAULT_BACKUP_ROOT = "/AuditaPatron/backups/complilink_operativo_v1"
DEFAULT_RESTORE_ROOT = Path.home() / "dropbox_restores"


def list_remote_entries(dbx: dropbox.Dropbox, remote_folder: str) -> list[FileMetadata | FolderMetadata]:
    result: ListFolderResult = dbx.files_list_folder(remote_folder, recursive=False)
    entries: list[FileMetadata | FolderMetadata] = list(result.entries)

    while result.has_more:
        result = dbx.files_list_folder_continue(result.cursor)
        entries.extend(result.entries)

    return entries


def list_remote_files(dbx: dropbox.Dropbox, remote_folder: str) -> list[FileMetadata]:
    result = dbx.files_list_folder(remote_folder, recursive=True)
    files: list[FileMetadata] = []

    while True:
        for entry in result.entries:
            if isinstance(entry, FileMetadata):
                files.append(entry)
        if not result.has_more:
            break
        result = dbx.files_list_folder_continue(result.cursor)

    return files


def resolve_remote_folder(
    dbx: dropbox.Dropbox,
    remote_folder: str | None,
    backup_root: str,
    backup_name: str | None,
) -> str:
    if remote_folder:
        return remote_folder.rstrip("/")

    if backup_name:
        return f"{backup_root.rstrip('/')}/{backup_name}"

    entries = list_remote_entries(dbx, backup_root.rstrip("/"))
    candidate_folders = sorted(
        [entry.name for entry in entries if isinstance(entry, FolderMetadata)],
        reverse=True,
    )

    if not candidate_folders:
        raise SystemExit(
            f"No se encontraron respaldos dentro de {backup_root}. Usa remote_folder o --backup-name."
        )

    return f"{backup_root.rstrip('/')}/{candidate_folders[0]}"


def resolve_destination_dir(
    destination_dir_arg: str | None,
    destination_dir_option: str | None,
    remote_folder: str,
) -> Path:
    raw_destination = destination_dir_option or destination_dir_arg
    if raw_destination:
        return Path(raw_destination).expanduser().resolve()

    backup_name = remote_folder.rstrip("/").split("/")[-1]
    return (DEFAULT_RESTORE_ROOT / backup_name).expanduser().resolve()


def safe_extract_archive(archive_path: Path, destination_dir: Path) -> Path:
    extract_dir = destination_dir / archive_path.name.removesuffix(".tar.gz")
    extract_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(archive_path, "r:gz") as tar:
        for member in tar.getmembers():
            member_path = (extract_dir / member.name).resolve()
            if not str(member_path).startswith(str(extract_dir.resolve())):
                raise RuntimeError(f"Ruta insegura detectada al extraer {member.name}")
        tar.extractall(path=extract_dir)

    return extract_dir


def should_extract(file_name: str, extract_mode: str) -> bool:
    if not file_name.endswith(".tar.gz"):
        return False
    if extract_mode == "never":
        return False
    return extract_mode in {"auto", "always"}


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Restaura respaldos de Dropbox con un flujo guiado. Puedes indicar una carpeta remota exacta "
            "o dejar que el script tome el respaldo más reciente dentro del root configurado."
        )
    )
    parser.add_argument(
        "remote_folder",
        nargs="?",
        help="Carpeta remota exacta del respaldo en Dropbox. Si se omite, se usa --backup-name o el respaldo más reciente.",
    )
    parser.add_argument(
        "destination_dir_arg",
        nargs="?",
        help="Ruta local destino. Si se omite, se crea una carpeta bajo ~/dropbox_restores/.",
    )
    parser.add_argument(
        "--backup-root",
        default=DEFAULT_BACKUP_ROOT,
        help="Raíz remota donde viven los respaldos del proyecto. Se usa con --backup-name o para elegir el respaldo más reciente.",
    )
    parser.add_argument(
        "--backup-name",
        help="Nombre de la subcarpeta del respaldo que quieres restaurar, por ejemplo 2026-04-18_full.",
    )
    parser.add_argument(
        "--destination-dir",
        help="Ruta local destino en formato explícito. Tiene prioridad sobre el segundo argumento posicional.",
    )
    parser.add_argument(
        "--pattern",
        help="Descarga solo archivos cuyo nombre contenga este texto; útil para validar manifiestos o restauraciones parciales.",
    )
    parser.add_argument(
        "--extract-mode",
        choices=["auto", "always", "never"],
        default="auto",
        help="Controla si los .tar.gz descargados se extraen automáticamente. Por defecto: auto.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra qué se restauraría sin descargar archivos.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("DROPBOX_API_KEY")
    if not api_key:
        raise SystemExit("DROPBOX_API_KEY no disponible")

    dbx = dropbox.Dropbox(api_key)
    account = dbx.users_get_current_account()

    remote_folder = resolve_remote_folder(
        dbx=dbx,
        remote_folder=args.remote_folder,
        backup_root=args.backup_root,
        backup_name=args.backup_name,
    )
    destination_dir = resolve_destination_dir(
        destination_dir_arg=args.destination_dir_arg,
        destination_dir_option=args.destination_dir,
        remote_folder=remote_folder,
    )
    destination_dir.mkdir(parents=True, exist_ok=True)

    remote_files = list_remote_files(dbx, remote_folder)
    if args.pattern:
        remote_files = [item for item in remote_files if args.pattern in item.name]

    if not remote_files:
        raise SystemExit("No se encontraron archivos para restaurar con los criterios dados")

    planned_files = [
        {
            "remote_path": item.path_display,
            "relative_path": item.path_lower.removeprefix(remote_folder.lower()).lstrip("/"),
            "size": item.size,
        }
        for item in remote_files
    ]

    if args.dry_run:
        print(
            json.dumps(
                {
                    "account_email": getattr(account, "email", None),
                    "account_name": getattr(account.name, "display_name", None),
                    "remote_folder": remote_folder,
                    "destination_dir": str(destination_dir),
                    "pattern": args.pattern,
                    "extract_mode": args.extract_mode,
                    "dry_run": True,
                    "downloaded_count": 0,
                    "planned_count": len(planned_files),
                    "planned_files": planned_files,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    restored = []
    extracted = []

    for remote_file in remote_files:
        relative_path = remote_file.path_lower.removeprefix(remote_folder.lower()).lstrip("/")
        local_path = destination_dir / relative_path
        local_path.parent.mkdir(parents=True, exist_ok=True)
        dbx.files_download_to_file(str(local_path), remote_file.path_display)

        restored.append(
            {
                "remote_path": remote_file.path_display,
                "local_path": str(local_path),
                "size": remote_file.size,
                "rev": remote_file.rev,
            }
        )

        if should_extract(local_path.name, args.extract_mode):
            extracted_dir = safe_extract_archive(local_path, destination_dir)
            extracted.append(
                {
                    "archive": str(local_path),
                    "destination": str(extracted_dir),
                }
            )

    print(
        json.dumps(
            {
                "account_email": getattr(account, "email", None),
                "account_name": getattr(account.name, "display_name", None),
                "remote_folder": remote_folder,
                "destination_dir": str(destination_dir),
                "pattern": args.pattern,
                "extract_mode": args.extract_mode,
                "dry_run": False,
                "downloaded_count": len(restored),
                "planned_count": len(planned_files),
                "restored": restored,
                "extracted": extracted,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
