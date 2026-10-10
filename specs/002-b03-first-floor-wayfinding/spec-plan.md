# B03 First Floor (01): implementation spec and plan

## Goal and agent instructions

Deliver a complete, source-backed First Floor wayfinding bundle for building `B03`, floor `01`, numeric level `1`. Account for all 59 scheduled rooms, `F-01` through `F-59`, and provide a bilingual directory, cleaned vector map, source-derived illustrative 2.5D room volumes, safe drawing-based same-floor routes, and a working floor selector. Completion means generated data, application integration, independent source/route checks, production browser evidence, and deployment instructions pass the acceptance criteria below. A source pack or an unavailable-only demonstration is not completion.

This is the implementation agent's complete feature handoff. Read [README](../../README.md), [AGENTS](../../AGENTS.md), [memory](../../memory.md), [floor onboarding](../../docs/FLOOR_ONBOARDING.md), and [the First Floor pack README](../../B03_First_Floor/README.md), in that order. Consult [data contracts](../../docs/DATA_CONTRACTS.md), [source audit](../../docs/SOURCE_AUDIT.md), [semantic review](../../docs/SEMANTIC_REVIEW.md), [QA](../../docs/QA_REPORT.md), [known issues](../../docs/KNOWN_ISSUES.md), and [deployment](../../docs/DEPLOYMENT.md) for their owning rules. Repository-relative code paths below resolve from the worktree root. If CodeGraph has a usable index, query it first; an empty `.codegraph/` directory is not an index.

Execute all four phases in order, updating only this file's task and acceptance checkboxes as evidence becomes available. Put research decisions, exceptions, commands/results, and screenshot metadata beneath their owning task here. Do not create companion `spec.md`, `plan.md`, `tasks.md`, research, contract, quickstart, or checklist files. Generated runtime review JSON, tests, and QA artifacts are implementation outputs, not companion planning documents. Preserve the full requested scope; evidence gaps must be named and carried into the product rather than repaired by inventing facts.

User outcomes, in priority order: **US1** selects First Floor and finds source-traceable destinations in English or Arabic; **US2** chooses supported starting/destination approaches and receives a safe route with honest qualifications; **US3** understands the map through consistent raised blocks, labels, and route overlays while retaining keyboard, RTL, reduced-motion, mobile, and audio behavior. All three are required.

Scope is **same-floor routing only**. Floor selection is independent of a physical journey between floors. Do not combine GF/01/02 graphs, infer a stair connection from names, or implement vertical journeys under graph v1. The separate evidence/contract gate is specified in T023.

## Source evidence and file mapping

The two PDFs are parts of one First Floor. Both use page rotation `270°`; extracted coordinates have already been normalized into displayed PDF points, with x right and y down. Sheet `0001` supplies the master frame; apply each display-to-master transform exactly once:

- `0001`: identity `[1,0,0,1,0,0]`; source crop `[600,330,2160,1830]` in left/top/right/bottom order.
- `0002`: `[0.75,0,0,0.75,1444.55,182.41]`, so `x' = 0.75*x + 1444.55`, `y' = 0.75*y + 182.41`; crop `[280,225,2635,2190]`.
- Master viewBox `[580,315,2910,1585]`, seam `x=2055`. The viewBox origin is not zero; do not subtract it from persisted coordinates. Six repeated anchors have maximum residual `0.01271`; 442 overlapping architectural bounding boxes match at 0.1-point quantization. The accepted clean map contains 3,966 source vector paths before rendering/clipping effects.
- Calibration is unknown: `metersPerUnit: null`. PDF point size, the `0.75` sheet alignment factor, and renderer scene units do not establish physical metres or architectural height. A confirmed extraction/alignment does not confirm room access.

