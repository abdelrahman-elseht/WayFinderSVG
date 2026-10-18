# Independent QA report — R2

## Raised blocks, GF and 01 (2026-10-12)

Branch `fix/Bo3-first-floor-Gf-blocks` adds ten recovered candidate room display footprints, five lift cabins and two escalators per floor, and consistent illustrative stair height. `tests/qa/display_footprints.py` passes dense source-boundary, nonoverlap and all-edge route-occlusion checks for both floors; its report and desktop/detail screenshots are under `artifacts/block-heights/`. GF recovery excludes cafeteria/service interiors and qualifies G-19/G-20/G-21 at the cafeteria entrance in English/Arabic. The 2,862 ordered GF pairs remain connected and topology verification reports no failures. First Floor routes remain unchanged.

Validation: both floor pipelines and deterministic regeneration passed; `validate:data`, `test:data` (21 rejection checks), TypeScript and the 155-test Vitest suite passed. After GF graph correction, the relevant live-data/route-safety suites passed (11 tests), as did block/route unit checks. First Floor browser suite: 12 passed. GF functional browser suite: 12 expected outcomes, including the existing expected unavailable-room failure; no unexpected failures. Existing GF screenshot baselines were excluded because the raised geometry intentionally changes them; replacement screenshots were visually inspected. English/Arabic, axe, mobile, 200% text, forced colors, reduced motion and fallback checks passed. First Floor production build passed. The inherited favicon 404 remains.

## Adaptive visual route corners (2026-10-18)

The visual smoother now rounds ordinary branching corridor nodes while keeping
door/approach, accessibility, restriction and floor transitions exact. Both
rendered strokes already consumed the cached visual polyline; the root cause was
over-protection of graph junctions, with small trim caps and retained short
segments as secondary limits. No routing, instructions, graph JSON, distance,
selection, accessibility policy or playback timing changes were made.

Matched route diagnostics show rounded-corner counts increasing from 0 to 8 on
GF G-01 to G-50, 0 to 4 on GF G-01 to G-05, 0 to 14 on 01 F-01 to F-50, and
1 to 6 on 01 F-01 to F-34. The entrance corridor accepts 48 drawing units;
the constrained First Floor turn at [2376,1209] rejects larger candidates and
accepts 35.90625. All accepted chords and connectors pass the existing complete
navigable-union/no-wall-contact validator. Protected/tight corners remain
constrained; stroke width is not a physical clearance guarantee.

Validation: `validate:data`, all 21 `test:data` rejection checks, typecheck,
and production builds configured for both GF and 01 pass. All 177 Vitest tests
have passing results. The initial two-worker run had one timeout in the unchanged
GF all-pairs test under concurrent browser/build load (2,916 routes still had zero
failures); its isolated rerun passed all five file tests in 71 seconds. The
First Floor 3,481-pair matrix passed in the full run.
The relevant browser checks passed: 11 GF functional checks, two GF matched-view
route captures, and 14 First Floor production checks (12 existing plus two route
captures). These include playback, reduced motion, RTL, accessibility exclusion,
keyboard, mobile, forced colors, axe states and WebGL fallback.

Diagnostics, fixed-view before/after captures, current browser reports and the
isolated GF matrix are in `artifacts/corner-rounding/`. The route-free legacy GF
golden image still differs by exactly 22,356 pixels, matching the already-recorded
baseline failure below; no goldens were rewritten. Operational availability
gating remains the existing expected failure.

## First Floor southern-route correction (2026-10-12)

The F-20 to F-34 regression first failed at 3,175.7521 drawing units and now passes at 1,184.432 (62.7% shorter). F-21 to F-34 is 1,318.7796. The corrected southern corridor and distance-preserving graph reduction produce 323 nodes, 452 edges, 130 cycles and one connected component for all 51 supported approaches. All 1,275 endpoint pairs pass the existing 0.05-unit grid-reference tolerance; the rooted-tree negative control rejects 975 detours. The production router classifies all 3,481 schedule pairs without unexpected failures.

Independent original-source checks pass 22,255 assertions, including zero wall contacts, zero room/stair shortcuts, bounded source-door landing evidence, and complete navigation-envelope containment. Source PDFs and semantic contour coordinates are preserved. The corrected CAD raster spans its canonical viewBox, raised footprints remain anchored during selection, and route rendering respects solid depth. A browser landmark test samples actual raster pixels to reject the former SVG letterboxing.

