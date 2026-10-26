# Corridor topology reconstruction

This page describes the current code in `scripts/semantic-map/reconstruct_centerline_graph.py`. The output remains diagnostic and incomplete.

## Pipeline

1. Load `navigation-config.json`, GF room data, and the canonical GF graph. Build the navigable-area polygon union and an STRtree over the supplied wall segments.
2. Clip each configured corridor spine to the walkable union. Keep line parts longer than 0.5 map units. The present run begins with 31 configured/raw disconnected components and yields 62 clipped/noded line components (49 retained clipped parts before union; the exact definitions differ by stage).
3. Node overlaps/crossings with Shapely `unary_union`. Enumerate component endpoints, query nearby endpoint buffers using `STRtree`, and make direct connector candidates within twice `corridorHalfWidth`.
4. In the current strict reconstruction, accept a candidate only if `domain.covers(line)` is true for the complete segment and it has no intersection with any supplied wall. The predicate uses the unbuffered walkable-area union; a geometric near-miss is rejected. Sort deterministically by length and endpoint identifiers. Use a union-find/Kruskal pass to select connections between component groups, then retain safe alternatives no longer than 0.75 times `corridorHalfWidth`.
5. For every room with an existing `doorNodeId`, project its source approach point onto the assembled skeleton. Choose the shortest strict-safe direct connector within twice the half-width. If none exists, consider up to four nearest skeleton pieces and run a bounded local A* on an 8-unit grid in a local box with 100-unit padding. The local search polygon is inset by 0.02; the final serialized polyline must pass the exact unbuffered walkable-domain and wall check. No grid vertices enter the output graph.
6. Union in room links, node intersections, merge connected line strings, and use merged line endpoints as topology nodes. Room approach points and their attachment points are protected. The coordinates between endpoints are retained as edge polylines.
7. Emit corridor and door edges with polyline-derived lengths. Duplicate undirected endpoint pairs are skipped. Recheck each rounded/serialized edge against the exact domain and walls; rejected serialized edges are recorded rather than emitted. Write the candidate graph and a summary including unresolved rooms.

The diagnostic companion `scripts/semantic-map/diagnose_centerlines.py` independently reports clipped component endpoints and their nearby pair candidates, with distance and geometric rejection classification. Its SVG colors components and overlays the first 250 candidate chords. Those chords are exploratory evidence, not proposed or accepted doorways.

## Tolerances and mathematical notes

`corridorHalfWidth` is 65 drawing units in the current config. It controls endpoint search radius and maximum straight room join; component candidates are searched within twice this value. The 0.02 buffer/inset is a numerical margin in drawing coordinates. A direct connector uses Euclidean segment length. A* uses eight grid-neighbor moves with Euclidean edge cost and a straight-line heuristic. The local search is bounded spatially by the endpoint pair plus 100 units, with grid step 8.

These are map-coordinate tolerances, not physical measurements. They are configurable only through the script constants/config described above. They need evidence-based calibration and regression before being treated as authoritative building tolerances.

## Current findings and exact unresolved approaches

The latest strict `reconstruction-report.json` records 31 raw components, 62 clipped-spine components, 175 safe direct join candidates, 104 selected candidate links, 46 approaches present by node ID, 172 nodes, 57 emitted edges, and 115 resulting graph components. The strict graph verifier independently confirms 46/54 approach IDs, with G-06, G-17, G-19, G-20, G-21, G-28, G-39, and G-40 missing. Only four approaches lie in the largest component. It finds zero exact-domain edge failures, zero wall contacts, and zero room-interior crossings, but overall acceptance remains **FAIL** because connectivity and endpoint coverage fail. One serialized edge is rejected by the exact post-rounding geometry check. Strict mode rejects near-miss joins that a buffered-domain predicate would accept; the reduced node/edge count therefore reflects severe fragmentation, not successful simplification. G-39 and G-40 both reference `[926.4935, 1431.457]`; direct projection and bounded local A* find no connector covered by the walkable area and clear of supplied walls. Inspect the source lines, reviewed door/approach evidence, and domain boundary around that coordinate. Do not bridge it by assumption.

The first-stage diagnostics are available at:

- `artifacts/navigation-v2/spine-components.svg` — component IDs/colors and exploratory endpoint chords.
- `artifacts/navigation-v2/connectivity-diagnostics.json` — 62 component lengths and 1,774 sorted endpoint-pair candidates, each with distance, classification, and validation result.
- `artifacts/navigation-v2/reconstruction-report.json` — reconstruction counts and unresolved room records.

`diagnose_centerlines.py` classifications are heuristic. In particular, a safe chord is not proof that the drawing shows a connecting corridor, and an unsafe chord classified as unresolved does not distinguish an intentional separation from incomplete source geometry. Review against source drawings before making semantic decisions.

## Graph example

An emitted corridor edge has `from`, `to`, `geometry` (ordered map-coordinate points), and `distance` equal to the Shapely polyline length. Its current metadata marks status, accessibility, and restriction as candidate/unknown. Door edges retain the existing room approach node ID at one endpoint. This diagnostic shape must pass runtime contract and routing checks before any promotion.
