# B03 | Second Floor (02), Part 02 ONLY — Sideways SVG

This is a one-sheet vector export from **`2761-SOD-B03-DWG-AAR-15-02-Z-0002-00.pdf`**. It does not use or merge Part 01.

The primary architectural file is displayed **90° counterclockwise** relative to the original PDF's normalized landscape display, following the orientation of the supplied screenshot. The room schedule (27 entries, `S-01` through `S-27`) is stored independently of the cleaned drawing.

## Deliverables

| File | Purpose |
| --- | --- |
| `master.svg` | **Main deliverable**: cleaned, sideways architectural plan as editable/scalable SVG vector paths |
| `reference-sideways.svg` | Also vector, sideways, but *retains* original CAD drawing annotations, room labels, dimensions and axes — closest to the provided screenshot |
| `master-upright.svg` | Clean SVG in the original PDF's normalized orientation, for CAD cross-reference |
| `inspection/master.png` | Sideways clean preview |
| `inspection/reference-sideways.png` | Original PDF's graphics, annotations and text, cropped and turned sideways |
| `inspection/master-upright.png` | Clean preview in original orientation |
| `inspection/0002-full-sheet.png` | Full PDF page preview including title block |
| `inspection/user-provided-screenshot.png` | User-provided orientation screenshot kept alongside output for reference |
| `source/0002.json` | Unfiltered PDF extraction: all vector paths, original CAD layer labels, text anchors, page rotation and geometric metadata |
| `source/pdfs/` | Original single PDF, byte-for-byte unchanged |
| `room-schedule.json` | Source-derived second-floor room-code / room-name table, 27 rows |
| `source/room-schedule.json` | Copy of source-derived schedule |
| `alignment.json` | Reference rotation, crop and layer selection. **No alignment or seam** applies to a single drawing |
| `validation.json` | Quality checks and path counts |
| `manifest.json` | SHA-256 inventory of every file |
| `scripts/rebuild.py` | Re-create all SVG / PNG / JSON outputs from the packaged source PDF |

## Method

1. Read the single vector PDF using PyMuPDF and normalize PDF page rotation `270°` to display coordinates (PDF points; positive X right, positive Y down).
2. Identify architectural CAD drawing layers: walls, concrete, doors, glazing, fixed partitions, stairs, handrails and related architectural elements.
3. Omit sheet border, schedule, dimensions, grids, axes, text annotations, hatch graphics and exterior triangulation/mullion hatch elements **from `master.svg` only**. All original source geometry and text still exist in the extracted JSON and `reference-sideways.svg`.
4. Crop to the building-plan region in **PDF display points:** `(200, 160, 2040, 2260)`.
5. Apply a 90° counterclockwise display transformation to clean paths:

   ```text
   x_new = y_old - 160
   y_new = 2040 - x_old
   ```

   This is SVG matrix `(0, -1, 1, 0, -160, 2040)`, resulting `viewBox="0 0 2100 1840"`.
6. Render vector previews and validate vector path IDs, image visibility, sources and room schedule.

## Rebuild

With `pymupdf`, `cairosvg`, `Pillow` and `lxml` installed:

```bash
python scripts/rebuild.py
```

The rebuild is deterministic for the same source file and library versions. No source PDFs are changed.

## Limitations

- The engineering drawing labels the floor **SECOND FLOOR (02)**; it is the third level if counted together with Ground + First.
- **Physical meter scale is not established.** PDF points are vector drawing units, not real-world meters.
- The right-half sheet includes architectural continuation lines at its left boundary, but the missing Part 01 geometry is intentionally **not** invented or completed.
- The plan remains a vector drawing, not a fully connected 3D BIM model or a verified navigation graph.
