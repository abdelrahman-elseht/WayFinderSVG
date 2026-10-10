<!-- memory tiers: see the stow skill; default pinned -->

# Repository memory

This is the compact map of the current B03 wayfinding workspace. It records durable facts and points to the document that owns each detail. Read it when extending a floor, the graph, or the application; otherwise follow the trigger list in `AGENTS.md`.

## Current state

- The accepted source packs now cover **Building B03 Ground Floor** (`GF`), **First Floor** (`01`), and **Second Floor** (`02`). GF's two root PDFs are overlapping parts of one floor; First Floor has two aligned source sheets; Second Floor intentionally has only the supplied Part 02 sheet.
- The accepted GF bundle contains 54 directory rooms, source-derived candidate geometry, a drawing-based graph, bilingual content, and an explicit Main Entrance planning default. Physical kiosk position, metre scale, public access, and wheelchair suitability remain unknown.
- `B03_First_Floor/` and `B03_Second_Floor/` are verified source-evidence packs, not runtime semantic bundles. They contain unchanged PDFs, extracted vectors/text, cleaned SVGs, schedules, alignment/validation/manifest metadata, inspection images, and deterministic rebuild scripts. Do not advertise runtime floor options until semantic bundles, floor-scoped graph evidence, registry imports, and browser checks exist.
- The shared registry and validator are multi-floor aware, but the app entry point currently imports only `B03/GF`; the UI floor selector consequently has one option.

## Read by task

| Task | Source of truth |
| --- | --- |
| Product scope, commands, ownership | `README.md`, `docs/PROJECT_SPEC.md` |
| Source PDF inspection, transforms, hashes, layer policy | `docs/SOURCE_AUDIT.md`, `maps/B03/GF/alignment.json`, `scripts/map-ingest/config.json` |
| Room inventory, candidate contours, door/approach evidence | `docs/SEMANTIC_REVIEW.md`, `data/buildings/B03/GF.review.json`, `scripts/semantic-map/navigation-config.json` |
| JSON contract and evidence states | `docs/DATA_CONTRACTS.md`, `packages/map-engine/src/types.ts`, `packages/map-engine/src/validate.ts` |
| Route safety and instructions | `packages/routing/README.md`, `packages/routing/src/geometry-safety.ts`, `packages/routing/src/index.ts` |
| Accepted work, known limits, QA and release | `docs/EXECUTION_LOG.md`, `docs/KNOWN_ISSUES.md`, `docs/QA_REPORT.md`, `docs/DEPLOYMENT.md` |
| Repeatable F1/F2 work order | `docs/FLOOR_ONBOARDING.md` |
| Two-floor spec-plan handoff and QA evidence protocol | `docs/handoffs/B03_FLOOR_01_02_SPEC_PLANS_HANDOFF.md` |

## GF pipeline and file map

The established flow is:

```text
root PDFs
  -> scripts/map-ingest/config.json + ingest.py
  -> maps/B03/GF/source + alignment.json + master.svg + inspection/
  -> scripts/semantic-map/{explore.py,navigation-config.json,drawing_graph.py,generate.py}
  -> data/buildings/B03/GF*.json + content/B03/GF.json + review artifacts
  -> scripts/integration/pipeline.mjs / packages/map-engine validator
  -> apps/web/public/maps/B03/GF/master.svg
  -> apps/web/app/page.tsx + WayfindingApp
```

For every future floor, keep the same bundle shape and stable IDs:

```text
maps/B03/<floorId>/{source,inspection,alignment.json,master.svg,manifest.json,validation.json}
data/buildings/B03/<floorId>.json
data/buildings/B03/<floorId>.graph.json
data/buildings/B03/<floorId>.review.json
content/B03/<floorId>.json
apps/web/public/maps/B03/<floorId>/master.svg   # copied by prepare:maps
```

`data/`, `content/`, review JSON/PNGs, and the public SVG are generated outputs. Edit source PDFs and generator configuration, then regenerate. Never hand-edit generated floor data as a durable fix.

## Routing guardrail

