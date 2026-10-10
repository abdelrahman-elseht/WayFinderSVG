#!/usr/bin/env python3
"""Refresh the canonical GF source pipeline and mirror its evidence pack.

The repository's map-ingest scripts remain the generator of record. This wrapper
keeps the Ground Floor source pack shaped like the Floor 01 and Floor 02 packs
without changing the existing runtime paths or source provenance.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
REPO = PACK.parent
CANONICAL = REPO / "maps" / "B03" / "GF"
PDF_NAMES = [
    "2761-SOD-B03-DWG-AAR-15-GF-Z-0001-01.pdf",
    "2761-SOD-B03-DWG-AAR-15-GF-Z-0002-01.pdf",
]
MIRRORED = [
    "master.svg",
    "alignment.json",
    "validation.json",
    "source/0001.json",
    "source/0002.json",
    "source/room-schedule.json",
    "inspection/0001.png",
    "inspection/0002.png",
    "inspection/master.png",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def main() -> None:
    # The root PDFs remain the pipeline inputs. Refresh the pack copies first so
    # the evidence folder cannot silently drift from the source of record.
    for name in PDF_NAMES:
        source = REPO / name
        if not source.is_file():
            raise FileNotFoundError(source)
        copy_file(source, PACK / "source" / "pdfs" / name)

    subprocess.run([sys.executable, str(REPO / "scripts" / "map-ingest" / "ingest.py")], cwd=REPO, check=True)
    subprocess.run([sys.executable, str(REPO / "scripts" / "map-ingest" / "validate.py")], cwd=REPO, check=True)

    for relative in MIRRORED:
        copy_file(CANONICAL / relative, PACK / relative)
    copy_file(CANONICAL / "source" / "room-schedule.json", PACK / "room-schedule.json")

    files: dict[str, str] = {}
    for path in sorted(PACK.rglob("*")):
        if path.is_file() and path.name != "manifest.json":
            files[path.relative_to(PACK).as_posix()] = sha256(path)
    manifest = {
        "schemaVersion": 1,
        "generator": "B03_Ground_Floor/scripts/rebuild.py",
        "buildingId": "B03",
        "floorId": "GF",
        "canonicalSource": "maps/B03/GF",
        "files": files,
    }
    (PACK / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "folder": str(PACK), "files": len(files)}, indent=2))


if __name__ == "__main__":
    main()
