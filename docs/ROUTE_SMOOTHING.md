# Safe visual route smoothing

Both configured floors (`GF` and `01`) use the same implementation. Graph JSON,
pathfinding, route distance, instructions, accessibility rules and raw route
points are unchanged.

`packages/routing/src/visual-route.ts` prepares a detached graph snapshot and
compiles the existing geometry validator once per graph. `WayfindingApp` memoizes
the complete visual route per routing result. `FloorMap` renders its revealed
prefix with the existing teal stroke and white underlay; raw coordinates still
control framing and endpoint markers.

## Algorithm and safety

Exact duplicates are removed. Collinear vertices and small zigzags are removed
only when the replacement segment passes the existing wall/enclosure checks.
Deviation is bounded to two drawing units against the entire original subchain,
with monotone projections; repeated removals cannot accumulate into a shortcut.
Short genuine turns and near-reversals are retained. Each eligible
turn is replaced with a sampled quadratic Bezier whose control point is the
original corner. Tangent trim distances are capped by both adjacent segment
lengths, leaving straight connectors between successive curves.

Door, entrance, kiosk, stairs, elevator and room-associated anchors remain exact.
Ordinary corridor junctions are eligible regardless of degree. Junctions at changes
in accessibility, restrictions or floor identity remain exact. Non-corridor
transition geometry is also protected in full, including both landing points.
Callers may supply additional protected source vertex indices.

Every curve chord and retained connector must stay inside the supplied
navigable-area union and have no contact with supplied walls. The initial trim is
the lesser of 48 units and 48% of each neighboring segment, leaving at least 4%
between adjacent curves. Rejected candidates halve their trim distance until a
safe candidate is found, then refine the safe/unsafe bracket to within 0.1 units
(or the attempt budget). Keep the largest explicitly validated candidate, never
an inferred-safe curve. If all attempts fail, retain the original corner.
Validate the complete assembled polyline again before returning it. Missing,
invalid or mixed-floor enclosure evidence disables smoothing. Invalid nonfinite
coordinates return an empty visual route.

## Playback

Samples carry monotonically increasing distances on the original route. Reveal
interpolates between these fixed samples at the existing normalized original
distance progress. Straight portions retain their original progress positions,
corners never regenerate during animation, and completion returns the same full
visual geometry. Duration and instruction logic continue to use the raw route.
Camera following uses the same revealed endpoint as the line.

## Recommended defaults

All lengths are SVG drawing units, not world units or metres.

| Option | Default | Meaning |
| --- | --- | --- |
| `radius` | 48 | Maximum tangent trim, not a circular radius (previously 12) |
| `minRadius` | 0.5 | Smallest useful trim |
| `segmentFraction` | 0.48 | Maximum trim on each neighboring segment; must be below 0.5 (previously 0.35) |
| `maxSegmentLength` | 1 | Upper bound for sampled curve chord length |
| `maxDeviation` | 0.05 | Quadratic-to-chord deviation bound |
| `minTurnDegrees` | 2 | Below this, try a validated straight shortcut |
| `maxTurnDegrees` | 165 | Keep near-reversals unchanged |
| `attempts` | 16 | Halving followed by validated bracket refinement (previously 8, halving only) |
| `simplifyTolerance` | 2 | Maximum original-subchain deviation for safe zigzag removal |
| `protectedIndices` | none | Additional exact source anchors |

`onDiagnostics` is an opt-in callback for tests/development tools. It reports each
original nonduplicate interior vertex's original/effective angle, requested,
available and accepted trim, protection reason, rejected candidate count and
outcome (`rounded`, `safe-simplification`, `protected-anchor`, `unsafe-geometry`,
`below-minimum`, `near-collinear`, `near-reversal`, `sampling-limit` or
`final-validation`). The application does not enable it or log diagnostics.

Sampling uses at least eight and at most 512 segments per corner. If a candidate
would exceed the cap, reduce its radius instead of lowering sampling quality.
Attempts have a hard cap of 32. Invalid numeric configuration disables smoothing.

## Limits and verification

Safety applies to the actual rendered centerline chords against supplied drawing
geometry. Pixel-wide strokes are not physical clearance envelopes. Missing
architectural evidence cannot be inferred, and protected/tight corners can remain
angular. This changes presentation, not physical-access or accessibility claims.

Unit tests cover turn angles, short segments, reversals, duplicates, narrow
corridors, walls, unsafe shortcuts, anchors, fallback and continuous playback.
Integration tests validate routes on both real floor graphs and React playback,
including reduced motion. Existing routing and data-contract tests remain gates.

## Sharp-corner investigation (2026-10-18)

The previous anchor policy locked every intermediate vertex on GF G-01 to G-50
and G-01 to G-05. Most were ordinary corridor junctions protected solely because
their graph degree exceeded two. These routes received zero curves and
zero validator rejections: the sharp shape came from anchor policy, not animation,
Three.js line joins or safety fallback. Floor 01 F-01 to F-50 similarly rounded
zero corners; F-01 to F-34 rounded only one. Protected collinear vertices also
prevented simplification and left 3-unit segments that capped trims at 1.05 units.
The 12-unit ceiling and 35% segment cap were secondary limits: after unlocking
corridor nodes, they would still restrict the size of visible turns.

At the GF entrance corridor point [2358,1017], the 45-degree turn now accepts a
48-unit trim. On Floor 01, [2376,1209] rejects larger curves and accepts 35.90625
units. Exact door/approach landings still remain angular where required.
`FloorMap.RouteOverlay` already passes the same sampled points to both 5px teal
and 10px white lines; `WayfindingApp` caches full geometry and `routePlayback`
reveals it by original distance. No changes to those components were necessary
for this correction.

Matched 1440x1000 browser captures and per-corner JSON are under
`artifacts/corner-rounding/{before,after}/` for GF G-01 to G-50/G-05 and
01 F-01 to F-50/F-34. The test uses the same endpoints, reduced motion, viewport,
closed details panel and unchanged raw-route camera framing for both stages.