| Input/reference | Implementation use and destination |
| --- | --- |
| `B03_First_Floor/source/pdfs/2761-SOD-B03-DWG-AAR-15-01-Z-0001-00.pdf` | Immutable Part 01; accepted SHA-256 `cbcc2829f84f9bb336fb17db0f22d605aeaf710e52a813178e47a66a3f8bda94`. |
| `B03_First_Floor/source/pdfs/2761-SOD-B03-DWG-AAR-15-01-Z-0002-00.pdf` | Immutable Part 02; accepted SHA-256 `882ed490480ecc66adf01d34affb5b56242a7cc47db30761591098f464f561c2`. |
| `B03_First_Floor/source/{0001,0002}.json` | Raw vectors/text/layers, source path/text IDs and bboxes; retain under `maps/B03/01/source/` through the source adapter. Do not publish full extraction. |
| `B03_First_Floor/source/room-schedule.json`, `room-schedule.json` | Authoritative 59-row inventory from Part 01; reconcile every code/name and retain both schedule and plan evidence. |
| `B03_First_Floor/{alignment.json,master.svg,manifest.json,validation.json}` | Reproducible source truth for matching `maps/B03/01/` outputs; carry transforms, exclusions, source hashes, calibration, and vector-only presentation. |
| `B03_First_Floor/inspection/{master.png,0001.png,0002.png,seam-detail.png}` | Visually inspect room boundaries, label associations, openings and the joining region; retain canonical inspection copies. |
| `B03_First_Floor/scripts/rebuild.py` | Pack rebuild, resolved relative to its script; invoke from the root as `python -X utf8 B03_First_Floor/scripts/rebuild.py`. |
| `scripts/map-ingest/floors/01.json` **(new authored config)** | Floor-specific source-pack adapter/configuration; no GF transforms, crop, layer policy, or schedule assumptions. |
| `scripts/semantic-map/floors/01.json` **(new authored config)** | Schedule/label association, translations/categories, contour/door/corridor evidence, availability and origin decisions. Store resolved floor-specific logic here or in a narrowly named adapter. |
| `scripts/map-ingest/`, `scripts/semantic-map/`, `scripts/integration/pipeline.mjs` | Parameterize generation/review entry points; existing GF config and algorithms are references, not Floor 01 facts. |
| `data/buildings/B03/01.json`, `01.graph.json`, `01.review.json` | Generated floor records, drawing-based graph, and per-room evidence/exception review. Stable room IDs: `B03-01-F-01` … `B03-01-F-59`. |
| `data/buildings/B03/01.navigation-validation.review.json`, `01.semantic-review.png` | Generated independent navigation diagnostics and visual semantic overlay, following the GF output shape. |
| `content/B03/01.json` | Generated localized content keyed by stable room/content IDs, with explicit placeholder descriptions and null photos. |
| `packages/map-engine/src/{types.ts,validate.ts,registry.ts}` | Existing authoritative contracts and `validateFloorBundle` / `createMapRegistry` boundaries. |
| `apps/web/app/page.tsx`, `apps/web/components/{WayfindingApp.tsx,FloorMap.tsx}` | Validated imports/catalog, active-floor state, floor selection, shared rendering and UI integration. |
| `apps/web/public/maps/B03/01/master.svg` | Generated copy from canonical master using `npm run prepare:maps`; app asset `/maps/B03/01/master.svg`. |
| `tests/qa/floor_01_source_truth.py`, `tests/integration/floor-01.qa.test.ts`, `tests/integration/floor-01-state.qa.test.tsx` **(new)** | Independent source/geometry, real-router matrix and active-floor regression checks. |
| `tests/e2e/floor-01.qa.spec.ts`, `tests/agentic/floor-01.e2e.ts` **(new)** | Deterministic Playwright acceptance and Army e2e exploration/flows, using separate runner globs. |
| `artifacts/qa/floor-01/` | Floor-owned screenshots, matrices and logs; never overwrite GF or Floor 02 QA evidence. |

GF patterns to inspect: `maps/B03/GF/`, `data/buildings/B03/GF*.json`, `content/B03/GF.json`, `scripts/semantic-map/navigation-config.json`, `packages/routing/src/{geometry-safety.ts,index.ts}`, and `tests/e2e/wayfinding.qa.spec.ts`. Reuse shared contracts and operational intent; do not copy GF room-specific endpoints, numeric category rules, Arabic arrays, or doorway exceptions into Floor 01.

## Acceptance criteria

