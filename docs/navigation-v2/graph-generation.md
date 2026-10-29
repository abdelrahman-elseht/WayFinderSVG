# Corridor topology reconstruction

This page documents the independent offline implementation in `scripts/semantic-map/` for B03 Ground Floor (`GF`).

## Stages and evidence

1. `centerline_common.py` loads the 17 original configured polylines plus five separately reviewed GF connections from `navigation-v2-config.json`, the exact GF navigable-area union, supplied walls, room-interior obstacles, and 54 source approach IDs. Legacy corridor nodes and edges are discarded; legacy areas and walls are constraints only. Drawing coordinates and unknown calibration are preserved.
2. `diagnose_centerlines.py` accounts for each configured spine, every clipped descendant, excluded outside-domain segments, noded line pieces, and endpoint pairs within 130 map units. It assigns stable IDs and records coordinates, source references, exact area/wall/room tests, and a disposition. A geometrically safe chord remains unauthorized unless a separate reviewed record cites source evidence.
3. Reconstruction tests configured segments against the exact domain. Safe segments retain their endpoints so a real boundary junction is not severed by the numerical inset; unsafe or clipped segments use the inward-only 0.0001 map-unit margin. Source approaches attach by direct projection when exact checks pass. A bounded local A* fallback uses a 4-unit grid, 100-unit local padding, at most 20,000 visited cells and four nearest spine targets. Its simplified output is revalidated against the unbuffered domain, walls, and room interiors.
4. Every segment is cut at true junctions, approach nodes, and projected attachments. Degree-two runs become polyline edges with source bends preserved. Stable edge IDs derive from serialized coordinates and node IDs.
5. The verifier checks exact domain coverage, wall contacts, room-interior crossings, edge endpoints, distances, evidence metadata, duplicate edges, approach attachment, and graph components. Integration tests validate the runtime contract and use the existing Dijkstra router and route-level validator.

The five reviewed GF connections cover the AV foyer north entrance, the Mechanical Lab approach, the central lobby approach toward G-10, the south entrance to the toilet vestibule, and the VIP lobby branch. Each is recorded with coordinates and source references in `scripts/semantic-map/navigation-v2-config.json`; the loader rejects any that fails exact geometry checks.

The 0.0001 inset, 1e-8 point identity threshold, A* settings, and 130-unit diagnostic radius are map-coordinate tolerances, not physical measurements.

## Current status

The latest diagnostic graph has 196 nodes, 162 edges, 38 components, 52 attached approaches, and cycle rank four. All emitted edges pass exact area, wall, and room-interior checks. G-39 and G-40 remain isolated at their shared source approach, and other disconnected components remain. The graph is diagnostic-only and fails the runtime promotion gate. See `benchmark.md` for route results and browser evidence.
