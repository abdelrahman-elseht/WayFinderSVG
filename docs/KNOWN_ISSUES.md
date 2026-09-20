# Known issues

## Current routing scope

Drawing-based navigation is enabled. The source-constrained graph contains 149 nodes and 148 edges and serves all 54 directory approach endpoints. Candidate provenance does not blanket-disable routes; wall/enclosure checks remain mandatory. A named Main Entrance planning origin supplies a usable default while the physical kiosk is unconfigured.

- **Three destinations have incomplete exterior connections:** G-06 Storage, G-17 Stair 4, and G-23 Stair 2. Their visible doors are outside the connected interior network, and the PDFs do not delineate the ground connections needed to reach them. The UI explicitly labels these journeys partial, rather than claiming arrival at another room's entrance. Exact missing source segments and layer evidence are in `EXTERIOR_ACCESS_REVIEW.md`.
- **Some destinations are qualified approaches:** Clinic via Reception, Storage via Services/Kitchen, open circulation landmarks and the skylight perimeter. Per-room bilingual notes explain the endpoint; arrival wording refers to the mapped entrance/approach. A connected approach is not a claim of surveyed exact room-door arrival.
- **Kiosk location is unconfirmed.** The physical kiosk node stays null. Clearing a custom start restores the configured kiosk when present, otherwise the clearly named Main Entrance planning origin; no false 'you are here' marker is introduced.
- **Scale is uncalibrated.** No travel distances may be stated in metres until a real dimension and its endpoints are verified.
- **39 room contours are candidates; 15 rooms use source-label markers.** The automatic stair G-32 contour was rejected after visual review found leakage into the adjoining elevator space. See `SEMANTIC_REVIEW.md` and `data/buildings/B03/GF.review.json` for individual evidence and review actions.
- **Schedule and plan disagree** on several codes/names (notably G-08, G-17, G-24, G-25, G-34). The full inventory preserves both sources and flags conflicts rather than treating a translation or alias as a resolution.
- **Physical accessibility and public access are unknown.** Directory visibility does not assert access. Accessible-only routing excludes unknown links.
- **Content is placeholder copy; no room photos were supplied.** Details use source-map thumbnails and explicit placeholder descriptions.

## Architecture limits

The typed model supports multiple buildings/floors/kiosks and vertical links; only B03 GF source data is supplied. Graph v1 walls/navigable-area arrays do not identify their floor. The router therefore rejects constrained graphs spanning multiple confirmed floors instead of applying one floor's geometry to another. Before commissioning multi-floor routes, introduce floor-scoped obstacle evidence in a versioned contract.

Browser speech depends on installed voices and browser playback policy. The adapter cannot guarantee an Arabic voice on every kiosk; provision and test the chosen kiosk browser or substitute deterministic audio through TTSService.

## QA status

The initial wall-crossing, enclosure-escape and floor-consistency findings are fixed. R2 independently checked all 148 graph edges against the wall evidence and full enclosure union, preserved source hashes/coordinate checks, and passed 1,296 assertions. Positive room-to-room browser journeys and full route-matrix tests replace the previous unavailable-only acceptance tests. Final run details are maintained in `QA_REPORT.md`.

Visual volume height is an illustrative wayfinding convention, not a measured ceiling/wall height. Physical access restrictions and wheelchair suitability remain unknown even when a source drawing route can be calculated.