Validation passed: all 151 Vitest tests in 15 files, typecheck, `validate:data`, 21 malformed-data checks, and a configured First Floor production build. Twelve First Floor Playwright tests passed in two invocations (two new route/raster regressions and ten existing checks), including English/Arabic routing, accessibility exclusion, reduced motion, forced colors, mobile, keyboard, five axe states and WebGL fallback. Desktop and Arabic mobile screenshots were inspected; no mobile horizontal overflow was observed. See `artifacts/navigation-fix/hearing-correction.json`, `artifacts/navigation-fix/after-hearing-desktop.png`, `artifacts/navigation-fix/after-hearing-mobile-ar.png`, and current `data/buildings/B03/01.*review.json`.

F-17/F-49/F-57 remain unsupported, five schedule entries remain unmapped, and physical access, accessibility and metre scale remain unknown. Earlier QA entries below are historical baselines.

## First Floor phase 1–2 verification (2026-10-10)

T001–T014 are implemented and evidenced in `specs/002-b03-first-floor-wayfinding/spec-plan.md`. The selected `npm.cmd run pipeline -- --building B03 --floor 01` passes two byte-identical accepted source rebuilds, two source adapters, two semantic generations, independent checks and asset preparation. Both original PDF hashes remain unchanged. Repeated semantic overlay and canonical/public SVG hashes match. GF retains its geometry/graph/content/origin; only shared building registration metadata changes. All 34 other-floor baseline artifacts pass ownership comparison, and Floor 02 has no changes.

All 59 schedule rows are accounted for: 54 mapped records, 38 candidate contours and 16 markers, with five individually evidenced missing-marker exceptions. The final graph contains 307 nodes, 420 edges and 51 approaches. Original-source QA passes **18,425 assertions** with zero wall contacts or room shortcuts. The production-router matrix accounts for **3,481 pairs**: 2,444 connected, 51 self, 6 shared-approach, 100 disconnected, 315 unsupported and 565 unmapped. It has 1,274 successful cross-seam pairs and zero unexpected results. F-57's local approach remains disconnected; F-17/F-30/F-49 remain unsupported. Topology verifies 1,225 connected unordered pairs and 115 cycles; the rooted-tree negative control rejects 1,121 detours.

Validation: `validate:data`, all 21 `test:data` rejection checks, typecheck, **149 Vitest tests across 14 files**, and production builds for configured `01` and default GF pass. Unregistered floor `99` and a GF kiosk configured on `01` correctly fail builds. The full router matrix uses a 600-second timeout and the complete single-worker Vitest run passes; no pairs are sampled away.

**Nine First Floor Playwright tests pass**, covering configured assets/privacy, inventory and bilingual search, keyboard/source-marker selection, cross-seam/reversed/shared-suite routes, unsupported and no-origin states, accessibility exclusion, reset/playback, five axe WCAG AA states, RTL, 390px mobile, enlarged text, forced colors and WebGL fallback. Playwright MCP and Chrome DevTools AXI independently exercised live production selection/routes/Arabic/mobile and captured screenshots/network logs. No application exceptions or unexpected app-resource failures were observed; the inherited missing favicon remains 404. All evidence is under `artifacts/qa/floor-01/`, including screenshot dimensions/configuration metadata.

Tester-army/e2e reports **one deterministic pass and one explicit agent-test skip**: no provider key or saved subscription login is available. This is a model-driven QA blocker, not agentic coverage. The report and trace are archived as `army-report.json` and `army-traces/`.

The default GF Playwright suite reports **12 passed, one failed**, including the existing expected availability-gating failure. Its visual test differs by 22,356 pixels (2%) at `r2-default-en.png`: the saved image uses an older graduation icon, code-only map labels and palette; current unchanged UI/renderer files use the academy logo, named labels and current palette. Expected/actual/diff images and trace remain under `gf-regression/browser-tests/`; golden images were preserved. Stale functional tests were corrected to enter Navigate explicitly, respect automatic reduced-motion completion, use the fallback directory and control playback with Playwright's clock. These are test maintenance changes, not UI implementation.

