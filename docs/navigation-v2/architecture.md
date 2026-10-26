# Navigation V2 architecture (diagnostic stage)

## Status

The V2 work currently produces an **offline candidate graph only**. It is not imported by the application and must not be used for visitor routing. The latest strict verifier finds 115 disconnected components and only 46 of 54 expected approach node IDs; G-06, G-17, G-19, G-20, G-21, G-28, G-39, and G-40 are missing. G-39 and G-40 additionally have no validated connector in the reconstruction report. The canonical runtime graph remains `data/buildings/B03/GF.graph.json`.

The diagnostic graph is `artifacts/navigation-v2/GF.v2.graph.diagnostic.json`; the summary is `artifacts/navigation-v2/reconstruction-report.json`. These generated files describe a partial candidate result, not a release artifact.

## Data flow

`scripts/semantic-map/navigation-config.json` supplies the manually reviewed GF corridor spines, corridor half-width and endpoint evidence. `data/buildings/B03/GF.graph.json` supplies the walkable-area union, wall segments, and the coordinates and IDs of the existing 54 approach nodes. `data/buildings/B03/GF.json` supplies room identities and their `doorNodeId` references. `scripts/semantic-map/reconstruct_centerline_graph.py` clips the spines to the walkable union, constructs candidate corridor connections, attaches room approach points, nodes and merges the linework, then writes the diagnostic graph and report under `artifacts/navigation-v2/`.

The legacy graph contributes no path or edge geometry to that process. It is read only for evidence coordinates and the geometric safety constraints. This keeps the reconstruction independent while retaining reviewed source-derived endpoint identities and the safety domain already used by the current runtime contract.

The separate `scripts/semantic-map/diagnose_centerlines.py` script records the raw clipped-spine connectivity and writes a colored component visualization and endpoint-pair report. It is a diagnostic aid; its endpoint pair candidates are not accepted connections.

## Geometry and topology

Coordinates are the drawing/map coordinate system from the source-derived GF data. The data has no confirmed metre calibration (`metersPerUnit` is `null`), so lengths in the candidate graph are `map-unit`, not metres. Shapely represents spines and edge paths as `LineString`s and the navigable union as a union of polygons. The current strict safety helper accepts a line only if the exact unbuffered walkable union covers it (`domain.covers(line)`) and no indexed supplied wall intersects it. A separate 0.02 inset is used for bounded local A*; it does not relax final edge validation.

The generator uses `unary_union` to node crossings and `linemerge` to preserve long corridor geometry as polylines. Endpoints of merged lines, room approach coordinates, and connector attachment points become graph nodes. Intermediate coordinates remain in edge geometry. Candidate connections between disconnected spine components are direct endpoint chords admitted only when they pass the geometric safety helper. A Kruskal-style pass selects connections that join component groups and also retains short safe alternatives within the configured threshold. This is a pragmatic reconstruction stage; the component joining policy still requires review against the rendered source drawing and does not establish a physical passage by itself.

Room approach nodes retain their legacy IDs. For each room, the script projects the approach point to nearby skeleton linework; safe direct joins are preferred. A bounded local A* search is attempted only for an approach join when direct candidates fail. The local grid exists only during preprocessing; its vertices are not emitted as graph nodes. G-39 and G-40 currently share the coordinate `[926.4935, 1431.457]` and both fail this connector stage.

## Routing contract and limits

The candidate graph has node and edge fields shaped for the existing graph contract, but it remains candidate data and does not prove full compatibility with runtime validation. Edges carry their polyline length as `distance`, `distanceUnit: "map-unit"`, `accessibility: "unknown"`, `restriction: "unknown"`, `status: "candidate"`, and bidirectional directionality. Room approach nodes are also marked candidate. Existing routing policy, partial-route notes, and access classifications remain in the canonical runtime bundle; this candidate generator does not promote or rewrite them.

Before runtime adoption, the candidate needs complete approach connectivity, route-level regression against legacy, review of all selected component links and alternatives, and validation through the actual TypeScript graph validator and router. See [benchmark](benchmark.md) for measured current results.

## Decisions and trade-offs

- Manually configured spines are the source network. Automatic medial-axis extraction is not used; the previous experiment fragmented the geometry and did not resolve source connectivity.
- Geometric checks reject unsafe candidate joins. They cannot authorize a passage absent supporting source geometry.
- Multiple safe alternatives are retained rather than reducing the result to a spanning tree, but the current short-alternative threshold is heuristic and requires semantic review.
- There is no arbitrary node-count target. The latest strict result has 172 nodes and 57 edges but 115 disconnected components, with only four room approaches in its largest component. Its lower count reflects severe fragmentation, not successful simplification.
- No projection/rendering changes are part of this reconstruction stage.
