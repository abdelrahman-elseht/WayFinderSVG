# B03 ground floor semantic review

## Complete raised blocks (2026-10-12)

`display-config.json`, `display_contours.py`, `display_closures.py` and `features.py` now generate candidate display geometry separately from label-containing semantic polygons. This retains every original source anchor and route qualification. Floor 01 adds F-11/F-12/F-13 (complete compound door swings), F-35 (0.35-unit drafting gap tolerance), F-19 and F-23 (source labels displaced from the enclosed face). GF adds G-10, G-18, G-19 and G-32. GF cafeteria/service closure requires source A-HPL boundaries and the A-STAGE & STEP return `0002-path-11503`; the stair face is separated from its lift by source handrails. Investigation seeds/windows select closed faces and cannot create a boundary.

Each floor adds five candidate lift-cabin envelopes and two source escalator rail envelopes. Rooms, stairs and equipment use the same illustrative height; open corridors/lobbies remain low and the skylight remains a void. No surveyed height, physical accessibility or inter-floor connection is asserted. The five Floor 01 schedule-only exceptions still lack source positions and remain unplaced.

Recovered GF cafeteria/service solids exposed old graph paths through those rooms. They are now excluded from the navigable union; G-19/G-20/G-21 end at the source cafeteria entrance with bilingual suite qualifications and preserved final-door evidence. All 54 GF approaches remain connected in the regenerated 428-node / 627-edge graph. First Floor's 323-node / 452-edge graph is unchanged. `tests/qa/display_footprints.py` independently checks dense source-boundary support, room overlap and every graph edge against new room/equipment solids. Generated overlays mark display-only outlines with `D`.

## First Floor phase 2 bundle

### Southern corridor and rendering correction (2026-10-12)

The former spine from `[2190,1245]` to `[2440,1420]` crossed source A-WALL paths `0002-path-07511`, `0002-path-07512` and `0002-path-07513`. Wall subtraction therefore disconnected the southern corridor. The corrected trace follows the open passage north of those boundaries and west of the eastern lift/stair core, via `[2405,1270]`, `[2475,1350]` and `[2470,1410]`. These are candidate corridor investigation points in the existing master frame, not new room geometry or surveyed positions.

Graph reduction now retains alternate source-safe paths whenever a retained path would exceed the full-grid reference. The 323-node / 452-edge network preserves all 1,275 supported endpoint pairs within the existing 0.05-unit rounding tolerance; a rooted-tree negative control fails 975 pairs. F-20 to F-34 is 1,184.432 drawing units instead of 3,175.7521; F-21 to F-34 is 1,318.7796. All 51 supported approaches remain connected. Source-door landing extensions now carry portal IDs, trace points and widths in the shortest-path review for independent bounded-envelope checks. Original dense source-wall, room-solid and stair-solid rejection remains mandatory.

The renderer previously rasterized the SVG into a fixed 2:1 texture using SVG's default letterboxing. It now maps the complete canonical viewBox edge-to-edge before the world plane restores the floor's aspect ratio. Room selection stays anchored to the plan, and route lines depth-test against raised solids without writing depth into their own underlay. This corrects apparent lift/block crossings without moving route coordinates or weakening obstacle checks. Heights remain illustrative, all 38 outlines remain candidates, and unresolved source contours remain markers.

Floor `01` reconciles all **59** schedule identities in `data/buildings/B03/01.review.json`. It contains **54 directory records**, **38 candidate contours**, and **16 source-label markers**. F-10, F-18, F-28, F-29 and F-45 lack an in-bounds source plan label; their individual review rows retain schedule names/evidence with null room/position rather than fabricated coordinates. LOT LAB and AL LAB remain literal source names. Arabic names are documented editorial translations.

F-17 occurs at two distinct stair enclosures; the selected eastern marker retains both alternatives and its route connection is withheld. F-49 has an exterior marker with no delineated walking connection. F-57 lacks a continuous supported approach. These three rooms remain discoverable with bilingual unsupported notes. F-30 uses a source-safe landing around the western enclosure. F-12/F-13 route to the source-supported Bionics and Rehabilitation Lab suite entrance (`0002-path-10302`), with bilingual qualifications for both directions.

