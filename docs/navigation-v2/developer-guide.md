# Navigation V2 developer guide

## Environment

Use the supported Node/npm versions in `README.md` and Python 3.10+. Python needs Shapely 2.1.2 (plus repository semantic-map requirements). Install into `.venv`:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

The current verified run used system Python 3.12.10 and Shapely 2.1.2 because this worktree has no `.venv`. In PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`.

## Regenerate and inspect

```powershell
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/diagnose_centerlines.py
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/verify_centerline_candidate.py
npm.cmd test -- tests/integration/navigation-v2-routing.qa.test.ts
```

The scripts write only diagnostic outputs under `artifacts/navigation-v2/`; they never change `data/buildings/B03/GF.graph.json` or runtime imports. Do not use `npm run pipeline` as a V2 generator. `connectivity-diagnostics.json` holds component/candidate/gap evidence; `reconstruction-report.json` and `unresolved-approaches.json` hold attachment evidence; `candidate-validation.json` is the strict safety and connectivity result; `route-benchmark.json` is emitted by the TypeScript route integration test.

For a complete final QA run use:

```powershell
npm.cmd run validate:data
npm.cmd run test:data
npm.cmd run typecheck
npm.cmd test -- tests/integration/navigation-v2-routing.qa.test.ts tests/integration/visual-corners.qa.test.ts
```

The four pre-existing corner tests must be compared with their baseline. Do not relax their assertions. Browser capture commands, browser version, viewport, URL and screenshots are documented in `benchmark.md` and the screenshot index once the delegated capture completes.

## Reviewing geometry

Open `maps/B03/GF/master.svg` alongside the evidence-linked SVG/PNG diagnostics. Stable `C-*`, `R-*`, `S-*`, `GAP-*`, and `J-*` identifiers link line pieces, raw descendants, configured spines, excluded geometry and endpoint candidates. For each proposed segment review the full coordinates and its exact area, wall, and room-interior tests. `safe` means only geometrically contained; a connection between separate components stays `not-authorized` without source support.

For room endpoints inspect the matching record in `reconstruction-report.json`: source ID/point, original qualification and partial note, shared approach identities, chosen connector or exact unresolved reason, and graph component. Unknown restrictions/accessibility and partial-route notes are retained. Directory visibility is not access evidence.

## Debugging

A direct connector fails if the complete line is not covered by the exact navigable union, contacts a supplied wall, or crosses a room interior. A local A* result is only a proposed local connector and is independently checked after simplification. Do not raise a tolerance or expand polygons to force a pass. Inspect the source plan and semantic review; edit only source-backed spine configuration after evidence review, then regenerate all diagnostic artifacts and rerun the strict checks.

Runtime promotion requires a separate deliberate change after full connectivity, route-quality, alternative-route, source-review, and regression gates pass. V2 remains diagnostic-only while any gate fails.