- [ ] **AC01 — Source fidelity:** both original PDF hashes remain identical; two source rebuilds and two runtime generations match their recorded artifact inventories. Canonical map, transforms, seam, six anchors, calibration and schedule match the accepted pack; source assets remain private.
- [ ] **AC02 — Complete inventory:** all 59 schedule rows reconcile to stable room records or individually evidenced source-status exceptions in `01.review.json`. Default target is 59 room records. No silent omissions, duplicate overlap rooms, invented label coordinates or rewritten source names. Directory count equals actual directory-visible records; any exception is disclosed in QA/known issues.
- [ ] **AC03 — Semantics/content:** every record resolves its bilingual name/content, source IDs/text IDs/bboxes, geometry status and review evidence. Closed contours are source-backed, valid and non-overlapping; unresolved outlines use `polygon: null` with an evidenced plan-label marker. Descriptions/photos, physical kiosk, scale and accessibility retain honest unknown/placeholder states.
- [ ] **AC04 — Safe graph:** supported endpoints are source doors or qualified mapped approaches, never room centroids. Every edge has matching node endpoints, correct map-unit length, complete navigable-union containment, and zero wall crossing, contact or overlap; room solids, voids, enclosure/exterior gaps and unsupported regions are excluded.
- [ ] **AC05 — Coverage and rejection:** actual-router ordered-pair matrix accounts for all 59 schedule entries (3,481 pair classifications, including self-pairs). Supported connected approaches route in both directions where links permit; every unsupported/disconnected pair has an explicit expected reason. Include source-supported cross-seam journeys and adversarial wall/void/room/envelope/closed-link/unknown-accessibility tests. No unsafe shortcut is accepted to increase coverage.
- [ ] **AC06 — Honest routing:** drawing-based candidate status remains visible; qualified/partial endpoint notes and arrival instructions work in both languages, including reversed partial starts. Accessible-only excludes unknown accessibility; unavailable rooms stay in the directory but cannot start or receive a route. No invented metre distance, travel time, kiosk location or cross-floor journey.
- [ ] **AC07 — Consistent 2.5D:** source-backed room blocks use GF's deterministic height/lift language, legible side shading, low circulation, raised selection, labels and route overlay. Unknown contours remain markers. Source ink and semantic/route overlays align at viewBox corners, seam and representative doors across default/mobile views; illustrative height is never presented as surveyed.
- [ ] **AC08 — Real selection:** only validated, imported bundles with prepared SVGs appear as floors. GF↔01 switching replaces map, localized floor name, directory/search/category options, thumbnails, start/destination, route, camera and playback coherently; no stale room/node/audio/texture leaks. Either worktree operates with GF+01 independently of Floor 02.
- [ ] **AC09 — Configuration and interaction:** environment-selected `01`, invalid floor/kiosk IDs, custom-start precedence, no-origin states, reset, route playback/audio, mute/stop and unsupported speech are tested. A GF kiosk/Main Entrance is not used as an upper-floor physical origin.
- [ ] **AC10 — Accessibility and browser evidence:** English/Arabic search and routing, RTL, keyboard selection/focus, reduced motion, forced colors, axe/WCAG AA, WebGL fallback, 390px mobile and 200% text pass. Production screenshots/logs cover default, selection, success, qualification/partial or blocked state, Arabic, mobile and enlarged text, with no app console errors or unexpected failed network requests.
- [ ] **AC11 — Release gate:** all registered bundles pass `validate:data`, `test:data`, typecheck, relevant independent/Python and Vitest checks, Playwright, required agentic QA and production build/browser checks. Commands, outcomes, source exceptions and artifact metadata are recorded under Phase 4; owning QA/known-issues/deployment sections are updated without claiming facility approval.

## Dependencies and parallel-worktree rules

Dependency chain: Phase 1 source gate → Phase 2 semantic/graph gate → Phase 3 shared services, rendering and registry/UI gate → Phase 4 independent QA/build gate. Phase 2 inventory/content work can proceed while shared adapters are being prepared; runtime registration waits for complete validated siblings. A phase gate is a verification checkpoint, not permission to stop early.

| Acceptance criterion | Implementing tasks and required verification |
| --- | --- |
| AC01 | T001–T005, T014, T024: unchanged PDFs, repeatable source/runtime inventories, canonical/public map checks. |
| AC02 | T002, T007–T009, T013, T024: all 59 schedule entries reconciled and actual counts explained. |
| AC03 | T006–T010, T014, T024: traceable geometry/content, independent overlay and contract checks. |
| AC04 | T010–T014, T024: source endpoints, full-polyline containment and independent obstacle rejection. |
| AC05 | T012–T014, T024, T027: 3,481 pair classifications and supported cross-seam browser journeys. |
| AC06 | T009–T014, T018, T021, T023, T027: origin/access/evidence honesty, partial/reversed and filtered outcomes. |
| AC07 | T019–T020, T022, T027, T029: deterministic volume treatment and registered texture/overlay visuals. |
| AC08 | T015–T017, T020, T022, T027–T029: validated catalog/assets and atomic floor-state transitions. |
| AC09 | T016–T018, T021–T022, T027–T028: configured floor/kiosk failures, origins, reset, playback/audio. |
| AC10 | T025–T029: both browser runners, live exploration, accessibility and reviewed production screenshots. |
| AC11 | T024–T030: all checks pass, evidence recorded and release limitations documented. |

