---

description: "Delegation-ready implementation tasks for live route playback, destination availability, 2.5D map fidelity, bilingual route speech, and human-readable labels"
---

# Tasks: Live Route Playback, Configurable Destinations, and Map Fidelity

**Input**: Design documents from `specs/001-live-route-destinations-tts-map/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-and-config.md`, `quickstart.md`

**Working rule**: Every implementation agent must preserve the project gates in `AGENTS.md`, `docs/DATA_CONTRACTS.md`, `docs/KNOWN_ISSUES.md`, and `docs/PROJECT_SPEC.md`. Do not invent coordinates, room names, dimensions, accessibility, kiosk position, or cross-floor connectivity. Generated JSON must be changed through the owning source/configuration pipeline and then regenerated deterministically.

**Delegation rule**: A delegated agent owns only the files named in its task. Agents must not edit another task's owned files without an explicit handoff. Before handoff, report changed files, tests run, remaining assumptions, and any generated artifacts.

## Phase 1: Setup and delegation preparation

**Purpose**: Establish a clean baseline and make the implementation work partitionable.

- [x] T001 Record the current branch, working-tree status, Node/npm versions, and baseline results of `npm run typecheck`, `npm test`, `npm run test:data`, and `npm run build` in `specs/001-live-route-destinations-tts-map/baseline.md` (no source changes).
- [x] T002 [P] Read and summarize the current contracts and ownership boundaries in `specs/001-live-route-destinations-tts-map/delegation-map.md`, including `packages/map-engine`, `packages/audio`, `packages/i18n`, `apps/web/components`, generated B03 data, and QA docs.
- [x] T003 [P] Add a fixture inventory to `tests/fixtures/routing.ts` or a new adjacent fixture file only if needed, identifying a successful multi-segment route, a short/repeated-point route, an unavailable destination, and a partial route without shipping synthetic data as live B03 data.
- [x] T004 Confirm that no `.specify/extensions.yml` hooks require execution, then persist the feature path in `.specify/feature.json` and ensure all task agents use `specs/001-live-route-destinations-tts-map/` as the source of truth.

**Checkpoint**: Baseline is captured; no task agent starts contract or UI edits before T001–T004 are complete.

## Phase 2: Foundational contracts and safety gates

**Purpose**: Freeze shared types, validation, localization keys, and deterministic test seams before story work begins.

- [x] T005 [P] Add the optional `Room.availability` shape to `packages/map-engine/src/types.ts` with exactly `status: 'available' | 'unavailable'`, localized `reason`, and optional configuration identifier; keep it separate from `public`, `geometryStatus`, `doorNodeId`, and accessibility fields.
- [x] T006 Extend `packages/map-engine/src/validate.ts` and its exported validation types to require both `en` and `ar` availability reasons when availability is present, reject unknown statuses, reject non-room references, and preserve backward compatibility when availability is omitted.
- [x] T007 [P] Add shared playback types/helpers in `apps/web/components/routePlayback.ts` (or document a justified existing-module choice in the handoff); define `idle | ready | playing | paused | complete | stopped`, normalized progress `0..1`, bounded instruction index, and `followCamera` semantics from `specs/001-live-route-destinations-tts-map/data-model.md`.
- [x] T008 [P] Add all required English/Arabic strings to `packages/i18n/src/index.ts` for unavailable destinations, playback start/pause/stop/reset, route speech state, vertical transition labels, and no-voice fallback; verify every key exists in both locales.
- [x] T009 Add malformed availability and contract-rejection cases to `tests/integration/live-data.qa.test.ts` or a dedicated data-contract test, including unknown room IDs, missing localized reason, invalid status, and contradictory destination state; make the tests fail before implementation where practical.
- [x] T010 Run `npm run typecheck`, `npm run test:data`, and the focused contract tests after T005–T009; resolve only contract-related failures and document any intentional compatibility behavior in `specs/001-live-route-destinations-tts-map/delegation-map.md`.

**Checkpoint**: Shared contracts and rejection behavior are stable. User-story agents may now work in parallel only within their assigned files.