The source-bounded graph retains connected pair paths and cycles while preserving disconnections. Mapped circulation approaches reuse retained junctions with room identity; portal approaches retain swing/leaf IDs. All 51 supported endpoints are qualified approaches, never label-centroid shortcuts. Room solids and source walls are excluded from the navigation union. The 0.20-unit contour closure buffer and simplified outer rings are display evidence, not walking surfaces; unresolved room faces remain null.

`01.semantic-review.png` overlays source ink, contours, marker exceptions, navigation area and graph. Independent QA re-extracts original PDF evidence and samples curved walls at 96 subdivisions, separate from the generator's 24. Geometry/accessibility/access remain candidate/unknown; scale, photographs and physical kiosk are unknown. First Floor has no default planning origin. Stair/elevator names do not establish vertical connections.

## Inventory and coordinate evidence

The part 2 room schedule is the authoritative inventory: exactly G-01 through G-54, with stable IDs `B03-GF-G-01` … `B03-GF-G-54`. All rooms are directory-visible. This presentation flag is **not** permission to enter a room. Both drawing sheets describe one floor. Source 0001 display coordinates are unchanged; source 0002 receives only (+1033.29, -28.35). The normalized master viewBox is [650, 500, 3100, 1550]. No calibration or kiosk location is invented.

Every room has an actual source plan label. The `centroid` field deliberately means the source room-name text bounding-box center, **not** a computed polygon centroid. It supplies a selectable marker when a room contour is unresolved. The provenance records the exact text ID; repeated corridor labels and repeated overlap-sheet labels remain in `GF.review.json`.

English names follow the schedule. Arabic names are editorial translations, explicitly marked candidate terminology in provenance. All descriptions are bilingual placeholders, images are null, and image alternative text says no verified photo is available.

## Conflicts retained

| Schedule | Plan evidence | Treatment |
| --- | --- | --- |
| G-08 Stairs 3 | STAIR (03), tag 007 | Association by unique stair use; candidate |
| G-17 Stairs 4 | STAIR (04), tag 009 | Association by unique stair use; candidate |
| G-24 Exhibition Room | EXHIPITION ROOM, tag 045 | Candidate by unique use; not G-45 Physical Training Lab |
| G-25 Operations Office | STAFF, tag 25 | Schedule name retained; use unresolved |
| G-34 Storage | PANTRY, tag 34 | Schedule name retained; use unresolved |

Source spelling variants such as LOPBBY, ARCHIVE ROOM and ELEC. ROOM remain searchable aliases. No source typo silently changes an authoritative schedule code.

## Geometry method and confidence

`scripts/semantic-map/explore.py` reads raw vector paths from the two extracted sheets. It uses A-WALL, A-WALL-02, A-CONC, A-GYPSUM BOARD, A-CLADDING-STONE, A-GLAZING-6700, A-INT-GLAZ-01, and the ground-floor skin A-WALL layer, together with source door-frame/leaf linework. Cubic structural curves are sampled deterministically at 24 intervals. Source opening candidates are inferred **only** where a CAD door-swing cubic supplies a hinge through endpoint tangent normals and a source door leaf matches that hinge and a swing endpoint. The 111 resulting closure records retain the actual arc path ID and matching leaf path ID. Each closure extends 3 drawing units to connect the source jamb geometry. It is not an arbitrary wall-gap fill.

The line union is buffered by 0.20 drawing units to resolve drafting-level numeric gaps. Its complement is polygonized into enclosed free-space faces. A room contour is accepted only when one face contains its source label, excludes all unrelated room labels, and is not connected to the exterior. Exterior rings are simplified by 0.18 drawing units; curved walls remain curved polygonal contours. These are real vector-derived room footprints, never synthetic rectangles. Internal obstruction holes are deliberately not represented by `Room.polygon`, whose contract has only one ring; provenance reports their count. Footprints are not asserted to be walkable areas. Source structural wall segments are separately retained in the graph.

All accepted contours remain **candidate**, because small numeric gap resolution and door closure interpretation need independent review. Shared faces such as AV Studio/AV Control Room are rejected rather than assigned twice. The G-32 stair face is explicitly rejected after visual review found a thin connection leaking toward the elevator enclosure. Null geometry is intentional and does not remove the room from the directory.

