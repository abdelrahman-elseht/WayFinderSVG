# B03 Ground Floor source audit

## Sources and inspection

Both source files remain unchanged at repository root:

- `2761-SOD-B03-DWG-AAR-15-GF-Z-0001-01.pdf`: one page, 20,717 vector paths, 244 text spans. Title explicitly says `@ GROUND FLOOR ( B03 ) - PART 1`.
- `2761-SOD-B03-DWG-AAR-15-GF-Z-0002-01.pdf`: one page, 20,684 vector paths, 334 text spans. Title explicitly says `@ GROUND FLOOR ( B03 ) - PART 2`.

These are overlapping parts of the **same B03 GF plan**, not separate floors. Both display as 3370 by 2384 PDF points; both underlying media boxes are 2384 by 3370 with PDF page rotation 270 degrees. Both sheets were rendered in full and visually inspected; inspection PNGs are `maps/B03/GF/inspection/0001.png` and `0002.png`. Named CAD layers survive PDF extraction. Three embedded images per sheet are title-block material; they are not the floor geometry and are not used in the master.

The native text inventory is incomplete for engineering notation: many dimensions and engineering labels were outlined into vector paths. Room labels and the room schedule are extractable text. Raw source exports retain every extracted drawing primitive and text span, including sheet furniture excluded from the presentation.

## Coordinate contract and alignment

Every exported source `texts[].bbox`, `texts[].origin`, `paths[].bbox` and `paths[].items[].points` uses **displayed PDF coordinates**, x right and y down, with five decimal places. Raw extraction is rotated once by `[0,-1,1,0,0,2384]`. Consumers must **not rotate again**.

Master coordinates preserve the displayed origin of sheet 0001. The stable master SVG viewBox is `[650,500,3100,1550]`. It is not zero-origin: normalized map coordinates mean the shared master coordinate frame, not coordinates relative to the viewBox top-left.

- Sheet 0001 display-to-master affine: `[1,0,0,1,0,0]`.
- Sheet 0002 display-to-master affine: `[1,0,0,1,1033.29,-28.35]`.
- Therefore sheet 0002 point `[x,y]` becomes master `[x+1033.29,y-28.35]`.
- Sheet 0001 plan crop: `[650,500,2436,2050]` (left, top, right, bottom).
- Sheet 0002 plan crop: `[746,530,2720,2078.35]`.
- Master seam is x=2300, inside the common overlap. Sheet 0001 supplies geometry to its left; sheet 0002 supplies geometry to its right. SVG clipping preserves paths crossing the seam.

Six corresponding room-label origins independently verify the translation: CLINIC, STAFF, SECURITY ROOM, IT ROOM, ELEC. ROOM and MAIN ENTRANCE. Maximum residual is 0.00011 drawing point. Exact anchor coordinates and per-anchor residuals are persisted in `maps/B03/GF/alignment.json`. Repeated architectural primitives provide an additional quantitative overlap check in `validation.json`. The merged master was visually inspected after cleanup; stair cores, circulation edges and wall runs connect at the seam.

Physical calibration remains **unknown** with `metersPerUnit: null`. Visible dimension numerals are outlined paths; no numeric dimension has been paired with verified dimension endpoints in this audit. PDF point size describes paper, not real floor meters. No physical travel distance should be presented from these data until source-backed calibration is approved.

## Cleaning policy

`config.json` declares an explicit CAD-layer allowlist. Architectural walls, glazing, doors, stairs, handrails, fixed sanitary fixtures and selected floor structure are retained. Borders, title blocks, keyplans, schedules, axes, dimensions, hatches, above-floor hidden structure and engineering annotation layers are excluded. Source room text is retained in the extraction for semantic labels rather than baked into the background map.

Source layer names are not uniformly trustworthy. Two reviewed exceptions are explicit:

1. `A-CLADDING ALUM.` contains empty room-number tag frames and annotation leader fragments in the plan. It is excluded from presentation to avoid orphan empty labels; the complete layer remains in source JSON.
2. A detached outlined `3900` dimension and its witness line at the lower right use mixed layer `A-DOOR-STEP`. Only primitives contained in sheet 0002 display rectangle `[2100,1950,2200,2080]` on that layer are excluded. This region is outside the building envelope and was visually checked.

