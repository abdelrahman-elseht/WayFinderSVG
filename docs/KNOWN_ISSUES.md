# Known issues

## Content Studio (`/cms`)

The authenticated `/cms` editor manages only B03 Ground Floor `RoomContent`.
Draft and published overrides are atomically written to
`WAYFINDING_CONTENT_STORE`, or `.data/content-overrides/B03-GF.json` by default.
Draft saves do not affect visitors; publishing makes the override available to
the public app on its next request. The content store and uploaded assets use
local disk by default (`.data/content-overrides` and `.data/media`). Deployments
with ephemeral filesystems must mount persistent storage at
`WAYFINDING_CONTENT_STORE` and `WAYFINDING_MEDIA_STORE`; no cloud provider is
configured or implied. Uploads are admin-authenticated, same-origin, limited to
JPEG/PNG/WebP/MP4/WebM and 20 MB, signature-checked, and stored under opaque
server-generated names. Canonical content, room geometry, navigation evidence
and source provenance are never rewritten. Optional content presentation fields
control block color and bilingual map stickers. Draft and published overrides
are validated when read and before public substitution. Writes use an exclusive
lock, unique temporary files, atomic rename, and a content revision to reject
stale editors.
Malformed overrides fail closed and the public app falls back to canonical
validated content. The CMS currently covers GF only.

Raised-block correction (2026-10-12): previously missing enclosed-room blocks now have candidate source-derived display outlines on GF and 01, including lifts/escalators. Original semantic unknowns are retained where label position or closure interpretation prevents promoting a contour. Open circulation, the skylight void and schedule-only First Floor entries without source positions are intentionally not fabricated as solid blocks. GF G-19/G-20/G-21 routes now stop at the cafeteria suite entrance; internal suite access remains unmapped and is explained in both languages. See `SEMANTIC_REVIEW.md` for generation evidence.

## Visual route rounding limits (2026-10-18)

Safe visual rounding now includes ordinary branching corridor junctions on GF
and configured Floor 01. Door/approach landings and accessibility/restriction
transitions remain exact, so those corners can remain angular. Curves shrink or
fall back when supplied wall/enclosure evidence disallows them. The validator
checks rendered centerline chords, not the pixel-wide stroke's physical clearance;
no metre scale or accessibility evidence is inferred. See `docs/ROUTE_SMOOTHING.md`
and `artifacts/corner-rounding/` for parameters, diagnostics and matched captures.

## First Floor phase 1–2 limits

The complete source/semantic bundle is available as configured floor `01`; interactive GF↔01 selection and renderer refinements belong to phase 3. Building metadata and server imports are shared prerequisites for validating and previewing the bundle. The client still receives one configured floor.

- Five schedule entries (F-10, F-18, F-28, F-29, F-45) have no usable source plan marker. The review accounts for all 59 entries; the runtime directory correctly contains 54.
- F-17 has competing stair identities; F-49 lacks a mapped exterior walking surface; F-57 lacks a continuous supported corridor approach. These three endpoints remain null. F-30 now has a source-door landing connection. Other approaches are candidate drawing evidence; connectivity and physical access are separate.
- No First Floor kiosk/default start, metre scale, photographs, confirmed accessibility or cross-floor connections are supplied. Accessible-only therefore rejects the unknown links. Shared-suite changing-room approaches retain bilingual qualifications.
- Existing UI limitations carried to phase 3 include `Go here` retaining Browse mode and operational availability gating. The source-texture letterboxing/alignment defect is fixed: CAD pixels now span the canonical viewBox, and selection no longer lifts footprints off the plan. No facility approval is implied by the phase 2 bundle.
- Browser sessions request an absent `favicon.ico` (404), inherited from GF. Model-driven tester-army exploration requires a provider key or saved e2e subscription login; this environment currently has neither. Deterministic e2e runs are reported separately.
- AXI Chrome captures after route selection show black unselected room roofs (`axi-route-en.png`, `axi-mobile-ar.png`); its default capture and Playwright route captures show the expected shading. This observed renderer issue needs phase 3/4 browser diagnosis; it does not establish a geometry or routing failure. No shading fix or cross-browser visual approval is claimed in phase 2.

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
# Navigation Graph Editor (2026-11-02)

`/admin` now has an authenticated, source-backed GF corridor editor. Configure
`WAYFINDING_ADMIN_USER` and `WAYFINDING_ADMIN_PASSWORD` (5+ characters) in the
deployment secret store before use. Access fails closed until the server
restarts with both values. See [editor operations](navigation-editor-admin.md).

Local development is configured with the ignored `apps/web/.env.local` pair
`admin`/`admin`; this five-character password is intentionally unsuitable for
shared or production environments.

Source spine controls and reviewed V2 connections edit the source candidate.
Graph nodes can be moved or deleted in a separate admin simulation; connected
edge endpoints update with node moves, and deleted nodes remove incident
simulation edges. These node edits are stored only in preview drafts and do not
change source configuration or normal wayfinding. `Run in admin` skips geometry
validation for route simulation; `Build source candidate` retains the existing
geometry and connectivity gates. Undo/redo, group translation, numeric editing,
snap, box/lasso selection and draft export/restore are available.
Rotation/scaling and independent wall offsets are not implemented because the
source schema/evidence does not define safe semantics for them.

No verified building envelope is present in the current floor contract. The
editor reports structural wall and walkable-domain boundary distances, but
building/facade clearance is explicitly unavailable. It does not infer
building edges from the SVG viewBox.

Baseline reproduction from the current V2 source config produces 174 nodes,
155 edges, 25 components and 52 edged room approaches. This differs from the
edited, uncommitted diagnostic artifact in this worktree; the editor regenerates
from authoritative config, not that generated artifact. Geometry tests pass;
full acceptance remains FAIL because the source graph is disconnected and
contains a pre-existing duplicate undirected edge pair. G-39/G-40 stay
edge-free; G-35/G-01 and G-37/G-42 pair connectivity is retained. Confirmed
admin saves replace `data/buildings/B03/GF.graph.json`, used by the runtime app.
Geometry/connectivity findings remain diagnostics and do not block saving.

## CMS presentation previews and color categories (2026-11-10)

The CMS uses actual semantic/display footprints and canonical source texture UVs for the compact room preview. Rooms without a supplied footprint show drawing detail and the draft color/sticker swatch only; no replacement contour is inferred. WebGL failure also uses the labeled drawing fallback. Extrusion height remains illustrative. Preview navigation/audio controls are intentionally inactive. Named color categories and their assignments publish together and do not change semantic room categories or access evidence.

The required data checks in this shared worktree remain blocked by the existing `graph.edges[5]: edge crosses outside navigable areas` failure. The CMS upgrades do not repair or regenerate that graph. Independent browser verification of the sticky/stacked preview and published presentation remains a separate check.

