# Source ingestion

Requires Python 3.10+ and `pip install -r scripts/map-ingest/requirements.txt`.

Run `python scripts/map-ingest/ingest.py` to regenerate B03/GF source JSON, cleaned vector SVG, alignment metadata, room schedule and inspection images. Run `python scripts/map-ingest/validate.py` for deterministic regeneration and evidence checks. Original root PDFs are never modified.

Read `docs/SOURCE_AUDIT.md` before consuming coordinates. Source JSON is already in displayed PDF coordinates; apply only each source's `displayToMaster`. Master viewBox is `[650,500,3100,1550]`, and physical calibration is unresolved.
