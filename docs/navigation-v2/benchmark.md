# Navigation V2 benchmark and status

## Acceptance

**FAIL: diagnostic-only; not suitable for runtime promotion.** This B03 Ground Floor (`GF`) candidate is independently generated from 17 original corridor spines, five separately reviewed source connections, and source approach points. It does not use legacy route edges. Its 196 nodes and 162 edges pass exact walkable-area, supplied-wall, room-interior, endpoint, distance, and metadata checks. The graph has 38 components and 52 of 54 approaches have incident edges. G-39/G-40 remain isolated at a shared approach by request; other disconnected components also remain. The canonical 428-node/627-edge graph remains active.

| Measure | Legacy | V2 diagnostic | Result |
| --- | ---: | ---: | --- |
| Nodes / edges | 428 / 627 | 196 / 162 | Smaller candidate remains fragmented. |
| Approaches represented / attached | 54 / 54 | 54 / 52 | G-39 and G-40 have no incident edges. |
| Connected components | connected | 38 | Promotion gate fails. Largest component includes 39 approaches. |
| Cycle rank | not compared | 4 | Some alternatives exist, but full route coverage is absent. |
| Area failures / wall contacts / room crossings | 0 / 0 / 0 | 0 / 0 / 0 | Every emitted candidate edge passes exact checks. |

## Route comparisons

Lengths are drawing units. Turn counts use a 30-degree threshold over assembled route vertices. Wall clearance is a drawing-coordinate distance and is not physical clearance. The TypeScript tests run identical source approach IDs through the existing `findRoute` implementation.

| Case | OD | Legacy length / turns | V2 length / turns | Result |
| --- | --- | ---: | ---: | --- |
| Near same-wing | G-01 -> G-05 | 410.68 / 4 | unavailable | Still disconnected. |
| Far same-wing | G-01 -> G-50 | 890.19 / 4 | 1006.47 / 3 | 13.1% longer. |
| Cross-wing | G-50 -> G-05 | 984.21 / 3 | unavailable | Still disconnected. |
| Previously disconnected area | G-39 -> G-02 | 673.62 / 4 | unavailable | G-39 remains isolated by request. |
| Shared approach | G-39 -> G-40 | 1.36 / 1 | unavailable | Shared point does not prove a passage. |
| Qualified partial destination | G-01 -> G-06 | 410.68 / 4 | unavailable | Partial source qualification is retained. |
| Valve Room | G-01 -> G-10 | 584.14 / 4 | 629.08 / 4 | No south/north/south return bend; 7.7% longer than legacy. |
| Lower lobby | G-07 -> G-10 | 209.20 / 3 | 276.68 / 4 | Connected; longer than legacy. |
| Mechanical Lab | G-01 -> G-43 | 1399.95 / 3 | 1497.22 / 4 | Connected through its source-backed approach. |
| AV Control Room | G-01 -> G-44 | 1414.41 / 5 | 1579.81 / 5 | Uses the shared AV foyer and corrected G-44 entrance. |
| Female Toilets | G-01 -> G-12 | 832.96 / 4 | 884.19 / 4 | Uses the documented toilet vestibule opening. |
| Male Toilets | G-01 -> G-13 | 985.53 / 3 | 1063.53 / 4 | Uses the documented toilet vestibule opening. |
| AV Control to Meeting Room | G-44 -> G-30 | 628.71 / 1 | 716.44 / 4 | Connected via west circulation, without crossing G-30; prior V2 result was unavailable. |

Exact polylines and route safety results are in `artifacts/navigation-v2/route-benchmark.json`. Component and approach evidence are in `candidate-validation.json`, `unresolved-approaches.json`, and `reconstruction-report.json`.

## Source connections and unresolved areas

The five additional GF connections in `scripts/semantic-map/navigation-v2-config.json` cover the AV foyer north entrance, Mechanical Lab approach, central lobby approach toward G-10, south toilet-vestibule entrance, and VIP lobby branch. Coordinates and source references are recorded per connection, and the generator checks every complete line against the exact navigable union, supplied walls, and room-interior obstacles.

G-39 and G-40 retain distinct source identities at `[926.4935,1431.457]` and have no incident edges. This preserves the requested isolation and avoids asserting a passage at a shared point. G-41 and G-42 also remain disconnected from G-01 in the current browser checks. Other graph components and unavailable route cases prevent runtime promotion.

The generator reports 22 configured spines, 43 raw noded pieces, 81 clipped parts, 97 clipped noded pieces, 40 excluded gaps, and 477 geometrically safe endpoint candidates. Safe candidates remain unauthorized unless supported by a separate source review record.

## Browser checks

The diagnostic view is running at `http://127.0.0.1:5250/` with the visible development-only V2 banner. GPT-6.1 Sol medium browser checks on the GF graph report routes for G-01->G-10, G-07->G-10, G-01->G-43/G-44/G-12/G-13, and G-44->G-30. G-01->G-41/G-42 and G-39<->G-40 remain unavailable. Captures are under `artifacts/navigation-v2/port-5250-e2e/`, including `final-g-01-g-10.png`, `final-g-01-g-43.png`, `final-g-01-g-44.png`, `final-g-01-g-12.png`, `final-g-01-g-13.png`, and `final-g-44-g-30.png`.

## Validation

- `python -X utf8 scripts/semantic-map/diagnose_centerlines.py`: passed; 22 spines, 43 raw pieces, 97 clipped/noded pieces, 40 excluded gaps.
- `python -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py`: passed; 196 nodes, 162 edges, 38 components.
- `python -X utf8 scripts/semantic-map/verify_centerline_candidate.py`: expected acceptance failure; zero edge geometry failures, two unattached approaches, 38 components.
- `npm.cmd run validate:data`: passed for canonical GF and floor 01 bundles.
- `npm.cmd run test:data`: passed, 21 malformed-data rejection checks.
- `npm.cmd run typecheck`: passed.
- `npm.cmd test -- tests/integration/navigation-v2-routing.qa.test.ts`: passed; contract, route comparisons, targeted GF regressions, and strict route checks.

The app imports were not changed. V2 remains diagnostic-only; no runtime promotion, merge, or push occurred.
