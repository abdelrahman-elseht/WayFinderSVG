# Corridor topology reconstruction

This page documents the independent offline implementation in `scripts/semantic-map/` for B03 Ground Floor (`GF`).

## Stages and evidence

1. `centerline_common.py` loads the 17 corridor polylines in `navigation-config.json`, the exact GF navigable-area union, supplied walls, room-interior obstacles, and 54 source approach IDs. It discards legacy corridor nodes and edges; legacy areas and walls are constraints only.
2. `diagnose_centerlines.py` accounts for configured spines, clipped descendants, excluded outside-domain segments, noded line pieces, and endpoint pairs within 130 map units. It assigns stable IDs and records coordinates, source references, exact area/wall/room tests, and a disposition. A geometrically safe chord remains unauthorized without source evidence.
3. Reconstruction clips source spines against an inward-only 0.0001 map-unit domain margin, nodes intersections, and joins each source approach by direct projection when exact checks pass. A bounded local A* fallback uses a 4-unit grid, 100-unit local padding, at most 20,000 visited cells, and four nearest spine targets. Simplified output is revalidated against the unbuffered source domain, walls, and room interiors.
4. Segments are cut at junctions, approach nodes, and projected attachments. Degree-two runs become polyline edges with source bends preserved. No bridge between disconnected spine components is automatically introduced.
5. The verifier checks exact domain coverage, wall contacts, room-interior crossings, edge endpoints, distances, evidence metadata, duplicate edges, approach identity, and graph components. Integration tests use the existing Dijkstra router and route-level validator.

The 0.0001 inset, 1e-8 point identity threshold, A* settings, and 130-unit endpoint diagnostic radius are drawing-coordinate tolerances, not physical measurements.

## Current status

The restored pre-feedback candidate has 198 nodes, 155 edges, 43 components, 52 attached approaches, and cycle rank zero. All emitted edges pass exact safety checks. G-39 and G-40 remain isolated at their shared source approach. The graph is fragmented and diagnostic-only; see `benchmark.md` for route comparisons and remaining gaps.