## Phase 3: User Story 1 — Live route playback and camera following (Priority: P1)

**Goal**: A successful route progressively reveals in travel order while the map camera follows smoothly; stop/reset and reduced-motion behavior remain safe.

**Independent test**: With a valid route fixture, starting navigation reveals the route progressively, advances instructions, follows the active segment, reaches a complete stable frame, and supports stop/reset; reduced-motion displays the full route immediately.

### Tests first

- [ ] T011 [P] [US1] Add unit tests in `tests/unit/route-playback.test.ts` for arc-length clipping across uneven segments, repeated points, two-point routes, empty routes, progress bounds, and completion behavior; assert no NaN or backward progress.
- [ ] T012 [P] [US1] Add integration assertions in `tests/integration/app-state.qa.test.tsx` for `ready -> playing -> complete`, stop/reset clearing playback, route replacement cancelling prior playback, and invalid/unavailable routes never entering `playing`.
- [ ] T013 [P] [US1] Extend `tests/e2e/wayfinding.qa.spec.ts` with a production journey that starts a real supported B03 route, observes progressive route state, exercises stop/reset, and captures a stable completed-route screenshot without changing unrelated baselines.

### Implementation

- [x] T014 [US1] Implement deterministic arc-length route clipping in `apps/web/components/routePlayback.ts`; preserve the complete `RouteResult.points` and derive only a render-time `visiblePoints` polyline.
- [x] T015 [US1] Add explicit playback state, timer/request lifecycle, instruction index, and cancellation guards in `apps/web/components/WayfindingApp.tsx`; route start must reject non-`ok` results and reset must clear timer, progress, and visible route.
- [x] T016 [US1] Extend the `FloorMap` props in `apps/web/components/FloorMap.tsx` with playback phase/progress/follow state and render the clipped route while retaining endpoint markers and the full route for non-playing/reduced-motion states.
- [x] T017 [US1] Add smooth bounded camera following in `apps/web/components/FloorMap.tsx` through the existing `OrbitControls`/camera refs; interpolate toward the active route point, clamp to floor framing, release follow after user pan/zoom input, and restore follow only through an explicit control/reset.
- [x] T018 [US1] Add localized playback controls and live status semantics in `apps/web/components/WayfindingApp.tsx` and `apps/web/app/kiosk.css`; controls must expose start/pause/stop/reset state, disabled states, keyboard focus, and reduced-motion behavior.
- [x] T019 [US1] Update `apps/web/app/kiosk.css` for visible playback progress, active-segment emphasis, focus styling, RTL layout, mobile layout, forced colors, and no-motion presentation without hiding route information.
- [ ] T020 [US1] Run `tests/unit/route-playback.test.ts`, `tests/integration/app-state.qa.test.tsx`, and `tests/e2e/wayfinding.qa.spec.ts` plus `npm run typecheck` and `npm test`; fix playback behavior without weakening route geometry or accessibility checks.

**Checkpoint**: US1 can be demonstrated independently on a valid B03 route and is safe to hand off before availability, map-fidelity, or speech work is merged.

## Phase 4: User Story 2 — Configurable unavailable destinations (Priority: P1)

**Goal**: Administrators can change destination availability in JSON/configuration; unavailable destinations remain explainable but cannot start navigation.

**Independent test**: Mark a known room unavailable, validate/build, reload the app, verify it remains searchable/details-visible with localized reason and has no route-start action; restore available and verify routing returns.

### Tests first

- [x] T021 [P] [US2] Add unit tests in `tests/unit/availability.test.ts` for available/unavailable defaults, localized reason resolution, unknown status rejection, and route-action eligibility.
- [ ] T022 [P] [US2] Add integration tests in `tests/integration/app-state.qa.test.tsx` for unavailable destination selection, details display, disabled route controls, switching language, restoring availability, and reset behavior.
- [x] T023 [P] [US2] Add a data test fixture under `tests/fixtures/` proving a known room can be toggled without changing its geometry, evidence status, door node, or accessibility metadata.

