# Academy wayfinding

Bilingual Arabic/English kiosk directory and source-based 2.5D map for **Building B03, Ground Floor**. The two original PDF sheets are two parts of one floor. The app includes searchable room selection, drawing thumbnails, RTL layout, speech controls, keyboard access, map pan/zoom/reset, and drawing-based route planning with bilingual turn instructions.

**Source confidence and routing:** 54 room records, with source-derived candidate footprints where available and markers for unresolved outlines. B03 uses an explicit `drawing-based` navigation policy: source-derived circulation can supply route lines and bilingual instructions after geometric validation. This is floor-plan guidance, not a claim of field-confirmed public or wheelchair access. The Main Entrance is the default planning origin when the physical kiosk is unconfigured; visitors can choose any supported starting room. No kiosk position or physical scale is confirmed, so the interface does not claim a current location or invent metre distances. Room descriptions are marked placeholders, and no room photographs are fabricated. Raised room geometry is illustrative, not a surveyed building height. Qualified endpoints identify a mapped suite entrance or approach; destinations with an unsupported exterior connection are explicitly shown as partial routes.

## Run locally

Use Node.js 22.23+ and npm 11.6.2 (the checked installation); Next.js 16 requires Node.js 20.9 or later. From the repository root:

```sh
npm ci
npm run prepare:maps
npm run dev
```

Open [localhost:3000](http://localhost:3000). Canonical generated map/data files are already included, so Python is needed only to regenerate or review source extraction. If npm 10 fails while processing the lockfile, use `npx --yes npm@11.6.2 ci`.

```sh
npm run typecheck
npm test
npm run test:data
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Browser tests require the app already running on port 3000, or `QA_BASE_URL` pointing to the desired local server. `npm run build` first validates every floor/content/graph bundle and copies canonical map assets. Server rendering also validates imported JSON; malformed data cannot silently pass through TypeScript casts.

Tests use Playwright's installed Chromium by default. Optionally set `QA_BROWSER_CHANNEL=msedge` to use an already installed Microsoft Edge; install Chromium with the command above for the portable default.

## Reproduce the source pipeline

Install Python 3.10+ (tested with 3.12), create a virtual environment, and install pinned dependencies:

```sh
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\python.exe -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

macOS/Linux:

```sh
.venv/bin/python -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt
```

The runner selects `PYTHON_EXECUTABLE` when set, then repository `.venv`, then system Python. `PYTHON_EXECUTABLE` is an executable path, without extra command arguments. Keep these originals in the repository root:

- `2761-SOD-B03-DWG-AAR-15-GF-Z-0001-01.pdf`
- `2761-SOD-B03-DWG-AAR-15-GF-Z-0002-01.pdf`

```sh
npm run pipeline
```

This runs source ingestion, repeat-generation/source checks, semantic generation, semantic determinism and geometry checks, review-overlay rendering, contract validation, and canonical SVG copying. Original PDFs are not modified. The pipeline preserves candidate evidence. Explicit drawing-based routing can use geometrically valid candidates; it does **not** change them into field-confirmed routes.

| Command | Purpose |
| --- | --- |
| `npm run ingest` | Extract source vectors/text and align the two sheets into one floor. |
| `npm run semantic` | Generate source-derived rooms, separate content, candidate graph and review metadata. |
| `npm run review:maps` | Regenerate and check source/semantic determinism; render the review overlay. This command rewrites generated outputs. |
| `npm run validate:data` | Check runtime contracts, references, geometry, calibration and SVG viewBox without regenerating data. |
| `npm run test:data` | Reject deliberately malformed copies of the real data through the shared validator. |
| `npm run prepare:maps` | Validate then copy only each canonical `master.svg` into the matching web public path. |

## Source and application layout

| Path | Responsibility |
| --- | --- |
| `maps/B03/GF/master.svg` | Canonical cleaned vector presentation. |
| `maps/B03/GF/source/` | Full source extraction and room schedule; never bundled as client data. |
| `maps/B03/GF/alignment.json` | Source transforms, crop, anchor residuals and null calibration. |
| `maps/B03/GF/inspection/` | Source and merged-plan review images. |
| `data/buildings/B03/GF.json` | Floor, rooms, source references and kiosk configuration. |
| `data/buildings/B03/GF.graph.json` | Source-derived navigation graph, routing policy and geometry constraints. |
| `data/buildings/B03/GF.review.json` | Semantic confidence, door evidence and unresolved geometry. |
| `data/buildings/B03/GF.semantic-review.png` | Candidate contours over the original vector master. |
| `content/B03/GF.json` | Localized descriptions and explicit photograph placeholders. |
| `apps/web/` | Next.js application; production asset at `public/maps/B03/GF/master.svg`. |
| `packages/map-engine/src/` | Shared types, runtime validator and data-driven building/floor/kiosk registry. |
| `packages/routing/`, `packages/search/`, `packages/i18n/`, `packages/audio/` | Replaceable routing, search, translations and browser speech services. |
| `tests/` | Unit, integration and browser tests. |

Read [project specification](docs/PROJECT_SPEC.md), [data contracts](docs/DATA_CONTRACTS.md), [source audit](docs/SOURCE_AUDIT.md), [semantic review](docs/SEMANTIC_REVIEW.md), [QA report](docs/QA_REPORT.md), [known issues](docs/KNOWN_ISSUES.md), and [deployment guide](docs/DEPLOYMENT.md) before changing evidence or configuring a physical kiosk.

Additional real floors can be passed to `createMapRegistry` and explicitly imported by the server page. IDs and building metadata must agree across the complete registry. The current UI serves the configured floor and does not fabricate additional floor options. Cross-floor routing needs actual vertical connections; v1 wall/enclosure constraints have no floor identifier, so mixed-floor constrained graphs deliberately fail closed until the contract is extended.
