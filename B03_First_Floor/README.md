# B03 - First Floor (01) | Clean Vector Merge

This is the complete reproducible output for the two **first-floor** architectural shop drawing PDFs of building B03.

## Main outputs

- `master.svg` — cleaned, merged vector architectural plan (no room-number text/axes/dimension strings).
- `inspection/master.png` — raster visual preview on a white background.
- `inspection/0001.png`, `inspection/0002.png` — original full-page sheet previews.
- `inspection/seam-detail.png` — enlarged preview of the joining region.
- `source/0001.json`, `source/0002.json` — full extracted text, original CAD drawing paths, source layer, coordinates, and metadata. These retain excluded annotations for auditability.
- `room-schedule.json` and `source/room-schedule.json` — 59 labeled rooms, transcribed directly from Part 01's FIRST FLOOR room schedule with source text references.
- `alignment.json` — transforms, architectural layer allowlist, clipping, source identities, and alignment evidence.
- `validation.json` — automated checks and diagnostics.
- `manifest.json` — SHA-256 hashes of produced files.
- `source/pdfs/` — original PDFs, unchanged.
- `scripts/rebuild.py` — regenerate all outputs from the PDFs (requires PyMuPDF, CairoSVG, Pillow).

## Geometric transformation

All source paths are normalized from a PDF page rotation of 270° into **display PDF points**. The master coordinate system is Sheet `0001`.

For any displayed-coordinate point `(x, y)` on Sheet `0002`, the position in the merged master is:

```
x_master = 0.75 * x_0002 + 1444.55
y_master = 0.75 * y_0002 + 182.41
```

The second PDF has a scale 4/3 relative to the first. 6 repeated architectural label anchors verify the mapping; 442 CAD-layer geometry bounding boxes match in the overlap at 0.1-point quantization.

The merge uses a clipped seam at x=2055 in master drawing coordinates; duplication in the shared region is removed while retaining source vector geometry.

**Metric scale:** unknown. PDF points and the master SVG viewBox units cannot be claimed to represent meters until independently calibrated with trustworthy dimensions.

## ملاحظات

الملفين عبارة عن نفس الدور الأول. تم توحيد اتجاه الصفحات ثم تصغير الـPart 02 بنسبة 75% وتحريكه حتى تتطابق عناصر المبنى المشتركة. الـSVG يحفظ خطوط الرسم كـVector، وملف الغرف محفوظ منفصل، بدون تعديل ملفات الـPDF الأصلية.
