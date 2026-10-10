# B03 Floor 01/02 spec-plan handoff

Use this handoff to create two independent, implementation-ready single-file spec plans for the B03 first and second floors. The implementation agents will run in parallel worktrees, so each plan must be self-contained, reference the shared contracts rather than copying them, and avoid changing the other floor's source or generated outputs.

## Phase and task board

Agents should update these checkboxes in their own worktree. Keep the work to four broad phases; the detailed tasks belong inside each floor's single plan file.

- [ ] **Phase 1 — freeze source evidence**
  - [ ] Read the repository guide, memory, runbook, and the applicable floor-pack README.
  - [ ] Record floor ID, sheet scope, transform, viewBox, schedule count, calibration status, and source limits.
- [ ] **Phase 2 — write two single-file plans**
  - [ ] Create one `spec-plan.md` for Floor 01 and one for Floor 02.
  - [ ] Put the goal, file mapping, acceptance criteria, and dependency-ordered implementation tasks in each file.
- [ ] **Phase 3 — add validation tasks**
  - [ ] Include source regeneration, semantic rooms/content, safe graph, 2.5D blocks, registry/UI, bilingual behavior, and cross-floor gating.
  - [ ] Include e2e, Playwright MCP, Chrome DevTools AXI, screenshots, console/network/accessibility checks, and build checks.
- [ ] **Phase 4 — review the two plans**
  - [ ] Confirm each plan is self-contained for its worktree and does not require companion spec files.
  - [ ] Confirm no plan invents geometry, height, scale, kiosk position, accessibility, or a vertical connection.

## Deliverables expected from the planning agent

Create exactly one concise plan file per floor:

```text
specs/002-b03-first-floor-wayfinding/spec-plan.md
specs/003-b03-second-floor-wayfinding/spec-plan.md
```