### Implementation and data configuration

- [ ] T024 [US2] Extend the room availability validation and default-resolution behavior in `packages/map-engine/src/validate.ts` and the shared type exports; keep omitted availability equivalent to available only if that default is explicitly documented and tested.
- [x] T025 [US2] Add the operational availability entries to the owning B03 source/configuration input used by the semantic/data pipeline, then regenerate `data/buildings/B03/GF.json` deterministically; do not hand-edit generated output or hide rooms by changing `public`.
- [ ] T026 [US2] Update `apps/web/components/WayfindingApp.tsx` destination selectors, search results, room details, and route-start handlers to show localized unavailable status/reason while retaining directory discoverability and preventing route calculation/start.
- [ ] T027 [US2] Add localized unavailable styling, disabled-action styling, and status/live-region rules in `apps/web/app/kiosk.css`; preserve keyboard focus and distinguish unavailable from route-unavailable, partial, and accessibility-unavailable states.
- [ ] T028 [US2] Run the data pipeline/validator required for T025, then T021–T023, `npm run typecheck`, `npm run test:data`, and the targeted browser journey; document the configured unavailable destinations and change procedure in `docs/DEPLOYMENT.md`.

**Checkpoint**: US2 is independently demonstrable with a JSON/configuration change and does not alter physical-access or route-safety semantics.

## Phase 5: User Story 3 — Faithful 2.5D map features and human-readable labels (Priority: P1)

**Goal**: Highlighted elevator/electric-stair features and remaining reviewed blocks use consistent raised 2.5D treatment, while localized human names are the primary map labels and codes remain secondary.

**Independent test**: Inspect the B03 map at desktop/mobile and English/Arabic; transition features and reviewed blocks are raised/shaded, unresolved geometry remains honest, and labels show names first with codes available.

### Evidence and tests first

- [ ] T029 [P] [US3] Audit source/provenance for elevator, electric-stair, cafeteria, and remaining flat blocks in `docs/SOURCE_AUDIT.md`, `docs/SEMANTIC_REVIEW.md`, `data/buildings/B03/GF.review.json`, and source vectors; record only source-backed candidates and unresolved items in `specs/001-live-route-destinations-tts-map/map-feature-inventory.md`.
- [ ] T030 [P] [US3] Add unit/integration assertions for MapFeature validation, feature status rendering, localized name fallback, and code-secondary label semantics in `tests/integration/live-data.qa.test.ts` or a focused map-feature test.
- [ ] T031 [P] [US3] Extend `tests/e2e/wayfinding.qa.spec.ts` with English, Arabic, mobile, reduced-motion, and keyboard label/feature checks; create new snapshots only for intentional feature changes and record visual review notes.

### Implementation

- [ ] T032 [US3] Add or correct source-backed `mapFeatures` entries and reviewed block display metadata through the owning semantic/configuration pipeline; regenerate `data/buildings/B03/GF.json` and preserve provenance/status/connected-floor fields.
- [ ] T033 [US3] Refactor the shared extrusion/shading profile in `apps/web/components/FloorMap.tsx` so rooms, transition features, and reviewed blocks use consistent low-rise illustrative height conventions without implying surveyed dimensions.
- [ ] T034 [US3] Render elevator and electric-stair MapFeatures in `apps/web/components/FloorMap.tsx` with transition-specific styling, localized accessible names, status/review affordances, and no fabricated cross-floor route edge.
- [ ] T035 [US3] Render source-backed cafeteria and remaining reviewed blocks with the shared 2.5D profile; keep marker-only/unknown geometry visibly distinct and non-navigable where evidence is insufficient.
- [ ] T036 [US3] Change map labels in `apps/web/components/FloorMap.tsx` and supporting styles so `room.name[language]` is primary, `room.code` is secondary, and accessible label/title/search identity includes both; preserve collision handling and RTL.
- [ ] T037 [US3] Update `apps/web/app/kiosk.css` for name-first labels, Arabic wrapping, selected-room emphasis, transition feature legends, mobile sizing, forced colors, and 200% text without label loss.
- [ ] T038 [US3] Run T029–T031, source/geometry validation, `npm run typecheck`, and visual review at desktop/mobile English/Arabic; update `docs/KNOWN_ISSUES.md` for any unresolved source geometry and explicitly state illustrative height limits.

