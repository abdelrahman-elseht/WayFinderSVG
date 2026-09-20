# Independent QA report — R2

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