Each `spec-plan.md` is the complete handoff for that floor. It contains only the floor goal, source/file mapping, acceptance criteria, dependencies, and four broad implementation phases with task checkboxes. Put research notes, data-model decisions, contract changes, QA commands, and screenshot names under the relevant phase/task instead of creating companion files. Do not create `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, or separate checklist/evidence files for this request.

Use `speckit-specify`, `speckit-plan`, and `speckit-tasks` as drafting and quality guidance, then consolidate their useful output into the one `spec-plan.md` file. The final plan must be readable and executable without this handoff. A shared contract change may be named as a dependency, but the two floor plans remain independently implementable in parallel worktrees.

## Shared product goal

Add source-backed B03 Floor 01 and Floor 02 wayfinding using the established Ground Floor pipeline. Each floor must produce a validated vector map, bilingual room directory, source-derived 2.5D room volumes, and a drawing-based same-floor route graph. The UI must expose a real floor selection only after each bundle validates. Cross-floor journeys are a separate, evidence-gated capability: a stair/elevator symbol alone does not prove a connected or accessible transition.

The visual model is illustrative 2.5D. Every room/block needs a deterministic height and lift/depth treatment that matches the existing Ground Floor scene and makes circulation readable. Heights are an authored visualization scale; do not describe them as surveyed architectural heights. Keep source linework, wall/void boundaries, selected-room elevation, room labels, and route overlay legible at the default and mobile viewports.

## Ground Floor reference map

Use these existing outputs and seams as the pattern to parameterize. The new floor plans should point to them instead of restating their contracts.

| Area | Ground Floor reference |
| --- | --- |
| Source evidence pack | `B03_Ground_Floor/` (same self-contained shape as the new packs) |
| Canonical vector/runtime map | `maps/B03/GF/master.svg`, `maps/B03/GF/alignment.json`, `maps/B03/GF/manifest.json` |
| Semantic floor and graph | `data/buildings/B03/GF.json`, `GF.graph.json`, `GF.review.json` |
| Localized content | `content/B03/GF.json` |
| Generation/validation | `scripts/map-ingest/`, `scripts/semantic-map/`, `scripts/integration/pipeline.mjs` |
| Registry and app seam | `packages/map-engine/src/registry.ts`, `apps/web/app/page.tsx`, `apps/web/components/WayfindingApp.tsx` |
| 2.5D renderer | `apps/web/components/FloorMap.tsx` (`ROOM_HEIGHT`, `ROOM_LIFT`, circulation treatment) |
| Route safety | `packages/routing/src/geometry-safety.ts`, `packages/routing/src/index.ts`, `data/buildings/B03/GF.graph.json` |
| Existing browser intent | `tests/e2e/wayfinding.qa.spec.ts`, `artifacts/qa/` |

The key Ground Floor routing lesson is positive and operational: construct corridors and approaches from source evidence, then validate the whole polyline against `navigableAreas` and `walls`. A room centroid or a straight line across the building is not a route. Preserve this rule in both plans and in their rejection tests.

## Shared implementation rules

- Preserve the pipeline: source PDF audit -> aligned vector bundle -> semantic rooms/content -> validated graph -> registry/UI -> independent QA -> build/deployment docs.
- Keep original PDFs unchanged and retain source references, hashes, transforms, exclusions, and review evidence.
- Use `B03` with floor IDs `01` and `02` in generated data; use human-facing “First Floor”/“Second Floor” labels from localized floor metadata. Do not create placeholder floor data or invent a floor number from the sheet title.
- Keep room IDs stable and names source-traceable. A room code is an identifier, not evidence of a public entrance.
- Use bilingual `{ en, ar }` room names, floor names, navigation notes, partial-route disclosures, and route instructions. Preserve RTL, keyboard, reduced-motion, and accessible-only behavior.
- A room centroid is a label anchor. Route endpoints must be source-derived door or mapped approach nodes with evidence and qualification status.
- Every graph edge must have endpoints equal to its nodes, drawing-unit distance unless a verified calibration is available, complete containment in the floor's `navigableAreas`, and no crossing, touching, or collinear overlap with `walls`.
- Exclude room solids, voids, blocked enclosures, the building envelope, and unmapped exterior gaps from navigable areas. A straight line through the building or a room is invalid even when the endpoints look plausible.
- Keep candidate, unknown, qualified, and partial evidence visible. Unknown accessibility is excluded from accessible-only routes. A qualified suite or exterior approach must carry bilingual `navigationNote`; missing final connections set `navigationPartial`.
- Do not invent kiosk coordinates, metre scale, physical access, room geometry, photographs, architectural heights, or cross-floor connections. The Main Entrance planning default is a named planning origin, not a physical kiosk position.
- Use existing seams in `packages/map-engine/src/registry.ts` and `scripts/integration/pipeline.mjs`; do not create a second registry or bypass `validateFloorBundle`.

## Floor 01 brief — first floor (`floorId: "01"`)

### Goal

Turn the verified First Floor source pack into a deterministic B03 `01` bundle with 59 source-scheduled rooms (`F-01` through `F-59`), source-backed semantic geometry where evidenced, a safe same-floor route graph, consistent Ground Floor-style 2.5D blocks, and a real selectable floor in the application after validation.

### Source and file mapping

| Evidence | Use |
| --- | --- |
| `B03_First_Floor/README.md` | Pack method, limitations, transform explanation, and rebuild command. |
| `B03_First_Floor/source/pdfs/2761-SOD-B03-DWG-AAR-15-01-Z-0001-00.pdf` | Part 01 original; preserve unchanged. |
| `B03_First_Floor/source/pdfs/2761-SOD-B03-DWG-AAR-15-01-Z-0002-00.pdf` | Part 02 original; preserve unchanged. |
| `B03_First_Floor/source/0001.json`, `source/0002.json` | Full extracted vectors/text/layers and provenance. |
| `B03_First_Floor/source/room-schedule.json` and `room-schedule.json` | Confirmed 59-row schedule, source codes/names/text IDs/bboxes. |
| `B03_First_Floor/alignment.json` | Master coordinate frame, viewBox `[580,315,2910,1585]`, seam `x=2055`, transforms, six anchors, calibration status. |
| `B03_First_Floor/master.svg` | Clean vector map input; do not redraw it by hand. |
| `B03_First_Floor/inspection/master.png`, `0001.png`, `0002.png`, `seam-detail.png` | Visual source and seam evidence. |
| `B03_First_Floor/validation.json`, `manifest.json` | Passed validation, hashes, path counts, schedule count, and repeatability evidence. |
| `B03_First_Floor/scripts/rebuild.py` | Deterministic source-pack regeneration. |

Known source facts to carry into the evidence/mapping section of `spec-plan.md`: two sheets are one first floor; Part 02 uses scale `0.75` and translation `[1444.55, 182.41]` into the Part 01 master; six anchors align with maximum residual `0.01271`; 442 overlap geometry matches at 0.1-point quantization; metric calibration is unknown. Treat any unclosed or exterior room approach as qualified/partial until the drawing proves otherwise.

Open the source visuals before choosing room contours or approach nodes: [First Floor master](../../B03_First_Floor/inspection/master.png), [Part 01 preview](../../B03_First_Floor/inspection/0001.png), [Part 02 preview](../../B03_First_Floor/inspection/0002.png), and [seam detail](../../B03_First_Floor/inspection/seam-detail.png).

### Floor 01 acceptance criteria

- [ ] Source rebuild produces identical hashes and leaves both PDFs byte-for-byte unchanged.
- [ ] A validated Floor 01 bundle exists at the planned canonical paths (`maps/B03/01/`, `data/buildings/B03/01*.json`, `content/B03/01.json`, and the matching public SVG) with consistent `B03`/`01` IDs.
- [ ] All 59 schedule rows are represented by stable room records or an explicitly documented source-status exception; no row is silently dropped or renamed.
- [ ] Room names, codes, source IDs/text IDs, bboxes, geometry status, and bilingual content are traceable to the pack.
- [ ] Each routable destination uses a source-derived door/approach node; centroids are never route endpoints.
- [ ] Same-floor route matrix covers the supported room approaches and rejects wall, outside, room-solid, void, and building-envelope shortcuts.
- [ ] 2.5D blocks have deterministic per-category or per-room heights, visible side shading/lift, source walls remain legible, and the selected room/route state matches GF behavior without claiming real heights.
- [ ] Floor 01 can be selected in the UI only after registry validation; map asset, floor name, directory, search, reset, custom start, and route state all follow the active floor.
- [ ] English and Arabic directory/search/route flows, RTL, keyboard, reduced motion, accessible-only filtering, candidate/partial notes, and unsupported endpoints are tested.
- [ ] Browser evidence includes default, selected room, successful route, partial/qualified route, Arabic/RTL, mobile, and 200% text states; screenshots are stored under `artifacts/qa/floor-01/`.

## Floor 02 brief — second floor (`floorId: "02"`)

### Goal

Turn the verified single-sheet Second Floor Part 02 source pack into a deterministic B03 `02` bundle with 27 source-scheduled rooms (`S-01` through `S-27`), a clearly oriented sideways vector map, safe same-floor routes where evidence supports them, consistent 2.5D blocks, and a real selectable floor in the application after validation.

### Source and file mapping

| Evidence | Use |
| --- | --- |
| `B03_Second_Floor/README.md` | Single-source method, sideways orientation, exclusions, and limitations. |
| `B03_Second_Floor/source/pdfs/2761-SOD-B03-DWG-AAR-15-02-Z-0002-00.pdf` | The only supplied Second Floor original; preserve unchanged. |
| `B03_Second_Floor/source/0002.json` | Full extracted vectors/text/layers and provenance. |
| `B03_Second_Floor/source/room-schedule.json` and `room-schedule.json` | Confirmed 27-row schedule, source codes/names/text IDs/bboxes. |
| `B03_Second_Floor/alignment.json` | No merge/seam; page rotation 270; crop `[200,160,2040,2260]`; display-to-master matrix `[0,-1,1,0,-160,2040]`; master viewBox `[0,0,2100,1840]`; calibration status. |
| `B03_Second_Floor/master.svg` | Main clean sideways vector map for the app. |
| `B03_Second_Floor/master-upright.svg` | Upright CAD cross-reference; do not use as the app's primary orientation without a documented decision. |
| `B03_Second_Floor/reference-sideways.svg` | Annotated sideways reference retaining labels/dimensions for review only. |
| `B03_Second_Floor/inspection/master.png`, `master-upright.png`, `reference-sideways.png`, `0002-full-sheet.png`, `user-provided-screenshot.png` | Orientation, source, and visual review evidence. |
| `B03_Second_Floor/validation.json`, `manifest.json` | Passed single-source/path/schedule/orientation validation and hashes. |
| `B03_Second_Floor/scripts/rebuild.py` | Deterministic source-pack regeneration. |

Known source facts to carry into the evidence/mapping section of `spec-plan.md`: only Part 02 is supplied; do not invent or merge a missing Part 01; the primary master is sideways to match the reference screenshot; the clean master has viewBox `0 0 2100 1840`; the schedule has 27 rows; metric calibration is unknown; continuation lines at the left boundary do not prove the missing geometry or a cross-floor connection.

Open the orientation evidence before writing the Floor 02 map contract: [Second Floor sideways master](../../B03_Second_Floor/inspection/master.png), [upright cross-reference](../../B03_Second_Floor/inspection/master-upright.png), [annotated sideways reference](../../B03_Second_Floor/inspection/reference-sideways.png), and [full source sheet](../../B03_Second_Floor/inspection/0002-full-sheet.png).

### Floor 02 acceptance criteria

- [ ] Source rebuild produces identical hashes and leaves the one PDF byte-for-byte unchanged.
- [ ] A validated Floor 02 bundle exists at the planned canonical paths (`maps/B03/02/`, `data/buildings/B03/02*.json`, `content/B03/02.json`, and the matching public SVG) with consistent `B03`/`02` IDs.
- [ ] All 27 schedule rows are represented by stable room records or an explicitly documented source-status exception; no row is silently dropped or renamed.
- [ ] The app uses the clean sideways master as the primary floor asset and preserves upright/reference files for audit and review.
- [ ] Room names, codes, source IDs/text IDs, bboxes, geometry status, and bilingual content are traceable to the pack.
- [ ] Same-floor route coverage is limited to source-derived doors/approaches and rejects the missing Part 01 area, wall crossings, outside paths, room solids, voids, and unmapped continuation gaps.
- [ ] 2.5D blocks use the same deterministic visual height/lift language as GF and Floor 01; sideways orientation does not alter route coordinates or create an implied physical height claim.
- [ ] Floor 02 can be selected in the UI only after registry validation; map asset, floor name, directory, search, reset, custom start, and route state follow the active floor.
- [ ] English and Arabic directory/search/route flows, RTL, keyboard, reduced motion, accessible-only filtering, candidate/partial notes, and unsupported endpoints are tested.
- [ ] Browser evidence includes sideways map default, selected room, successful route where supported, partial/qualified or blocked route, Arabic/RTL, mobile, and 200% text states; screenshots are stored under `artifacts/qa/floor-02/`.

## Routing and cross-floor contract to plan explicitly

Each floor plan must state whether it implements same-floor routing only or also the shared cross-floor work. Prefer a phase gate: finish and validate the horizontal graph per floor first, then plan vertical transitions only when both floors identify the same physical stair/elevator with provenance on both sides. The current v1 graph stores `walls` and `navigableAreas` without a floor identifier; applying one floor's constraints to another is unsafe and must fail closed. A plan that adds cross-floor routing must therefore include a contract/data-model change for floor-scoped constraints, vertical node/edge types, both-direction validation, closed-link behavior, accessible-only treatment, and bilingual floor-change instructions.

Never infer a connection from matching names such as `STAIR 03`, `STAIR 04`, or `ELEVATOR LOBBY`. The source must support the physical identity and approach on each floor. Unknown lift accessibility remains unknown; stairs are excluded from accessible-only journeys unless the evidence and contract support an accessible alternative.

## Browser and screenshot evidence protocol

The planning agent must make QA executable, not just name “test the UI”. Include these steps as tasks in each `spec-plan.md`:

1. Read the installed Army `e2e` skill and the relevant topics (`setup`, `writing-tests`, `running`, `mcp`, and `bug-bash`). Use `npx e2e ...` commands, `agent.act` for one goal at a time, and `expect`/`agent.assert` immediately after each action. Do not add sleeps; inspect `.e2e/report.json` and trace output on failure.
2. Use Playwright MCP for live app exploration and semantic locators when that MCP is available. Inspect the rendered accessible names, floor selector, room count, route status, console, and network before writing selectors. Convert every discovered behavior into a deterministic Playwright test under `tests/e2e/`.
3. Use `chrome-devtools-axi` for a second, consistent browser check. Before invoking a command, run `npx -y chrome-devtools-axi --help` and then the selected command's `--help`; the CLI is the current source of truth. Check page snapshot, console errors, failed network requests, responsive viewports, and performance observations, then capture screenshots.
4. Run the production browser against `QA_BASE_URL` (or the repository's documented local server) after `npm run build`; do not treat a headless-only unit run as visual evidence. Include a clean default, selected room, successful route, partial/qualified/blocked route, Arabic RTL, mobile width, and 200% text screenshot for each floor.
5. Save artifacts with stable names, for example `artifacts/qa/floor-01/default-en.png`, `floor-01/route-success-en.png`, `floor-01/partial-route-ar.png`, and the corresponding `floor-02/*` files. Record URL, commit/worktree, viewport, browser, command, and what each screenshot proves in the relevant QA task inside `spec-plan.md`; do not create a separate evidence document.
6. Include axe/WCAG checks, keyboard focus/selection, RTL direction, reduced motion, WebGL fallback, console cleanliness, expected network responses, and no horizontal overflow at mobile/200% text. A screenshot without the command and state that produced it is incomplete evidence.

Existing GF browser coverage is in `tests/e2e/wayfinding.qa.spec.ts`; reuse its intent and selectors only after checking the multi-floor UI's current accessible names. Existing GF visual evidence is under `artifacts/qa/`. New evidence must be floor-specific so parallel agents do not overwrite one another.

## Final handoff gate

The planning agent is done when both `spec-plan.md` files exist, each file maps its tasks to source/runtime files and acceptance criteria, each has only a few broad phases with dependency/validation points, source limitations are preserved, browser evidence commands are explicit, and a second agent can implement either floor from its own plan plus the linked repository contracts. Update this handoff's board only for planning artifacts; implementation agents own their floor-specific task checkboxes inside `spec-plan.md`.