The current master contains 6,322 original vector paths before seam clipping. It adds no room polygons, door openings, corridor centerlines or invented architecture. Drawn doors are physical drawing evidence only; they do not establish accessibility, current opening state or public access. Sanitary furniture and auditorium riser lines remain because they are source architectural context.

## Room inventory and conflicts

The schedule on part 2 explicitly lists G-01 through G-54, consecutively, with room names. Its 54 rows are exported to `maps/B03/GF/source/room-schedule.json` with source text IDs and code bounding boxes. This provides the source directory inventory, but several plan tags disagree:

| Schedule | Plan label | Resolution status |
|---|---|---|
| G-08 STAIRS 3 | `STAIR (03)` with number `007` | Source discrepancy; do not silently use G-07, which is VIP SALON |
| G-17 STAIRS 4 | `STAIR (04)` with number `009` | Source discrepancy; G-09 is ELEVATOR LOBBY |
| G-24 EXHIBITION ROOM | `EXHIPITION ROOM` with number `045` | Source discrepancy; G-45 separately identifies the physical training lab |
| G-25 OPERATIONS OFFICE | `STAFF` | Names conflict; preserve plan alias/provenance |
| G-34 STORAGE | `PANTRY` | Names conflict; preserve plan alias/provenance |
| G-43 MECHANICAL LAB | `MECHANICAL&FABRICATION LAB` | Different granularity; retain alias |
| G-45 PHYSICAL TRAINING LAB 1 | `PHYSICAL LAB TRAINING` | Name variation |
| G-50 VISUAL TRAINING LAB 1 | `VISUAL TRAINING LAB` | Name variation |
| G-31 LOBBY | `LOPBBY` / drawing spelling | Obvious spelling discrepancy; retain raw source |

Other pluralization/abbreviation differences include ELECT ROOM versus ELEC. ROOM, ARCHIVES versus ARCHIVE ROOM, and FEMALE/MALE TOILETS versus singular plan labels. The ingestion pipeline never changes raw labels. Associate schedule entries with geometry using label position plus enclosing architecture and carry ambiguity in semantic provenance. Repeated corridor labels and the six alignment anchors are duplicates across the source overlap, not additional rooms.

## Extraction schema

`source/0001.json` and `source/0002.json` contain:

- `schemaVersion`, `sourceId`, `file`, `sha256`, `page`, `pageCount`, `pageRotation`, `rawToDisplay`, `pageSize`, `displayToMaster`, `coordinateSystem`.
- `texts[]`: stable `id`, raw `text`, `bbox:[left,top,right,bottom]`, `origin:[x,y]`, `font`, `size`, `direction`.
- `paths[]`: stable `id`, `layer`, `bbox`, source `type`, `stroke`, `fill`, `width`, `closed`, `evenOdd`, `dashes`, and `items[]`.
- An item has `type: line|cubic|rect|quad` and JSON-native `points`. A line has two points; a cubic has start/control1/control2/end; rect and quad use four perimeter corners. Rect additionally preserves source `orientation`.
- `layerCounts` includes excluded engineering layers as well as retained architecture.

Source primitives are read-only evidence. Their layer or bounding box alone is not a semantic room assignment. Extracted primitives may include original material outside the source plan crop; consumers should use the explicit crop and display-to-master transforms.

## Reproduction and verification

Install `scripts/map-ingest/requirements.txt`, then run:

```powershell
python scripts/map-ingest/ingest.py
python scripts/map-ingest/validate.py
```

Generator paths resolve relative to the repository regardless of working directory. Configuration and dependency version are pinned. Generated map data contains no timestamps. `manifest.json` records SHA-256 digests for the master, alignment and source JSON. `validate.py` regenerates twice, compares artifact hashes, checks original PDF hashes, validates vector-only master content, verifies six alignment anchors, checks coincident overlap geometry and asserts all 54 schedule codes exist. The latest result is `maps/B03/GF/validation.json`.

Remaining work outside source ingestion: metric calibration; evidence-backed semantic enclosure extraction; explicit handling of source naming/number conflicts; verified traversable corridors, door links and kiosk location. A clean background alone does not resolve any of these.
