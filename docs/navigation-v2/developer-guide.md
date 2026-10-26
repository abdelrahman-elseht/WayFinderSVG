# Navigation V2 developer guide

## Environment

Use the repository's supported Node/npm setup described in the root README. The reconstruction scripts require Python 3.10+ and Shapely 2.1. The semantic-map requirements pin Shapely 2.1.2, Pillow, and NumPy; this reconstruction directly uses Shapely. Install the repository Python dependencies into `.venv`:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

## Reproduce diagnostics and graph

From the repository root, run:

```powershell
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/diagnose_centerlines.py
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py
```

macOS/Linux:

```sh
.venv/bin/python -X utf8 scripts/semantic-map/diagnose_centerlines.py
.venv/bin/python -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py
```

The scripts overwrite the corresponding files in `artifacts/navigation-v2/`. They do not update the runtime graph. Inspect `spine-components.svg`, then review JSON candidate/rejection records and the reconstruction report. `npm run validate:data`, `npm run test:data`, `npm run typecheck`, and relevant Vitest checks validate the current application data/code; they do not by themselves certify the candidate graph. Do not run `npm run pipeline` to generate V2: it runs the existing source pipeline, not the independent reconstruction scripts.

## Updating a building or floor

The current implementation is GF-specific in its data reads and assumptions. To work on another floor, first provide that floor's verified navigable-area union, supplied walls, source-backed spine config, endpoint identities, and semantic review. Then parameterize paths and IDs, add floor-scoped fixtures, and test deterministic output and geometric invariants. Do not copy GF coordinates, tolerance assumptions, or room access semantics to another floor.

When updating GF corridor geometry, change only evidence-backed spines in `scripts/semantic-map/navigation-config.json`; do not edit architectural source data to make a candidate pass. Re-run the diagnostic and reconstruction commands, compare reports, and inspect changed links in the SVG and source plan. Any new connection must retain a traceable source basis and pass the walkable/wall checks.

## Debugging a missing or incorrect connection

1. Locate component IDs and endpoints in `spine-components.svg`.
2. Find their candidate records in `connectivity-diagnostics.json`. Check the endpoint coordinates, distance, and whether validation says `outside-walkable-domain` or `wall-contact`.
3. Inspect the source-derived master and the semantic review around the coordinate. Distinguish a numerical near-miss from missing spine geometry, an intentional separation, or unresolved source evidence.
4. For room joins, inspect the `unresolved` entry in `reconstruction-report.json`, the room's `doorNodeId`, its source endpoint definition, and the walkable/wall geometry around the point.
5. Add geometry only when supported by reviewed evidence. Rerun both scripts and verify that no invalid geometry was admitted and no alternative route was accidentally removed.

The latest strict verifier reports missing graph node IDs for G-06, G-17, G-19, G-20, G-21, G-28, G-39, and G-40. The reconstruction report specifically records failed connector searches for G-39 and G-40 at a shared coordinate; this does not establish two independently connectable passages. See [graph-generation](graph-generation.md) and [benchmark](benchmark.md).

## Routing changes and promotion

The app continues to use the existing TypeScript Dijkstra router and canonical runtime graph. The Python script is preprocessing only. If the generated graph is ever considered for runtime use, first adapt and validate its contract, preserve unknown access/restriction classifications and partial-route semantics, compare route behavior against legacy, and prove all 54 approaches have supported connectivity. Then run data validation, data self-tests, typecheck, and relevant Vitest/browser checks. Runtime promotion, browser tests, and e2e are outside the current diagnostic stage.