**Checkpoint**: US3 is independently reviewable as a visual/data increment and does not claim physical dimensions, exact doors, or multi-floor route commissioning.

## Phase 6: User Story 4 — Exclusive English/Arabic route speech (Priority: P1)

**Goal**: Starting navigation immediately interrupts room-description speech and speaks route instructions in the selected language, including Arabic when a suitable browser voice exists.

**Independent test**: Start a description, start a valid route mid-sentence, verify stop-before-speak ordering, repeat in Arabic, mute/unsupported speech, language change, and reset.

### Tests first

- [ ] T039 [P] [US4] Extend `tests/unit/audio.test.ts` with a deterministic fake speech service asserting `stop()` precedes every route `speak()`, Arabic locale propagation, mute behavior, and unsupported-browser no-op behavior.
- [ ] T040 [P] [US4] Add integration assertions in `tests/integration/app-state.qa.test.tsx` for description-to-route interruption, first-instruction timing, route replacement, language change, mute, and reset cleanup.
- [ ] T041 [P] [US4] Extend `tests/e2e/wayfinding.qa.spec.ts` with English and Arabic production journeys that begin speech, start navigation, verify visual route instructions and speech state, and cover missing-voice fallback without making the browser suite depend on a specific installed voice.

### Implementation

- [ ] T042 [US4] Add a small speech-session/lifecycle seam in `packages/audio/src/index.ts` only if needed by T039; preserve the public `TTSService` contract, call cancellation safely, match Arabic voices by language prefix, and keep visual routing independent of speech support.
- [ ] T043 [US4] Update route-start and route-step effects in `apps/web/components/WayfindingApp.tsx` so `audio.stop()` occurs before journey state can trigger route speech; prevent stale description effects from restarting while a route is active.
- [ ] T044 [US4] Ensure Arabic route instruction text in `apps/web/components/WayfindingApp.tsx` and UI status in `packages/i18n/src/index.ts` use `language === 'ar'`, `document.dir = rtl`, and existing localized `RouteInstruction.text`; do not translate source codes or invent missing names.
- [ ] T045 [US4] Add localized speech status, no-voice, muted, and interruption copy in `packages/i18n/src/index.ts` and expose it through accessible status text in `apps/web/components/WayfindingApp.tsx`.
- [ ] T046 [US4] Run T039–T041, `npm run typecheck`, `npm test`, and production browser checks in English/Arabic; document browser voice provisioning and limitations in `docs/DEPLOYMENT.md` and `docs/KNOWN_ISSUES.md`.

**Checkpoint**: US4 is independently usable with or without browser speech support and never delays or invalidates visual route guidance.

## Phase 7: Integration, regression, and release evidence

**Purpose**: Merge story increments, run the complete quality gates, and update project-owned documentation.

- [ ] T047 Integrate the four story handoffs in `apps/web/components/WayfindingApp.tsx`, `apps/web/components/FloorMap.tsx`, and shared exports; resolve prop/state ownership conflicts without duplicating route, camera, availability, or speech state.
- [ ] T048 [P] Add/refresh focused regression coverage in `tests/unit/`, `tests/integration/`, and `tests/e2e/` for partial routes, route-unavailable, accessible-only, custom start/reset, RTL, keyboard, reduced motion, forced colors, mobile, and WebGL fallback.
- [ ] T049 Run the full source/data pipeline checks required by the repository (`npm run validate:data`, `npm run test:data`, and source/geometry QA where generated data changed); preserve generated reports under `artifacts/qa/`.
- [ ] T050 Run the complete verification sequence: `npm run typecheck`, `npm test`, `npm run test:data`, `npm run build`, production server startup, and `QA_BASE_URL=http://localhost:3001 npm run test:e2e`; record exact counts and failures in `artifacts/qa/`.
- [ ] T051 Perform independent visual and accessibility review of English/Arabic desktop, mobile, 200% text, reduced-motion, forced-colors, route-playing, route-complete, unavailable-destination, transition-feature, and speech states; update only intentional baselines.
- [ ] T052 Update `docs/QA_REPORT.md`, `docs/KNOWN_ISSUES.md`, `docs/DEPLOYMENT.md`, and `docs/EXECUTION_LOG.md` with final behavior, configuration instructions, test evidence, source limitations, browser voice limits, and no claims beyond drawing-based routing.
- [ ] T053 Run the quickstart exactly as written in `specs/001-live-route-destinations-tts-map/quickstart.md`, verify no task remains ambiguous, and attach a final implementation handoff listing changed files, generated assets, tests, known issues, and rollback steps.

