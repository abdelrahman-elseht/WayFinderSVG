# B03 - Ground Floor (GF) | Clean Vector Evidence Pack

This folder gives the Ground Floor the same self-contained source-pack shape as `B03_First_Floor/` and `B03_Second_Floor/`. It is an audit and handoff pack. The runtime canonical outputs remain under `maps/B03/GF/`, and semantic/runtime data remains under `data/buildings/B03/GF*` and `content/B03/GF.json`.

## Contents

- `master.svg` - cleaned, merged vector plan used as the evidence-pack presentation copy.
- `inspection/` - full source-sheet and merged-plan previews.
- `source/0001.json`, `source/0002.json` - complete extracted text, paths, layers, coordinates, and source metadata.
- `source/room-schedule.json` and `room-schedule.json` - the source schedule for G-01 through G-54.
- `alignment.json` - transforms, seam, viewBox, anchors, layer allowlist, source hashes, and calibration status.
- `validation.json` - deterministic source and vector checks.
- `manifest.json` - SHA-256 inventory for this pack.
- `source/pdfs/` - byte-for-byte mirrors of the two original root PDFs.
- `scripts/rebuild.py` - refreshes the canonical GF source pipeline, then mirrors its outputs into this pack.

The two PDFs are overlapping parts of one floor. Source coordinates are normalized once from PDF display coordinates into the merged master frame. Physical scale and kiosk placement remain unknown.

## Rebuild

Install the pinned Python dependencies from the repository, then run from this directory or the repository root:

```powershell
python B03_Ground_Floor/scripts/rebuild.py
```

The wrapper verifies and refreshes the root PDF mirrors, runs `scripts/map-ingest/ingest.py` and `scripts/map-ingest/validate.py`, copies the resulting canonical GF source artifacts here, and rewrites this pack's manifest. It never edits the original PDF bytes and does not replace the canonical runtime paths.

## Source and routing limits

This is floor-plan evidence, not a surveyed building model. Candidate room geometry stays candidate; unresolved outlines use source-label markers. Routes must use source-derived approach nodes, remain inside the graph's navigable-area union, and have no wall contact or room/void shortcut. Drawing-based routes preserve unknown physical access and accessibility status. See `docs/SOURCE_AUDIT.md`, `docs/SEMANTIC_REVIEW.md`, `docs/DATA_CONTRACTS.md`, and `memory.md`.