The route is a source-evidenced corridor/approach graph, not a line between room centers. A usable edge must begin and end at graph nodes, have geometry whose endpoints match those nodes, and stay completely inside the union of `navigableAreas`. It must have no crossing, touching, or collinear overlap with `walls`. The semantic generator must also exclude room solids, voids, and exterior gaps from those areas; a route that cuts through a building wall, room footprint, enclosure, or unmapped void is invalid even when its endpoints are valid.

GF uses `routingPolicy: "drawing-based"`: candidate source geometry may produce a plan route after these checks, while candidate/unknown provenance and physical-access uncertainty remain visible. Closed links, invalid geometry, missing enclosure evidence, and unknown accessibility under `accessibleOnly` remain rejected. Room centroids are label anchors and never route endpoints. Qualified or incomplete endpoints carry bilingual `navigationNote`/`navigationPartial` disclosures.

## F1/F2 readiness facts

The source packs are ready for semantic extraction, but F1/F2 runtime bundles are not yet implemented:

- Floor 01 (`B03_First_Floor/`) has 59 schedule rows (`F-01`…`F-59`), two aligned sheets, viewBox `[580,315,2910,1585]`, scale `0.75`, translation `[1444.55,182.41]`, seam `x=2055`, six alignment anchors, maximum residual `0.01271`, 442 overlap matches, and unknown metric calibration.
- Floor 02 (`B03_Second_Floor/`) has 27 schedule rows (`S-01`…`S-27`), one verified `0002` sheet, no merge/seam, sideways primary `master.svg` viewBox `0 0 2100 1840`, an upright/reference companion, and unknown metric calibration. The missing Part 01 geometry is intentionally not invented.
- Both packs have passed their local deterministic rebuild and validation checks; their inspection images are the source visual evidence for spec planning.

The following current files are GF-specific and must be parameterized or given a per-floor configuration before adding F1/F2:

- `scripts/map-ingest/config.json`, `ingest.py`, and `validate.py` select GF PDFs and write `maps/B03/GF`.
- `scripts/semantic-map/explore.py`, `generate.py`, `features.py`, `drawing_graph.py`, `verify.py`, `verify_navigation.py`, `verify_topology.py`, `check_routes.mjs`, and `navigation-config.json` use GF paths/IDs and GF-specific room logic.
- `apps/web/app/page.tsx` imports only the GF floor, and `apps/web/components/WayfindingApp.tsx` receives one bundle and renders one floor option.
- `packages/map-engine/src/registry.ts` and `scripts/integration/pipeline.mjs` already scan/validate multiple bundles; use those seams rather than inventing a second registry.

Implement F1/F2 in this order:

1. Confirm source sheet identity, floor IDs/levels, PDF names, coordinate frame, crop, seam/alignment anchors, and calibration status.
2. Produce a deterministic per-floor vector bundle and source audit before extracting rooms.
3. Generate per-floor rooms, content, approach nodes, navigable areas, walls, review evidence, and route matrix with the same provenance rules as GF.
4. Register every validated bundle in the server page and make the UI's active floor/building state explicit. Keep the configured floor and kiosk IDs consistent across the complete registry.
5. Add vertical nodes/edges only when the drawings support the stair/elevator connection and the contract can validate obstacles per floor. The v1 graph stores walls/areas without floor scope, so a constrained graph spanning floors intentionally fails closed today.
6. Test same-floor routes for each new floor, then cross-floor routes, bilingual partial/qualified endpoints, floor switching, reset/custom start, accessible-only behavior, and production build.

The detailed checklist, expected artifacts, and acceptance gates are in `docs/FLOOR_ONBOARDING.md`.

## Commands that matter

```text
npm run validate:data   # validate every existing floor bundle and its SVG viewBox
npm run test:data       # malformed-data rejection checks
npm run typecheck
npm test
npm run pipeline        # regenerate GF/source-derived outputs; requires Python deps
npm run prepare:maps    # validate then copy canonical SVGs to the web public path
npm run build
```

Run `npm run pipeline` only after changing source inputs or semantic configuration. For a documentation-only change, `git diff --check` plus the relevant validation is sufficient.