Own `01` configurations, runtime outputs, tests, artifacts and this plan. Do not edit `B03_Second_Floor/`, `maps/B03/02/`, `data/buildings/B03/02*`, `content/B03/02.json`, Floor 02 tests/artifacts, or its plan. Keep original evidence packs unchanged apart from byte-identical rebuild results. Shared files may need additive changes: pipeline/generator entry points, registry consumers, renderer, i18n, runner configs, package/lock files and existing owning docs. Record the reusable shared edits here so they can be reconciled at integration; do not create a second registry or parallel app implementation.

Both worktrees must be independently executable. Reuse compatible shared changes if already present; otherwise implement the required parameterization locally. Before combining branches, reconcile those shared changes once, preserve both floor configs/imports/tests, and validate GF+01+02 together. Do not block this floor's source/semantic work waiting for the other agent.

**Building metadata dependency:** `createMapRegistry` and `validateData` require identical B03 names/`floorIds` across all existing bundles and reject declarations for absent floors. Add one authored registration configuration at `scripts/semantic-map/buildings/B03.json`; in this worktree its complete set is initially `['GF','01']`, expanded only when additional complete bundles are present. Generate consistent building metadata for every declared bundle. GF's required `building.floorIds` update is a shared integration edit produced through the generator, not a hand edit; preserve GF source, geometry, graph, content, kiosk and origin behavior. When Floor 02 is integrated, its owner/coordinator regenerates its metadata from the union configuration. Do not touch its outputs in this worktree. Missing/incomplete bundles and metadata conflicts must still fail validation.

The present `types.ts` contract is sufficient for this horizontal scope. [DATA_CONTRACTS](../../docs/DATA_CONTRACTS.md) reserves type-contract changes for orchestrator approval: document a concrete proposal if one becomes unavoidable and continue unblocked work. Do not broaden schema or weaken validation merely to represent a missing label or vertical connection. The unfilled `.specify/memory/constitution.md` template is not an additional project contract; AGENTS and owning documents supply the actual rules.

## Phase 1 — Freeze source evidence and produce the canonical vector bundle

**Gate:** accepted source truth and deterministic `maps/B03/01/` exist before contours or route coordinates are authored. Covers AC01–AC02.

- [ ] **T001** Read the linked guidance and current GF generation/validation seams. Capture `git status`, commit/worktree identity, Node/npm/Python versions and baseline commands/results under this task. Use Node 22.23+ and npm 11.6.2 per README; configure an absolute `PYTHON_EXECUTABLE` if necessary. Inspect generator signatures before proposing new flags.
- [ ] **T002** Visually open all four First Floor inspection PNGs listed above, then inspect the relevant full-source text/vector IDs. Confirm the 59-row schedule, Part 01/02 scope, source crops/layers, transform, nonzero viewBox, seam, hashes and unknown calibration. Record ambiguous/repeated plan tags and associations needing review under this task; duplicate stair/lobby names do not prove one enclosure or a vertical connection.
- [ ] **T003** Establish immutable PDF hashes and run the pack rebuild twice with `python -X utf8 B03_First_Floor/scripts/rebuild.py`. Compare complete manifest/file hashes after both runs and against the accepted pack, not just `validation.status`. Install pinned repository Python requirements plus the pack's PyMuPDF/CairoSVG/Pillow needs as documented; record actual versions. Treat changed originals or unexplained source drift as a failed gate.
- [ ] **T004** Add `scripts/map-ingest/floors/01.json` and parameterize `scripts/map-ingest/{ingest.py,validate.py}` / the pipeline dispatch to select building/floor/source pack. Reuse the accepted pack extraction/rebuild adapter, retaining complete provenance and allowing **no seam** for future single-sheet adapters. Produce `maps/B03/01/{source/,inspection/,master.svg,alignment.json,manifest.json,validation.json}` deterministically without redrawing the master. Preserve source-ID references and resolve original PDF paths to the immutable pack. Reject unsupported floor IDs rather than silently running GF.
- [ ] **T005** Implement and document floor-scoped commands in `scripts/integration/pipeline.mjs`: the planned interface is `npm run ingest -- --building B03 --floor 01` and corresponding `semantic`, `review:maps`, `pipeline` selectors. These flags do not exist at planning time: add argument parsing and forward selection through every generation/review helper before using them. Preserve current unqualified behavior and GF results; validation/prepare still inspect every complete bundle. Prove a selected source run cannot write Floor 02, and compare runtime master/viewBox/source IDs to the pack.