Visual inspection also found black room roofs in AXI Chrome's route/mobile captures, while its default capture and Playwright route captures show expected shading. The images retain this observed renderer issue for phase 3/4 diagnosis; no cross-browser visual approval is claimed.

Interactive floor switching, source-texture aspect registration, availability gating and remaining product integration belong to phase 3. Overall feature/release criteria remain open; no facility access, kiosk location, physical scale or vertical connection approval is asserted.

Status: **production QA passed for drawing-based approach planning, with three explicitly partial exterior destinations** (20 September 2026).

## Source and geometry

`python -X utf8 tests/qa/source_truth.py` passes **1,296 independent assertions**. Source PDF/generated hashes, anchor transforms, all 54 schedule names and exact transformed label coordinates are preserved. The 39 candidate room polygons remain valid and non-overlapping; none is marked surveyed/confirmed. Unknown descriptions/photos, physical scale, kiosk location, access and accessibility remain honestly unknown.

The stable graph has **149 candidate nodes, 148 edges and 745 navigable polygons**. Every edge is independently checked with Shapely against the complete navigable-area union, supplied solid walls and non-circulation room polygons: no wall crossing/overlap or room shortcut is accepted. Raw source door provenance and graph/review endpoint coordinates agree. Details: `artifacts/qa/r2-source-truth.json`.

## Route coverage and its limits

All **2,916 ordered pairs between 54 mapped approach references** return successful drawing routes (92.7 seconds on final run). Evidence: `artifacts/qa/r2-all-pairs.json`. These are 39 source-door approaches, eight open-circulation approaches and seven other approaches; 16 rooms have endpoint qualifications. This does **not** establish 54 exact room-door arrivals or physical accessibility.

G-06 Storage, G-17 Stair 4 and G-23 Stair 2 remain explicitly **partial routes**: their actual exterior door connections lack continuous ground-surface evidence in the supplied drawings. Source findings are documented in `docs/EXTERIOR_ACCESS_REVIEW.md`. Both destination and reversed-start journeys visibly retain partial labels. Shared-suite/circulation approaches use mapped-approach arrival language, with qualifications before instructions and in room details. Generic arrival overclaim identified during QA is fixed and covered in English and Arabic tests.

## Service and browser checks

Final coordinated verification: **116 tests across eight files passed in one invocation**, TypeScript typecheck passed, all **21 malformed-data rejection checks** passed, and the optimized production build passed. Independent synthetic safety regressions retain drawing-policy wall, void, missing enclosure, closed-link and unknown-accessibility rejection. No geometry expectation was weakened.

All eight main development browser tests passed, followed by a ninth explicit partial-route test. They cover actual Main Entrance→Clinic, Physical Training Lab 1→Auditorium and right→left wing journeys; Arabic search and RTL→English state retention; default origin/custom start/reset; keyboard focus; map selection and zoom; speech autoplay/replay/stop/mute; WCAG AA axe checks in five English/Arabic/route/mobile states; mobile and 200% text; WebGL fallback; forced colors and reduced motion. Partial-route test covers all three destinations, reversed G-06 start, and Arabic. Logs: `artifacts/qa/r2-e2e-baseline.log`, `r2-partial-e2e.log`.

## Visual review

Six fresh snapshots were visually reviewed, then an **unchanged comparison rerun passed**. The scene has clearly raised shaded sides, raised selected rooms and retained architectural linework. Clinic and cross-wing route geometry and endpoint markers remain visible beside the details card; RTL placement, mobile layout and 200% text were inspected. These replace the previous unavailable-route baselines. Evidence: `artifacts/qa/r2-default-en.png`, `r2-popup-en.png`, `r2-route-success-en.png`, `r2-cross-wing-en.png`, `r2-popup-route-ar.png`, `r2-mobile-ar.png`, `r2-text-200-percent-ar.png`, `r2-partial-route-ar.png`, and `r2-visual-rerun.log`.

Extrusion is illustrative and does not assert measured building height. Visual review and source-wall checks do not certify on-site doorway usability. The optimized production build passed. The full **nine-test production browser suite passed on localhost:3001**, including all six unchanged screenshot baselines without updates. Production evidence: `artifacts/qa/r2-production-e2e.log` and `artifacts/qa/browser-results.json`. No remaining implementation failure was found within this tested scope; the three documented exterior source gaps remain product limitations.