`data/buildings/B03/GF.semantic-review.png` overlays the contours and room labels on A's cleaned master. A question mark marks a source label whose room polygon is unresolved. `GF.review.json` preserves per-room acceptance/rejection, conflict notes, opening evidence and graph review records.

## Drawing-based navigation

The graph opts into `routingPolicy: drawing-based`. Source evidence remains candidate, unknown access stays unknown, and accessible-only routing excludes these unassessed links. The G-01 main entrance is the explicitly named default starting space. It is **not a kiosk**: physical kiosk location remains null/unknown. Distances are uncalibrated map units.

`navigation-config.json` records reviewed circulation spines, source door arc/leaf references and special approaches. Spines constrain the area of investigation; they do not create walls. `drawing_graph.py` subtracts original structural walls with 0.8 drawing-unit clearance, accepted enclosed room faces, the shared AV suite except its source foyer, the central escalator footprint, and a conservative exclusion around the skylight. A 0.01-unit precision reduction removes overlap noise, eighty times smaller than reserved wall clearance. Open entrance boundaries are bounded conservatively by circulation regions inside the drawing; no exterior sidewalk is invented. Door approach endpoints are chosen on the connected circulation side of an evidenced portal. A 3-unit grid resolves obstacle-aware shared paths and segments are simplified only where the complete segment remains inside the same region. Navigable polygons split the actual constrained circulation region into simple rings, preserving holes. Source walls are retained independently and every final segment is tested against the original unsnapped evidence.

There are 54 connected directory approaches, with three explicitly **partial** destinations: G-06, G-17, and G-23 have exterior final doors whose continuous outside approach is not established by this source. Their route ends at a documented nearby interior approach, their bilingual note states the missing final connection, and `navigationPartial: true` prevents treating this as exact arrival. Source final-door references are retained separately. G-28, G-40 and G-21 use explicit suite entrance approaches, with a note naming Reception, Services, or Kitchen. No route crosses those rooms to fabricate access to a nested room. G-26 ends beside the skylight exclusion and never traverses its void.

G-44 uses its actual control-room portal through the AV foyer. Its arc `0001-path-11655` contains two cubic segments: the corrected portal joins leaf hinge [1255.60010,1186.96997] to jamb [1279.87012,1180.16003] (source leaf 11645, jamb 11647), instead of interpreting one intermediate cubic endpoint as a complete swing. G-14 and the east toilets are reached through the narrow open vestibule west of the toilet suite: the bottom threshold near [2846,1628] is A-DOOR-STEP drafting, not a wall. Independent original-PDF review corroborated this opening.

The footprint overlay shows all approaches and shared graph geometry. Routes follow drawing evidence; current door operation, permissions and accessible clearance are not asserted. `partial_graph.py` is retained only as the earlier investigative implementation and is no longer imported.

## Room connection evidence

Each row gives the route endpoint source, with final-door references where arrival is qualified. All IDs resolve in `maps/B03/GF/source/{source}.json`; room label provenance remains in floor data.

