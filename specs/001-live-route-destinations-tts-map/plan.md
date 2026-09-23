# Implementation Plan: Live Route Playback, Configurable Destinations, and Map Fidelity

**Branch**: `codex/FirstFloorFinalFixes` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

## Summary

Extend the existing B03 wayfinding experience with a data-validated destination availability field, explicit route playback progress and smooth camera following, consistent raised 2.5D rendering for vertical transition features and remaining reviewed blocks, primary localized room-name labels, and exclusive English/Arabic route speech that interrupts room descriptions. Preserve drawing-based routing, provenance, partial-route disclosures, accessibility, and the existing production QA gates.

## Technical Context

**Language/Version**: TypeScript, React, Next.js, Node.js 22.23+
**Primary Dependencies**: Three.js/react-three-fiber/drei, lucide-react, Vitest, Playwright
**Storage**: Versioned JSON floor/content/graph bundles; no database
**Testing**: Vitest unit/integration, Playwright production browser tests, data validators, source QA
**Target Platform**: Chromium/Edge kiosk and responsive web browser
**Project Type**: Next.js web application with shared TypeScript packages and Python source pipeline
**Performance Goals**: Smooth 60 fps-capable playback on the existing map scene; no blocking route recalculation during animation
**Constraints**: No invented geometry, kiosk coordinates, metre scale, accessibility, or cross-floor connectivity; honor reduced motion, RTL, keyboard, forced colors, WebGL fallback, and partial-route warnings
**Scale/Scope**: One B03 ground floor, 54 rooms, current 149-node drawing graph, localized English/Arabic UI and speech

## Constitution Check

Passes the repository gates: source evidence remains traceable; generated data is validated; route animation uses only validated RouteResult geometry; availability is separate from physical access; bilingual/RTL and accessibility are preserved; changes remain within the established map-engine, UI, audio, and test ownership boundaries. No new architectural dimensions or floor connections are introduced.

## Project Structure

### Documentation

```text
specs/001-live-route-destinations-tts-map/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/ui-and-config.md
```

### Source Changes

```text
packages/map-engine/src/types.ts       # availability and feature/display contract
packages/map-engine/src/validate.ts    # runtime validation of availability/features
data/buildings/B03/GF.json             # configured availability and source-backed names/features
content/B03/GF.json                    # missing localized human names/aliases only when evidenced
apps/web/components/WayfindingApp.tsx  # availability gating, playback lifecycle, exclusive speech
apps/web/components/FloorMap.tsx       # clipped route, camera follow, 2.5D feature rendering, labels
apps/web/app/kiosk.css                  # playback controls, feature/label styles, responsive states
packages/audio/src/index.ts             # Arabic voice selection/session test seams if needed
packages/i18n/src/index.ts              # playback, availability, transition, and speech copy
tests/unit/                            # arc-length playback, availability, audio/language tests
tests/integration/                     # app state and bundle validation tests
tests/e2e/wayfinding.qa.spec.ts         # route playback, unavailable destination, Arabic speech, visuals
docs/QA_REPORT.md                       # final evidence and test counts
docs/KNOWN_ISSUES.md                    # operational availability and speech/vertical limits
docs/DEPLOYMENT.md                      # JSON configuration and browser voice setup
```

## Implementation Phases

### Phase 1: Contract and configuration foundation

1. Add the optional Room availability shape and localized status/reason strings to shared types; keep backward-compatible defaults.
2. Extend `validateFloorBundle` and data rejection fixtures to reject unknown/invalid availability and inconsistent feature references.
3. Inventory actual source-backed human names and reviewed flat/transition feature geometry; update generated JSON through the semantic/config pipeline, never by inventing names or polygons.
4. Add i18n keys for availability, playback controls, transition labels, and speech fallback in both languages.

### Phase 2: Playback and camera-follow behavior

1. Add deterministic arc-length clipping/progress helpers with repeated-point and short-route handling.
2. Add explicit journey playback phase/progress and stop/reset/restart transitions in `WayfindingApp`.
3. Pass playback state into `FloorMap`; clip the overlay for animation and keep endpoint markers coherent.
4. Add bounded smooth camera target/position following through existing OrbitControls, release follow on user camera interaction, and honor reduced motion.
5. Add localized accessible playback controls and live status text.

### Phase 3: Availability and route speech integration

1. Filter/annotate destination controls from availability without hiding searchable details.
2. Prevent unavailable destinations from route selection/start and show localized reason/status.
3. On route start, call TTS stop before state changes; speak the first route instruction only after successful route validation.
4. Preserve instruction sequencing during playback, Arabic locale/voice selection, mute, unsupported-browser fallback, language change, and reset.

### Phase 4: 2.5D map fidelity and labels

1. Refactor shared low-rise extrusion/shading profile so rooms, MapFeatures, and reviewed blocks render consistently.
2. Render elevator/electric-stair MapFeatures with transition-specific semantic styling and source/status affordances; do not create cross-floor route edges.
3. Add source-backed cafeteria and other reviewed block profiles or retain marker-only treatment where geometry is unresolved.
4. Make localized human-readable name primary in map labels and retain code as secondary text, tooltip, search field, and accessible identifier.
5. Inspect desktop/mobile/Arabic visual states and update only feature-specific baselines.

### Phase 5: Verification and documentation

1. Add unit tests for progress clipping, playback transitions, availability validation, Arabic route speech, and stop-before-speak ordering.
2. Add integration tests for unavailable destination state, reset/language behavior, reduced motion, and camera-follow release.
3. Add production Playwright journeys and visual checks for live route, unavailable destination, vertical features, labels, Arabic RTL, speech interruption, mobile, and accessibility.
4. Run typecheck, full Vitest, data tests, source/geometry QA, production build, and browser suite.
5. Update QA_REPORT, KNOWN_ISSUES, DEPLOYMENT, and EXECUTION_LOG with evidence, configured destinations, browser voice limits, and any remaining geometry/source gaps.

## Dependencies and Ordering

Contract and validator work precede generated data and UI consumption. Playback helpers can be developed alongside availability once the shared shape is frozen. Map rendering and speech integration depend on the updated UI props/state. Browser baselines and documentation follow the complete integration. No task may weaken route-safety or source-evidence validators to make a journey pass.

## Risks and Mitigations

- Uneven route points can make point-index animation jump; use arc length and deterministic tests.
- Camera following can fight manual pan/zoom; release follow on input and provide reset.
- Browser Arabic voices vary; retain visual instructions and test the installed kiosk browser.
- Some source labels are code/name-conflicted; preserve provenance and show qualified names/aliases instead of guessing.
- Vertical features may be visual-only; keep MapFeature semantics separate from commissioned multi-floor navigation.

## Complexity Tracking

No constitution violation or new service is required. The only contract extension is the optional, validated availability field and UI playback props, both backward-compatible and covered by existing validation boundaries.
