# Floor expansion runbook

Use this runbook when adding B03 Floor 1 or Floor 2. It follows the accepted Ground Floor pipeline and names the current GF-specific seams that must be generalized before new source data can be registered.

## 0. Freeze the floor identity

Before extracting anything, record the source PDF filenames, drawing title, floor ID, numeric level, sheet count, and whether sheets are parts of one floor. Use stable IDs across every file. The examples below use `GF`, `F1`, and `F2`; replace them if the source naming requires another documented convention.

Create a short source note in the floor's audit record covering:

- PDF page rotation and displayed coordinate orientation.
- Per-sheet transforms into the floor master coordinate frame.
- Crop/viewBox and seam or overlap anchors.
- Included architectural layers and excluded annotation/title-block material.
- Calibration status and the reason it is unknown when no verified endpoints/scale exist.

Keep original PDFs unchanged and outside the public asset path.

## 1. Build the source bundle

Start from the GF output shape, not from a hand-drawn SVG:

```text
maps/B03/<floorId>/
  source/<sheet>.json
  source/room-schedule.json
  inspection/<sheet>.png
  inspection/master.png
  alignment.json
  master.svg
  manifest.json
  validation.json
```

Parameterize the current GF-only inputs in `scripts/map-ingest/` so a floor run selects its own configuration, output directory, source list, layer policy, anchors, and expected schedule. The extraction contract remains the same: displayed PDF coordinates are transformed once into master coordinates; raw source primitives remain available for provenance; the cleaned SVG is vector-only.

Run the source repeatability and review checks before semantic work. A floor is ready for step 2 only when source hashes, transforms, anchors, viewBox, and original-PDF preservation are recorded.

## 2. Generate semantic rooms and content

For the new floor, generate these siblings together:

```text
data/buildings/B03/<floorId>.json
data/buildings/B03/<floorId>.graph.json
data/buildings/B03/<floorId>.review.json
content/B03/<floorId>.json
```

Each room needs a stable `B03-<floorId>-<code>` ID, bilingual name, content reference, public-directory decision, evidence status, and source provenance. Use `polygon: null` and a source-label marker when a closed outline is not evidenced. The `centroid` field is a label anchor; it is never a door or route endpoint.

For every navigable destination, derive a source-backed door or mapped approach node. If the drawing stops at a suite, exterior landing, landmark, or shared foyer, set a bilingual `navigationNote`; set `navigationPartial` when the final source connection is missing. Do not turn a room schedule name, a guessed doorway, or a visual center into an access claim.

Generate placeholder descriptions and explicit null images in `content/`. Arabic text may be a documented translation of clear source text; unresolved terminology stays qualified in provenance.

## 3. Generate and reject unsafe graph geometry

The graph must contain the floor's own `walls` and `navigableAreas` plus source-derived nodes and edges. Keep the policy explicit (`drawing-based` when candidate source geometry is intentionally usable). For each edge:

1. Its first/last geometry points equal the `from`/`to` node points.
2. Its declared distance matches the drawing polyline in `map-unit`, unless confirmed calibration supports metres.
3. Every segment lies in the complete navigable-area union.
4. No segment crosses, touches, or overlaps a supplied wall.
5. The generator excludes room solids, voids, blocked enclosures, and unmapped exterior gaps from navigable areas.
6. Closed links are rejected; unknown accessibility remains unknown and is excluded by accessible-only routing.

This is the guard against routes that appear to cut through a building, room, wall, or void. Endpoint checks or a single midpoint are insufficient for concave areas and gaps. Preserve rejected candidates and their evidence in the review JSON instead of repairing them by moving points or loosening constraints.

Run independent topology checks and an all-pairs route matrix for the floor. Positive synthetic fixtures belong under `tests/fixtures` and must never be copied into live B03 data.

## 4. Register the floor in the application

The current `packages/map-engine/src/registry.ts` and `scripts/integration/pipeline.mjs` already support scanning multiple floor bundles. Extend the application seam deliberately:

- Import each validated `floorData`, graph, and content bundle in `apps/web/app/page.tsx` and pass all bundles to `createMapRegistry`.
- Resolve `WAYFINDING_BUILDING_ID`, `WAYFINDING_FLOOR_ID`, and an optional existing kiosk ID against that complete registry.
- Refactor `WayfindingApp` to receive the registry/floor catalog or an equivalent validated selection model; the current single-bundle prop cannot populate a real multi-floor selector.
- Keep the active floor explicit in route state. Reset destination/start when changing floors unless a validated vertical journey is being followed.
- Copy each canonical SVG with `npm run prepare:maps`; do not import source extraction JSON into the browser.

Do not expose F1/F2 by adding labels alone. A floor option is valid only after its bundle passes the shared validator and its public map asset exists.

## 5. Connect floors safely

Same-floor routing can use the existing drawing-based checks. Cross-floor routing needs more evidence and a contract update:

- Identify the same physical stair/elevator on adjacent floors with source provenance on every endpoint.
- Add vertical node/edge types with explicit `stairs` or `elevator` path types, floor IDs, distance units, restriction, and accessibility status.
- Scope `walls` and `navigableAreas` to their floor (or version the graph contract to hold per-floor constraints). The current v1 arrays have no floor identifier and therefore reject constrained multi-floor graphs rather than applying one floor's walls to another.
- Validate each horizontal segment against its own floor's enclosure. Validate vertical links as transitions; never project them through a 2D floor polygon.
- Test both directions, disconnected/closed vertical links, accessible-only exclusion of stairs/unknown lifts, and bilingual floor-change instructions.

Keep current behavior fail-closed until this contract and evidence exist. A drawing that merely shows a stair symbol is not enough to claim a connected route between floors.

## 6. Acceptance checklist

Before calling a new floor ready:

- Source and generated outputs are deterministic and traceable to unchanged PDFs.
- `validateFloorBundle` and `npm run validate:data` pass for every registered floor.
- Rooms, content references, graph nodes, edges, and map asset IDs agree on building/floor IDs.
- The route matrix has expected same-floor coverage and no wall/outside/room-solid shortcuts.
- Candidate, unknown, qualified, and partial endpoints are visible in English and Arabic.
- Floor switching, custom start/reset, configured kiosk fallback, keyboard access, RTL, reduced motion, and accessible-only behavior pass.
- `npm run test:data`, `npm run typecheck`, `npm test`, relevant browser tests, and `npm run build` pass.
- QA and known limitations name any unresolved source gap; a passing build is not facility approval.
