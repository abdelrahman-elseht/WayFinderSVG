# Exterior access source review

Reviewed the original PDF (all source layers), source vectors, ingestion audit and current navigation configuration. Coordinates below are master coordinates: source 0002 display plus [1033.29,-28.35]. PNGs are original-PDF visual QA, not geometry extraction. Exact source items and transformed points are in `artifacts/qa/r2-exterior-vector-evidence.json`; reproduce with `.venv/Scripts/python.exe scripts/source-review/exterior_review.py`.

## Result

No continuous, bounded source-ground route from interior circulation to the actual G-06, G-17 or G-23 door can be asserted from these PDFs alone. This is a specific missing-surface finding, not a requirement for generic administrative approval. Do not present a different room's entrance as successful arrival at these rooms. A partial route must be explicitly partial; completing these three requires an additional exterior/site ground-surface source that covers the gaps below. Their doors themselves are present and should remain the actual destination identities.

### G-06 Storage

Actual exterior door: source `0002-path-08027`, master opening midpoint approximately [3432.67,1044.70]. It is separated from the auditorium by the continuous auditorium side wall. A real auditorium side exit is depicted by swing arcs `07929` and `07930`. Outside it is a bounded landing and two ramps, `07131`/`07132` on A-RAMP-8%, with handrails `07162`-`07164`. The ramp segment nearest Storage ends at the line from [3397.71993,1086.56003] to [3431.95016,1100.18003], midpoint [3414.83505,1093.37003]. The straight gap from that midpoint to the Storage opening is about 51.8 drawing units. It has no delineated slab, landing extension or walkway edge. Going around the railing into that blank region is not source-backed walking-area geometry. Overhead column symbols to the east do not establish ground pavement. No complete route polyline is approved by this review.

### G-17 Stair 4

Actual exterior door: `0002-path-08038`, opening midpoint approximately [3150.76,1698.99]. The door opens east into the space between the stair facade and exterior column symbols, immediately north of projecting G-21 Storage. The exterior drawing has no bounded landing or walkway linking this door to the auditorium ramps farther north or to an interior exit farther south. A perimeter detour would also need to go around the projecting Storage/Service footprint; an arbitrary buffer around the building would invent this ground connection. The missing segment is the entire exterior ground connection from an established exit/landing to the door, not the door geometry.

### G-23 Stair 2

Actual exterior door: `0002-path-08275`, opening midpoint approximately [2073.77,1714.68]. It opens onto an actual separate landing and west-running ramp: `07133`/`07134` on A-RAMP-8%, direction `07144`, and handrails `07145`/`07146`. Its envelope is approximately [1888.27,1716.89,2137.93,1776.44]. The south Main Entrance ramp `07093` is a different structure with envelope [2255.89,1701.92,2315.02,1857.77]; the other entrance ramp is `07071`. The Security room wall and projecting southern structural footprint prevent a direct connector between these landings. The actual route would need additional ground paving around that footprint and around the ramp handrails. None is delineated. The west end of the Stair 2 ramp also terminates in unspecified exterior ground, not a documented interior route.

## Excluded-layer check

The raw export includes A-SLABEDGE, A-RAMP-8%, A-RAMP-DIRECT, A-STAIR-EXT, A-STAIR-EXT-HANDRAIL, A-STAIR-EXT-HIDDEN, A-FLOR-OVHD and U-GLMLAY$0$LS-SITE-ARCH-BSMT. The SITE layer has **zero bounding-box intersections** with each reviewed G06/G17/G23/front region (persisted in the evidence JSON). A-SLABEDGE does not add a continuous perimeter pavement here. Roof/overhead marks and structural column footprints cannot be relabeled as traversable ground. The original PDF crops show the same discontinuities; presentation cleanup did not conceal a continuous exterior sidewalk.

## Two positive internal-source findings sent to graph owner

1. **G14/toilet branch is open internally.** The narrow strip between Stair 3 and toilets connects at its bottom. The apparent barrier from approximately [2832.01,1621.64] toward [2862.10,1630.73] is dashed A-DOOR-STEP geometry (`09911`-`09955`), not a wall. Wall `06040` is only the small west jamb; `06039` is the opposite wall. A center crossing near [2846,1628] is within the actual opening. Continue up the source-bounded strip toward G14. `r2-exterior-lobby14-bottom.png` and `-context.png` show the connection. Derive final route coordinates from the wall-constrained domain, not these illustrative center samples.
2. **G44 AV Control has a real foyer door.** Leaf `0001-path-11645` starts at hinge [1255.60010,1186.96997]; opposite jamb `11647` is [1279.87012,1180.16003]. Arc `11655` has TWO cubic items: its final end is [1279.85791,1180.12732]. Using the first cubic's endpoint [1277.57471,1199.29395] produces a false diagonal seal. The north shared AV foyer is accessible via its north double door and opens east into the studio. G44 can target its own opening rather than a substitute studio endpoint. See `r2-exterior-av-control.png`.

No production routing/config files were edited during this independent review.
