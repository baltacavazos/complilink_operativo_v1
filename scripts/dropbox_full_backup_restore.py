import argparse
import json
import os
import tarfile
from pathlib import Path

import dropbox
from dropbox.files import FileMetadata, FolderMetadata


def list_remote_files(dbx: dropbox.Dropbox, remote_folder: str) -> list[FileMetadata]:
    result = dbx.files_list_folder(remote_folder, recursive=True)
    files: list[FileMetadata] = []

    while True:
        for entry in result.entries:
            if isinstance(entry, FileMetadata):
                files.append(entry)
            elif isinstance(entry, FolderMetadata):
                continue
        if not result.has_more:
            break
        result = dbx.files_list_folder_continue(result.cursor)

    return files


def extract_archive(archive_path: Path, destination_dir: Path) -> Path:
    extract_dir = destination_dir / archive_path.name.removesuffix(".tar.gz")
    extract_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(path=extract_dir)
    return extract_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descarga un respaldo completo desde Dropbox y opcionalmente lo extrae."
    )
    parser.add_argument("remote_folder", help="Carpeta remota de Dropbox que contiene el respaldo")
    parser.add_argument("destination_dir", help="Carpeta local donde se restaurará el respaldo")
    parser.add_argument(
        "--pattern",
        help="Descarga solo archivos cuyo nombre contenga este texto; útil para validar manifiestos o restauraciones parciales",
    )
    parser.add_argument(
        "--extract",
        action="store_true",
        help="Extrae automáticamente cualquier archivo .tar.gz descargado",
    )
    args = parser.parse_args()

    api_key = os.environ.get("DROPBOX_API_KEY")
    if not api_key:
        raise SystemExit("DROPBOX_API_KEY no disponible")

    remote_folder = args.remote_folder.rstrip("/")
    destination_dir = Path(args.destination_dir).expanduser().resolve()
    destination_dir.mkdir(parents=True, exist_ok=True)

    dbx = dropbox.Dropbox(api_key)
    account = dbx.users_get_current_account()

    remote_files = list_remote_files(dbx, remote_folder)
    if args.pattern:
        remote_files = [item for item in remote_files if args.pattern in item.name]

    if not remote_files:
        raise SystemExit("No se encontraron archivos para restaurar con los criterios dados")

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

        if args.extract and local_path.name.endswith(".tar.gz"):
            extracted_dir = extract_archive(local_path, destination_dir)
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
                "downloaded_count": len(restored),
                "restored": restored,
                "extracted": extracted,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