## Phase 2 — Generate semantic rooms/content and a safe horizontal graph

**Gate:** all schedule rows are accounted for; deterministic floor/content/graph/review siblings pass shared contracts and independent geometry checks before enabling a floor option. Covers AC02–AC06.

- [ ] **T006 [US1]** Add `scripts/semantic-map/floors/01.json` and parameterize `explore.py`, `generate.py`, `features.py`, `drawing_graph.py`, `verify.py`, `verify_navigation.py`, `verify_topology.py`, `render_review.py`, and `check_routes.mjs`. Replace GF global paths/numeric-room rules with selected-floor input; keep reusable algorithms and floor-specific reviewed evidence separate. Do not import `partial_graph.py` as the active generator. Include floor-owned availability settings instead of applying GF room codes.
- [ ] **T007 [US1]** Reconcile every `F-*` schedule row with plan labels using transformed bbox/label position plus enclosing architecture. Keep schedule name, plan aliases, raw text IDs, source sheet IDs, bboxes and conflict rationale in `01.review.json`; translations are documented editorial translations, not evidence of use/access. Deduplicate overlap evidence without merging different rooms by name. Never use a title-block schedule coordinate as a map position.
- [ ] **T008 [US1]** Derive closed, non-overlapping contours from retained architectural evidence. Validate polygons, source-label containment and transformed bounds independently; inspect leakage near stairs, elevator cores, library/central structure, facade and seam. Distinguish display footprints from traversable space. Use nullable contour/source-label markers when closure is unsupported. If a row lacks even an evidenced in-bounds plan marker, record an individual source-status exception; do not fabricate its centroid to satisfy the existing Room contract. Keep its schedule identity/name and reason in the reconciliation, and disclose any reduced runtime count.
- [ ] **T009 [US1]** Generate `01.json`, `content/B03/01.json`, `01.review.json` and `01.semantic-review.png` together. Set B03/01/level 1 and bilingual First Floor metadata; stable IDs/content references must resolve one-to-one. Include explicit placeholder descriptions, null photographs, geometry/evidence statuses and directory policy. Keep any unconfigured kiosk unknown with `nodeId: null`; unique IDs are floor-qualified. Author a named source-backed planning origin only if its local approach is evidenced, otherwise leave no default and require a start choice. Do not copy GF's Main Entrance origin.
- [ ] **T010 [US2]** Associate each supported room with a source-derived door or corridor-facing mapped approach and path/text provenance; `centroid` remains a label anchor. The legacy `doorNodeId` may reference a qualified room-linked approach under drawing policy. Shared-suite/landmark endpoints require bilingual `navigationNote`; an unclosed/exterior/final connection gap requires `navigationPartial` when a valid covered approach exists. With no supported approach, leave the connection null and return an honest unavailable state. Apply qualifications to both starting and destination rooms.
- [ ] **T011 [US2]** Construct Floor 01 corridor/junction/approach nodes, source-backed `walls` and `navigableAreas`, then `01.graph.json` with explicit `routingPolicy: 'drawing-based'`. Exclude non-circulation room solids, voids, blocked enclosures, envelope walls and unmapped exterior gaps. A display polygon, central structure, door-swing arc or facade annotation cannot automatically become walking surface; distinguish openings from solid wall evidence. Do not insert centroid links or broaden polygons to connect the graph.
- [ ] **T012 [US2]** Validate every edge's first/last points against node coordinates, positive non-self polyline length in `map-unit`, full segment coverage by the navigable-area union, and absence of crossing/touching/collinear wall overlap. Preserve source evidence/status, restrictions, accessibility and rejection diagnostics. Check complete segments through concave areas/gaps, not only endpoints or midpoints. Inspect seam-crossing edges in both sheets; do not move points off walls without documented source-derived correction.
- [ ] **T013 [US2]** Add actual-data coverage in `tests/integration/floor-01.qa.test.ts`, invoking the production `findRoute`, plus independent checks in `tests/qa/floor_01_source_truth.py`. Account for the 3,481 ordered schedule-pair outcomes, distinguishing self/shared-approach, supported connected, restricted, disconnected, partial and unmapped cases. Store `artifacts/qa/floor-01/route-matrix.json` and navigation review diagnostics with supported count, failures and reasons. Use a separate Shapely/topology pass against raw source-derived constraints to avoid validating a generator only with its own algorithm.
- [ ] **T014 [US2]** Add meaningful rejection fixtures for wall contact/crossing/overlap, concave union escape, gap/void/room shortcut, envelope escape, mismatched endpoints/distance/floor, missing constraints, closed links and accessible-only unknowns. Synthetic positive/negative fixtures stay in `tests/fixtures/`, never live data. Regenerate twice using the implemented floor selector; verify byte-identical semantic/content/review outputs and unchanged other-floor outputs. Run the smallest applicable tests after each semantic or safety change.

