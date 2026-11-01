# Navigation V2 benchmark and status

## Acceptance

**FAIL: diagnostic-only; not suitable for runtime promotion.** The candidate is independently generated from 28 configured Ground Floor corridor spines and source approach points. It does not use legacy route edges. Its 175 nodes and 156 edges pass exact walkable-area, supplied-wall, room-interior, endpoint, distance, metadata, and duplicate-pair checks. However, the graph has 24 components, only 52 of 54 approach nodes have incident edges, and G-39/G-40 remain isolated at their shared source approach. The canonical 428-node/627-edge graph remains active.

| Measure | Legacy | V2 diagnostic | Result |
| --- | ---: | ---: | --- |
| Nodes / edges | 428 / 627 | 175 / 156 | Smaller candidate is fragmented, not a demonstrated simplification. |
| Approaches represented / attached | 54 / 54 | 54 / 52 | G-39 and G-40 have no incident edges. |
| Connected components | connected | 24 | Acceptance failure; largest candidate component includes 52 approaches. |
| Cycle rank | not compared | 0 | No alternate cycle has been demonstrated. |
| Exact area failures / wall contacts / room crossings | 0 / 0 / 0 | 0 / 0 / 0 | All emitted edges pass strict geometry checks. |

## Route comparisons

The TypeScript benchmark runs identical source approach IDs through the existing `findRoute` implementation. Lengths are drawing units. Turn counts use a 30-degree threshold. Wall clearance is a map-coordinate distance and is not physical clearance.

| Case | OD | Legacy length / turns | V2 length / turns | Result |
| --- | --- | ---: | ---: | --- |
| Near same-wing | G-01 -> G-05 | 410.68 / 4 | unavailable | V2 disconnected. |
| Far same-wing | G-01 -> G-50 | 890.19 / 4 | 1006.47 / 3 | V2 route is 13.1% longer. |
| Cross-wing | G-50 -> G-05 | 984.21 / 3 | unavailable | V2 disconnected. |
| Previously disconnected area | G-39 -> G-02 | 673.62 / 4 | unavailable | G-39 isolated. |
| Shared approach | G-39 -> G-40 | 1.36 / 1 | unavailable | A shared coordinate does not prove a passage. |
| Qualified partial destination | G-01 -> G-06 | 410.68 / 4 | unavailable | Source partial qualification remains. |

Exact route geometry and safety results are in `artifacts/navigation-v2/route-benchmark.json`. Component and approach evidence is in `candidate-validation.json`, `unresolved-approaches.json`, and `reconstruction-report.json`.

## Source topology diagnostics

The configuration contains 28 source polylines and 54 raw noded pieces. Clipping produces 84 parts and 104 clipped noded pieces, with 29 excluded segments outside the exact navigable union. Diagnosis records 806 geometrically safe endpoint candidates; candidates remain unauthorized unless the source drawing supports the connection. `connectivity-diagnostics.json` records stable IDs, coordinates, and geometry tests. `spine-components.svg` is a locator view, not a route screenshot.

G-39 and G-40 both retain their distinct approach IDs at `[926.4935,1431.457]` and have no incident edges. The shared coordinate does not establish a passage. Other unsupported or disconnected source cases remain in the generated reports.

## Browser review

Port `5250` runs the development-only diagnostic mode when available. Browser captures from earlier route-feedback experiments remain under `artifacts/navigation-v2/port-5250-e2e/`; they show the later experimental graph and must not be used as evidence for this restored candidate. Re-capture browser evidence against the restored candidate before relying on it.

## Validation

- `python -X utf8 scripts/semantic-map/diagnose_centerlines.py`: passed; 17 spines, 32 raw pieces, 49 clipped parts, 62 clipped pieces, 40 excluded gaps.
- `python -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py`: passed; 175 nodes, 156 edges, 24 components.
- `python -X utf8 scripts/semantic-map/verify_centerline_candidate.py`: expected acceptance failure; zero geometry failures, zero duplicate pairs, two intentionally unattached approaches, 24 components.
- `npm.cmd test -- tests/integration/navigation-v2-routing.qa.test.ts`: passed; four tests, including reviewed door entries and west-corridor clearance.

V2 remains diagnostic-only. Runtime graph imports were not changed.
