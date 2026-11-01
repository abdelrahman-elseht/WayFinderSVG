# Navigation V2 architecture

## Status and boundary

Navigation V2 is an offline diagnostic candidate. `apps/web/app/page.tsx` continues to import only the canonical `data/buildings/B03/GF.graph.json`; no V2 runtime option or production data promotion was made. The candidate is written to `artifacts/navigation-v2/GF.v2.graph.diagnostic.json`.

The generator consumes configured corridor spines and source approach identities/coordinates. At the legacy graph boundary it immediately drops nodes other than source room approaches and drops every legacy edge. It reads only the validated navigable-area polygons, supplied wall segments, calibration/routing metadata, and the 54 approach records. Room directory data and endpoint qualification come from `GF.json` plus `navigation-config.json`.

## Coordinates and safety

All coordinates are the shared Ground Floor master drawing frame documented in `docs/SOURCE_AUDIT.md`; the viewBox is `650 500 3100 1550`. Calibration is null. Distances and tolerances are map-coordinate units, never metres or physical clearances.

`centerline_common.py` shrinks the exact union of navigable areas inward by 0.0001 map units to avoid introducing boundary contacts from connectors. It never buffers outward. Every emitted segment is independently checked with exact polygon coverage, supplied-wall intersection, and room-interior obstacles (including display-only footprints and the bounded AV foyer exception). Output coordinates are kept at full precision and rechecked after serialization. Unknown access restrictions and accessibility remain unknown.

## Graph construction

The manually reviewed corridor spines form the independent network. Their clipped pieces are noded at geometric intersections. Source approach coordinates connect by a covered direct segment or bounded, cached local A* with an 8-unit bound of four targets, 4-unit grid, 100-unit local padding, and 20,000-cell visit ceiling. Every result is checked again against exact source geometry. Search grid points are not exported as routing nodes.

The topology builder cuts each source segment at true intersections and protected approach/attachment points. It compresses degree-two runs into polyline edges while preserving intermediate bends. Each of the 54 stable approach IDs is emitted; shared source coordinates keep their separate room identities. Unsupported attachments remain isolated and are reported. No endpoint chord is selected merely to reduce the component count.

The graph is adapted to the existing TypeScript `NavigationGraph` shape in integration tests and validated by `validateFloorBundle`. The same `findRoute` implementation and route safety validator are used for legacy and candidate OD comparisons. The app continues to use legacy.

## Limits

The current candidate has 175 nodes, 156 edges, and 24 connected components. Fifty-two approaches have incident edges; G-39 and G-40 remain isolated at `[926.4935,1431.457]`. Exact edge checks pass, including zero duplicate undirected edge pairs, but route coverage and source topology do not. This is a diagnostic graph, not a validated navigation network. See `benchmark.md` and the machine-readable artifact reports for current evidence.
