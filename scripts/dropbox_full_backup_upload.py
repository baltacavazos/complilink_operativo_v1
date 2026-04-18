import json
import os
import sys
from pathlib import Path

import dropbox
from dropbox.files import CommitInfo, UploadSessionCursor, WriteMode

CHUNK_SIZE = 8 * 1024 * 1024


def upload_large_file(dbx: dropbox.Dropbox, local_path: Path, remote_path: str):
    file_size = local_path.stat().st_size
    with local_path.open("rb") as f:
        if file_size <= CHUNK_SIZE:
            metadata = dbx.files_upload(
                f.read(),
                remote_path,
                mode=WriteMode("overwrite"),
                mute=True,
            )
            return metadata

        session = dbx.files_upload_session_start(f.read(CHUNK_SIZE))
        cursor = UploadSessionCursor(session_id=session.session_id, offset=f.tell())
        commit = CommitInfo(path=remote_path, mode=WriteMode("overwrite"), mute=True)

        while f.tell() < file_size:
            remaining = file_size - f.tell()
            if remaining <= CHUNK_SIZE:
                metadata = dbx.files_upload_session_finish(
                    f.read(CHUNK_SIZE),
                    cursor,
                    commit,
                )
                return metadata
            dbx.files_upload_session_append_v2(f.read(CHUNK_SIZE), cursor)
            cursor.offset = f.tell()

    raise RuntimeError(f"No se pudo subir {local_path}")


def main():
    if len(sys.argv) < 4:
        raise SystemExit(
            "Uso: python dropbox_full_backup_upload.py <remote_folder> <local_file_1> <local_file_2> ..."
        )

    api_key = os.environ.get("DROPBOX_API_KEY")
    if not api_key:
        raise SystemExit("DROPBOX_API_KEY no disponible")

    remote_folder = sys.argv[1].rstrip("/")
    local_files = [Path(arg).expanduser().resolve() for arg in sys.argv[2:]]

    dbx = dropbox.Dropbox(api_key)
    account = dbx.users_get_current_account()

    uploaded = []
    for local_file in local_files:
        if not local_file.exists():
            raise FileNotFoundError(str(local_file))
        remote_path = f"{remote_folder}/{local_file.name}"
        metadata = upload_large_file(dbx, local_file, remote_path)
        uploaded.append(
            {
                "local_path": str(local_file),
                "remote_path": remote_path,
                "size": local_file.stat().st_size,
                "rev": getattr(metadata, "rev", None),
            }
        )

    print(
        json.dumps(
            {
                "account_email": getattr(account, "email", None),
                "account_name": getattr(account.name, "display_name", None),
                "remote_folder": remote_folder,
                "uploaded": uploaded,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
