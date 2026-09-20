# Execution DAG and acceptance log

## Phase 0 — requirements and audit
User-requested agents A–G run in isolated contexts with explicit ownership. Root owns contract approval and acceptance. Three specialist slots run alongside the orchestrator; agents are staggered as dependencies resolve.

Source files are two one-page CAD vector PDFs. Initial audit found display rotation 270 degrees and overlapping source labels. Source schedule lists G-01 through G-54; conflicting plan labels must remain flagged.

Contract v1 approved before service implementation. A publishes source vectors and alignment; B consumes these for semantic geometry. E implements bilingual/search/audio against Room contract. C implements graph algorithms against NavigationGraph contract using isolated synthetic fixtures. D consumes semantic contract and E/C APIs. F integrates modules without redesign. G independently validates source, geometry and user journeys.

## DAG
```
request -> contracts + source audit
                    |-> A: vector ingestion -> B: semantic inventory/geometry -> D: UI
                    |-> E: i18n/search/audio -------------------------------> D
                    |-> C: routing/instructions --------------------------> F
                                                      D + data + services -> F
                                                                          -> G
                                                                          -> production build/docs
```

## Evidence gates
No uncalibrated metres, invented kiosk nodes, fabricated room photos, silently guessed room polygons, or unverified accessible routes. Conflicting schedule/plan tags persist in provenance and review inventory. Candidate geometry can be displayed with a review marker; it cannot certify a physical route.

## Current accepted milestones
- Empty repository inspected; skeleton and typed data contracts created.
- Original PDFs visually inspected.
- Six alignment anchors agree within 0.00011 drawing units.
- Both source vector/text JSON files and merged SVG published for semantic processing.
- Routing and bilingual services delegated against frozen contracts.
- A deterministic extraction and overlap validation accepted; originals unchanged.
- E service implementation accepted: 36 search, language and audio unit checks passed.
- B published 54 semantic rooms, 39 candidate contours, 15 marker-only records; partial candidate graph retained with source evidence.
- G initial review: source and service checks passed; three router safety regressions reported to C.
- C corrected those defects; 64 targeted routing/geometry tests passed.
- D delivered kiosk interface and passed initial production build/typecheck; F integrating reproducibility/validation and G running final browser/visual/accessibility review.

## Resumed user revision

The previous agents stopped on rate limits after successful browser runs. Their saved final counts were 108 unit/integration, 18 data rejection, 370 source checks and 8 production browser tests, including a second unchanged visual run. QA_REPORT and some handoffs had not yet been updated, so their stage-1 prose is stale evidence of documentation interruption, not the latest test outcome.

| Phase | Saved outcome | Remaining work on resumption |
| --- | --- | --- |
| 0–1 Audit/contracts/ingestion | Implemented, original PDFs preserved, deterministic aligned vectors | Preserve outputs and update revised routing contract |
| 2 Semantic map | 54 rooms, 39 candidate contours, 15 source markers | Expand actual door/approach and circulation topology |
| 3 2.5D renderer | Functional but visually too flat | Noticeable low-rise volumes, shaded sides and walls |
| 4–5 Rooms/bilingual/audio | Implemented and browser tested | Regression testing with active route UX |
| 6–7 Graph/routing/directions | Algorithm tested, only three B03 edges; live graph unusable | Complete drawing-based graph and real journeys |
| 8 Kiosk origin | Null physical kiosk correctly retained but planning blocked | Explicit named main-entrance planning default; never fake kiosk position |
| 9 Independent QA | Previous limited behavior passed, report write interrupted | Positive real B03 journeys, topology and raised-map visual review |
| 10 Build/deployment | Optimized build and docs existed | Rebuild revised app, refresh actual QA/limitations |

All new delegated tasks use the user-selected Astra Medium. Current graph, scene and routing specialists own separate modules. Integration and independent QA follow their bounded handoffs.

## R2 integrated acceptance — 20 September 2026

- Phases 0–2: original source extraction/alignment retained; deterministic semantic regeneration passed. The completed drawing graph has 149 nodes, 148 edges and 745 navigable areas serving 54 mapped approach references.
- Phases 3–5: raised room volumes, shaded sides, retained source linework and selected-room elevation accepted; bilingual rooms, search, audio and RTL remain integrated. Route framing and partial-route screenshots were independently inspected.
- Phases 6–8: drawing-based routes and geometry-generated directions are active, without an administrative confirmation gate. Main Entrance is the named planning default; custom starts/reset work. All 2,916 ordered approach pairs pass the actual router. Physical kiosk coordinates and metric scale remain unknown.
- Phase 9: 1,296 independent source/geometry assertions pass; the final full Vitest invocation passes all 116 tests in eight files. TypeScript and all 21 malformed-data rejection checks pass. All nine production browser tests pass, including six unchanged visual baselines, real English/Arabic journeys, accessibility, speech and partial-route cases. See the final independent QA report.
- Phase 10: optimized Next.js production build passes, including data validation and canonical asset preparation. Production preview runs at http://localhost:3001; deployment and repeatable pipeline instructions are in README.md and DEPLOYMENT.md.

Source coverage exception: G-06, G-17 and G-23 have explicitly partial exterior approaches because the supplied sheets omit their final ground connections. G-21, G-28 and G-40 use qualified suite entrances. Connected approach coverage does not mean 54 exact physical door arrivals. No architectural gap, measured height, metre scale or accessible route was invented to satisfy coverage.
