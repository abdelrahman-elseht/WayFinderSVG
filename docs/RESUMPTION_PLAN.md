# Resumption and revised acceptance

The user requested continuation after rate limits, fully functioning routing instead of an administrative review block, visibly raised 2.5D room/wall geometry, and Astra Medium for every delegated task.

## Saved state
Source audit, deterministic vector merge, 54-room inventory, bilingual services, room UI, abstract routing engine, initial integration and production build were completed. Last saved evidence reports 108 unit/integration tests, 18 malformed-data checks, 370 independent source/geometry checks and eight production browser tests passing. The final QA report/handoffs were interrupted and still contain stale stage-1 descriptions.

The primary functional gap is real B03 navigation: the generator only built a three-edge candidate graph between two labs, the router required field-confirmed access, and the unconfigured kiosk supplied no start. The initial scene technically extruded room contours but its height was too small to read as 2.5D.

## Revised contracts
`NavigationGraph.routingPolicy` is optional, default `verified-only` for backwards compatibility. Explicit `drawing-based` enables routes based on computationally validated source geometry, preserving candidate source provenance and unknown physical access instead of pretending that field inspection occurred. Drawing mode must have actual navigable areas, reject walls/voids/invalid geometry, reject closed links, and exclude unknown wheelchair accessibility when that filter is requested. Unknown source geometry must not be made valid by changing a flag.

`FloorData.navigationDefaults.startRoomId` is an explicit route-planning origin when a physical kiosk node is absent. B03 may use its source Main Entrance G-01, labeled as the selected starting point, never as a measured kiosk location or 'you are here'. Custom starts and configured kiosk nodes continue to take precedence.

Scale remains unknown unless calibrated to source endpoints; no invented metre distances. Room geometry and door ambiguity remain documented. Illustrative mesh height is a visualization convention, not surveyed building height.

## Delegation and DAG
1. Graph specialist: complete source-derived circulation and room approach endpoints; deterministic generator and reviewed topology; all-pairs route coverage with wall/area checks.
2. Scene specialist: raised room volumes, side materials/wall rims, orthographic tilt, lighting, readable labels and visible routes; independent of graph generation.
3. Routing specialist: drawing policy, strict geometric validation, bilingual direction engine and useful route result; backwards-compatible verified policy.
4. Integration specialist: default planning origin, active route UX, renderer integration, data validation and updated documentation.
5. Independent QA: actual B03 route journeys, cross-building-wing all-pairs checks, door/void/wall geometry, visual inspection, localization, accessibility and production build.

Agents use `gpt-6-astra` with `medium` reasoning and isolated bounded contexts. Ownership is explicit and non-overlapping. Review failures return to the owning agent. Do not reuse old tests that merely expect the main feature to be unavailable as proof of route completion.

## Completion record

The revised graph, routing policy, raised scene and application integration are implemented and accepted against the source coverage described in KNOWN_ISSUES.md. All 54 mapped approach references are connected; the three undocumented exterior connections remain explicitly partial in the interface. Actual route-matrix coverage is 2,916 passing pairs. The full 116-test suite, 21 invalid-data rejection checks, typecheck and optimized production build pass. See QA_REPORT.md for the independent production browser and visual results, and EXECUTION_LOG.md for the phase-by-phase acceptance record. No further administrative approval is required to use ordinary drawing-based navigation.