## Dependencies and execution order

### Phase dependencies

- Phase 1 is first and read-only except for feature coordination artifacts.
- Phase 2 depends on Phase 1 and blocks all user-story implementation because it freezes types, validation, and localization keys.
- Phases 3–6 depend on Phase 2. After that, US1 and US4 may proceed in parallel if they coordinate changes to `WayfindingApp.tsx`; US2 and US3 may proceed in parallel if generated JSON ownership is assigned to one agent at a time.
- Phase 7 depends on all desired story checkpoints and is the only phase that updates final QA/deployment evidence.

### File ownership constraints

- `packages/map-engine/src/types.ts`, `packages/map-engine/src/validate.ts`, and `packages/i18n/src/index.ts`: Phase 2 owner only until handoff.
- `apps/web/components/WayfindingApp.tsx`: US1 and US4 both need it; assign one primary integrator or merge sequentially, never concurrently.
- `apps/web/components/FloorMap.tsx`: US1 and US3 both need it; assign one primary renderer owner or merge sequentially, never concurrently.
- `data/buildings/B03/GF.json`: generated output; only the pipeline/data owner changes it, with provenance and deterministic regeneration.
- `tests/e2e/wayfinding.qa.spec.ts`: story agents may add isolated tests sequentially; do not rewrite unrelated baselines.

### Parallel delegation examples

```text
After Phase 2:
Agent A (US1): T011, T014–T019, then T020; owns playback helper and map/app playback changes.
Agent B (US2): T021, T023–T028; owns availability validation/data/configuration and deployment configuration notes.
Agent C (US3): T029–T038; owns source-backed feature inventory and visual/map fidelity, coordinated with Agent A for FloorMap.
Agent D (US4): T039–T046; owns audio tests/lifecycle and speech-specific UI, coordinated with Agent A for WayfindingApp.
```

Before parallel agents edit shared files, select one owner for the integration merge and send the other agents interface-only requests. Parallel tests in different files are safe; parallel edits to `WayfindingApp.tsx`, `FloorMap.tsx`, generated B03 JSON, or the shared i18n/types files are not.

## MVP and incremental delivery

### MVP

Complete Phases 1–2 and US1 (T001–T020). Demonstrate progressive route reveal, smooth camera following, stop/reset, reduced motion, and existing route safety before adding operational availability or visual/speech enhancements.

### Incremental releases

1. MVP: live route playback and camera following.
2. Add US2: configurable unavailable destinations with validation and deployment instructions.
3. Add US3: source-backed 2.5D transitions/blocks and name-first labels.
4. Add US4: exclusive bilingual route speech and Arabic voice fallback.
5. Complete Phase 7 and release only after full QA/build/browser evidence passes.

## Completion definition

The feature is complete only when all required task checkboxes are satisfied, every story checkpoint passes its independent test, generated data is deterministic and provenance-preserving, full type/data/unit/integration/browser/build checks pass, and the four owning project documents (`QA_REPORT.md`, `KNOWN_ISSUES.md`, `DEPLOYMENT.md`, `EXECUTION_LOG.md`) describe the delivered behavior and remaining evidence limits.