## Phase 3 — Integrate shared services, 2.5D rendering and validated floor selection

**Gate:** GF+01 works as a complete independently deployable catalog, with same-floor state and evidence intact. Covers AC06–AC09; cross-floor routing remains closed.

- [ ] **T015** Implement the shared B03 registration metadata configuration described above. Regenerate consistent `building.floorIds` through `generate.py`, including the necessary GF metadata update only. Keep incomplete Floor 02 absent. Run `npm run validate:data` / `npm run test:data`; add registry regressions for inconsistent metadata, absent declared floors and duplicate kiosk IDs. Do not bypass checks or rewrite GF geometry to make metadata pass.
- [ ] **T016 [US1]** In `apps/web/app/page.tsx`, explicitly import complete `01` floor/graph/content siblings alongside GF and pass them through `createMapRegistry`. Resolve environment building/floor/kiosk IDs against the complete registry; defaults remain documented. Pass serializable validated bundles/catalog plus initial selection to the client, not registry methods across the server boundary or raw extraction JSON. Run `npm run prepare:maps` and verify the canonical/public SVG hashes agree before exposing `01`.
- [ ] **T017 [US1]** Refactor `WayfindingApp.tsx` to select an active validated bundle from the catalog. Populate localized options from real metadata, ordered by numeric level; switch floor/map/directory/search/category choices/source thumbnail/detail labels together. Atomically clear stale selected/destination/custom-start IDs, query/category state, route/journey/progress and camera frame; stop queued audio/playback and reset map view. Preserve language, mute and accessible-only preference. Evaluate the new floor's kiosk/default only after switching; never retain a GF node or a closure over the old bundle.
- [ ] **T018 [US2]** Preserve start precedence: local custom supported room → applicable confirmed configured kiosk → local evidenced named planning default → choose-start state. A kiosk registered on GF never supplies an `01` origin; no upper-floor “you are here” marker appears without evidence. Reset restores this precedence within the active floor. Keep availability separate from geometry/routing confidence, and ensure blocked/unavailable/unsupported endpoints do not initiate playback.
- [ ] **T019 [US3]** Reuse `FloorMap.tsx` and existing palette/category language. Baseline scene values are `ROOM_HEIGHT=.65`, `ROOM_LIFT=.16`, circulation height `.045` and circulation lift `0`; they are illustrative scene units. Preserve deterministic depth/side shading, hover/selected elevation, source walls, route underlay/endpoints, marker-only rooms and candidate styling. Store any justified visual adjustment in shared renderer configuration, without adding architectural-height claims or inventing blocks for unknown polygons.
- [ ] **T020 [US3]** Correct floor texture sizing/registration to derive aspect ratio from `floor.viewBox`: the existing fixed `4096×2048` texture was tailored to GF and can letterbox `2910×1585` source ink. Ensure source texture, contours, label positions and route points use the same nonzero master frame and renderer mapping (x→scene x, y→scene z). Verify corners, seam and known openings after resize/zoom/reset; reset/dispose obsolete textures during floor changes. Keep changes reusable for any registered floor.
- [ ] **T021 [US1][US2][US3]** Update floor-dependent copy, search/i18n and route instruction usage through existing packages. Remove GF-only welcome/location assumptions for active floor names. Verify code search, English aliases and Arabic normalization; bilingual qualified/partial/blocked notes before instructions and honest mapped-approach arrival language. Retain speech replay/stop/mute, playback/pause/reset, keyboard route controls, RTL and reduced-motion behavior.
- [ ] **T022** Add `tests/integration/floor-01-state.qa.test.tsx` for GF↔01 switching during selection, custom start, route playback and Arabic mode; registry/environment/no-origin/reset/availability cases; and correct renderer framing. Verify no stale room counts, audio events, graph nodes or routes survive a switch. Re-run existing GF app-state/routing/playback tests plus floor-specific Vitest checks and typecheck.
- [ ] **T023** Prove cross-floor requests fail closed under v1 in routing/registry tests. Record any possible stair/elevator approaches with floor-local provenance in `01.review.json` without asserting connected floors. A later vertical feature requires evidence of the same physical connection at both ends, an orchestrator-approved floor-scoped wall/area contract, vertical types/path restrictions/distance units, horizontal validation on each floor, both directions, closed/disconnected links, stairs/unknown-lift exclusion under accessible-only, and bilingual floor-change instructions. Matching `STAIR 03`, `STAIR 04` or `ELEVATOR LOBBY` names is insufficient; this task completes by verifying the gate, not by adding vertical edges.