| Code | Endpoint evidence | Approach qualification |
| --- | --- | --- |
| G-01 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-02 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-03 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-04 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-05 | 0002-path-07914 | Approach immediately outside evidenced doorway. |
| G-06 | 0002-path-07914; final 0002-path-08027 | Route ends at the Auditorium entrance. Storage G-06 is accessed from the exterior auditorium landing; that final access is not mapped. |
| G-07 | 0002-path-11149 | Approach immediately outside evidenced doorway. |
| G-08 | 0002-path-08079 | Approach immediately outside evidenced doorway. |
| G-09 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-10 | 0002-path-08090 | Approach immediately outside evidenced doorway. |
| G-11 | 0002-path-11451 | Approach immediately outside evidenced doorway. |
| G-12 | 0002-path-08007 | Approach immediately outside evidenced doorway. |
| G-13 | 0002-path-07958 | Approach immediately outside evidenced doorway. |
| G-14 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-15 | 0002-path-07947 | Approach immediately outside evidenced doorway. |
| G-16 | 0002-path-11071 | Approach immediately outside evidenced doorway. |
| G-17 | Source-labelled open circulation approach; final 0002-path-08038 | Route ends at Lobby G-14. Stair 4 has an exterior ground-floor door; the final exterior approach is not mapped. |
| G-18 | 0002-path-08103 | Approach immediately outside evidenced doorway. |
| G-19 | 0002-path-08072 | Approach immediately outside evidenced doorway. |
| G-20 | 0002-path-08062 | Approach immediately outside evidenced doorway. |
| G-21 | 0002-path-08062; final 0002-path-08052 | Route ends at the Kitchen entrance. Storage G-21 is reached through the Kitchen. |
| G-22 | 0001-path-07364 | Approach immediately outside evidenced doorway. |
| G-23 | 0002-path-07887; final 0002-path-08275 | Route ends at the south Main Entrance doors. Stair 2 has an exterior ground-floor door; the final exterior approach is not mapped. |
| G-24 | 0001-path-07377 | Approach immediately outside evidenced doorway. |
| G-25 | 0001-path-07392 | Approach immediately outside evidenced doorway. |
| G-26 | Source-labelled open circulation approach | Route ends beside the Skylight perimeter. The skylight is not a walking surface. |
| G-27 | 0001-path-07403 | Approach immediately outside evidenced doorway. |
| G-28 | 0001-path-07403; final 0001-path-07414 | Route ends at Reception entrance; continue through Reception to Clinic. |
| G-29 | 0001-path-07427 | Approach immediately outside evidenced doorway. |
| G-30 | 0001-path-07526 | Approach immediately outside evidenced doorway. |
| G-31 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-32 | 0001-path-07474 | Approach immediately outside evidenced doorway. |
| G-33 | 0001-path-07485 | Approach immediately outside evidenced doorway. |
| G-34 | 0001-path-07499 | Approach immediately outside evidenced doorway. |
| G-35 | 0001-path-07504 | Approach immediately outside evidenced doorway. |
| G-36 | 0001-path-07513 | Approach immediately outside evidenced doorway. |
| G-37 | 0001-path-07539 | Approach immediately outside evidenced doorway. |
| G-38 | 0001-path-07553 | Approach immediately outside evidenced doorway. |
| G-39 | 0001-path-07560 | Approach immediately outside evidenced doorway. |
| G-40 | 0001-path-07560; final 0001-path-07585 | Route ends at Services entrance; Storage G-40 is reached through Services. |
| G-41 | 0001-path-07571 | Approach immediately outside evidenced doorway. |
| G-42 | 0001-path-07702 | Approach immediately outside evidenced doorway. |
| G-43 | 0001-path-07715 | Approach immediately outside evidenced doorway. |
| G-44 | 0001-path-11655 (compound-swing correction) | AV Control Room is approached through the shared AV suite foyer. |
| G-45 | 0001-path-07732 | Approach immediately outside evidenced doorway. |
| G-46 | 0001-path-07749 | Approach immediately outside evidenced doorway. |
| G-47 | 0001-path-07766 | Approach immediately outside evidenced doorway. |
| G-48 | 0001-path-07809 | Approach immediately outside evidenced doorway. |
| G-49 | 0001-path-07827 | Approach immediately outside evidenced doorway. |
| G-50 | 0001-path-07783 | Approach immediately outside evidenced doorway. |
| G-51 | 0001-path-07862 | Approach immediately outside evidenced doorway. |
| G-52 | 0001-path-07871 | Approach immediately outside evidenced doorway. |
| G-53 | Source-labelled open circulation approach | Route ends at the source label approach in this open circulation space. No physical doorway is implied. |
| G-54 | 0001-path-07882 | Approach immediately outside evidenced doorway. |

## Reproduction and verification

```powershell
.venv/Scripts/python.exe -m pip install -r scripts/semantic-map/requirements.txt
.venv/Scripts/python.exe -X utf8 scripts/semantic-map/generate.py
.venv/Scripts/python.exe -X utf8 scripts/semantic-map/verify.py --regenerate
.venv/Scripts/python.exe -X utf8 scripts/semantic-map/render_review.py
npm run validate:data
node scripts/semantic-map/check_routes.mjs
```

Generation has stable ordering and no timestamps. Verification covers the 54 schedule codes, unique IDs, source evidence references, label containment, non-overlap, byte determinism, wall contacts, full navigable-area coverage, room-interior shortcuts and all-pairs graph connectivity. `GF.navigation-validation.review.json` records the geometry check results. `check_routes.mjs` invokes the actual TypeScript route engine for representative destinations rather than a substitute route algorithm. The PNG uses Pillow's bundled font.