## Phase 4 — Independent QA, production browser evidence and release documentation

**Gate:** all acceptance criteria are evidenced; a passing build alone is insufficient. Covers AC01–AC11. Record exact commands and outcomes under T024–T030; never mark unexecuted browser checks passed.

- [ ] **T024** Run independent source/geometry/Python checks, then `npm run validate:data`, `npm run test:data`, `npm run typecheck`, `npm test`, and `npm run prepare:maps`. Build only from complete registered bundles. Record source hashes, inventory reconciliation, route matrix totals, rejected cases and final semantic overlay review. Use `npm run pipeline -- --building B03 --floor 01` only for regeneration after that selector is implemented; it must not regenerate Floor 02.
- [ ] **T025** Read the installed Army `e2e` skill and `setup`, `writing-tests`, `running`, `mcp`, and `bug-bash` topics (`npx e2e guide <topic>`). The repository currently uses Playwright, not Army e2e: add `e2e`, `@e2e-dev/web` and the chosen authenticated model adapter per the installed setup guide; preserve `npm run test:e2e` as Playwright. Add/reuse `e2e.config.ts` with `tests/agentic/**/*.e2e.ts`, `web()` target and `app.url` from `QA_BASE_URL`; use the already running production server or an explicitly owned start command. Use existing authorized provider configuration; record missing authentication as a tooling blocker without exposing secrets. Do not silently claim agentic coverage from a deterministic-only run.
- [ ] **T026** When Playwright MCP is available, explore the production app before choosing locators: inspect accessible floor/room/control names, room count, route status, map asset, console and network; use semantic roles/labels and fresh observations. If unavailable, record that limitation and use headed Playwright exploration plus AXI. Turn every relevant discovered behavior/confirmed defect into a deterministic test in `tests/e2e/floor-01.qa.spec.ts`; keep agentic flows in `tests/agentic/floor-01.e2e.ts`. Each `agent.act` has one goal and is followed immediately by `expect` or `agent.assert`; use readiness assertions, never sleeps. Inspect `.e2e/report.json` and failure `trace.md` before fixing failures.
- [ ] **T027** Add production acceptance flows for floor selection/count, English/code/Arabic search, unknown-contour selection, source-supported success including a cross-seam journey, qualified/partial or genuinely blocked endpoints and reversed starts, accessible-only exclusion, unavailable destination, custom start/reset, playback/audio and GF regression. Include keyboard focus/selection, five relevant axe/WCAG AA states, RTL→English retention, forced colors, reduced motion, WebGL-disabled fallback, mobile and 200% text with no horizontal overflow. Assert actual supported room IDs chosen from review evidence, not imaginary routes or stale GF selectors. Army exploration charters cover floor/state switching, routing honesty and Arabic/mobile; reproduce findings deterministically.
- [ ] **T028** Build/start production and execute the suites using the commands below. Use a distinct app port, AXI session and runner artifact paths per worktree. Playwright's current default reporter/output folders are shared; introduce a small reusable environment override so `QA_ARTIFACT_DIR=artifacts/qa/floor-01` writes its `browser-results.json` / `browser-tests/` there. Army's default `.e2e/report.json` is worktree-local; archive report/trace outputs into this floor's artifact directory. A missing tool/provider is a named incomplete gate; complete all independent checks still available.

```powershell
# Root terminal: dependencies, data and production build
npm ci
npx playwright install chromium
npm run validate:data
npm run test:data
npm run typecheck
npm test
python -X utf8 tests/qa/floor_01_source_truth.py
npm run build

# Separate terminal: keep this owned production server running
npm run start -- --port 3101

# QA terminal: use semantic selection to switch to 01; also test the GF baseline
$env:QA_BASE_URL = 'http://localhost:3101'
$env:QA_ARTIFACT_DIR = 'artifacts/qa/floor-01'
npm run test:e2e -- tests/e2e/floor-01.qa.spec.ts
npm run test:e2e -- tests/e2e/wayfinding.qa.spec.ts
npx e2e run tests/agentic/floor-01.e2e.ts --workers 1 --trace on
# Read .e2e/report.json and every failure trace; archive into floor-01/.
```

For the configured-floor test, set `WAYFINDING_BUILDING_ID=B03` and `WAYFINDING_FLOOR_ID=01`, remove any inherited GF-specific `WAYFINDING_KIOSK_ID`, then rebuild/restart and assert initial `01`. Test invalid/unregistered floor IDs and kiosk/floor mismatch as expected build failures. Restore documented default configuration and rebuild for the final GF↔01 production suite; record which build each artifact represents.

- [ ] **T029** Use Chrome DevTools AXI as a second browser pass. Read top-level help and each used command's help immediately before invocation; commands below reflect planning-time help and must be rechecked. Select `01` using the current snapshot, then repeat default/selection/success/qualified-or-partial-or-blocked/Arabic/mobile/200% states. Inspect errors, failed/status responses, keyboard/a11y observations and performance; record any reproducible degradation against GF rather than inventing a performance threshold. Verify `/maps/B03/01/master.svg` is 200, parses with the expected viewBox, and no source PDFs/extraction are requested. Capture screenshots only after state assertions.

```powershell
$env:CHROME_DEVTOOLS_AXI_SESSION = 'b03-floor-01'
npx -y chrome-devtools-axi --help
npx -y chrome-devtools-axi open --help
npx -y chrome-devtools-axi open $env:QA_BASE_URL
npx -y chrome-devtools-axi snapshot --help
npx -y chrome-devtools-axi snapshot
npx -y chrome-devtools-axi console --help
npx -y chrome-devtools-axi console --type error
npx -y chrome-devtools-axi network --help
npx -y chrome-devtools-axi network --type all
npx -y chrome-devtools-axi resize --help
npx -y chrome-devtools-axi resize 1440 1000
npx -y chrome-devtools-axi screenshot --help
npx -y chrome-devtools-axi screenshot artifacts/qa/floor-01/default-en.png
# Drive and assert each named state using snapshot-derived controls; capture per table.
npx -y chrome-devtools-axi resize 390 844
npx -y chrome-devtools-axi screenshot artifacts/qa/floor-01/mobile-ar.png --full-page
```

| Stable screenshot under `artifacts/qa/floor-01/` | Required demonstrated state |
| --- | --- |
| `default-en.png` | First Floor selected, actual visible count, clean map/no stale GF state. |
| `selected-room-en.png` | Evidenced contour or marker, raised selection, label/details and source thumbnail. |
| `route-success-en.png` | Supported same-floor corridor route, origin/destination and instructions. |
| `route-cross-seam-en.png` | Supported route crossing the aligned seam, ink/overlay registration visible. |
| `partial-route-ar.png` **or** `qualified-route-ar.png` **or** `blocked-route-ar.png` | The actual evidence-backed limitation and localized status; do not manufacture a partial route to satisfy a filename. |
| `default-ar.png` | Arabic floor/directory, RTL and readable codes/labels. |
| `mobile-ar.png` | 390×844 Arabic layout, reachable controls and legible map/route. |
| `text-200-percent-ar.png` | Actual 200% text-size state, no clipping/overflow; not merely a larger screenshot or map zoom. |

Under T029, record one entry per image: relative path, URL, commit/worktree, production build configuration, browser/version, viewport, language, floor, room/start/destination IDs, state setup and capture command/test, assertion proved, and visual inspection result. Save AXI/Playwright console/network logs and axe results alongside images; this table specifies required artifacts and is not execution evidence yet. After reviewing baselines, rerun screenshot comparisons unchanged; do not blindly update snapshots to pass.

- [ ] **T030** Update floor-owned sections in existing `docs/SOURCE_AUDIT.md`, `docs/SEMANTIC_REVIEW.md`, `docs/QA_REPORT.md`, `docs/KNOWN_ISSUES.md`, `docs/DEPLOYMENT.md`, and README as relevant, preserving GF history. Document regeneration selectors, registered-floor selection and planning-origin configuration, source-status exceptions/partial endpoints, unknown calibration/accessibility and vertical-route gate. Run `git diff --check`, inspect file ownership/diff and confirm Floor 02 outputs were untouched. Mark AC/task checkboxes only against actual evidence; finish with changed paths, commands/results and precise remaining evidence/tool blockers. Do not deploy, merge or report physical approval as part of this implementation plan.
