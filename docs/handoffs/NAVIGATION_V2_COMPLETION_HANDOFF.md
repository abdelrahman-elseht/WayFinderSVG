# Navigation V2 Completion Handoff

## Assignment

Continue the centerline-routing work on branch `feature/centerline-routing-v2`. Complete the independently generated Ground Floor topological graph from source-backed corridor geometry, validate it against the existing application routing contracts, and produce reviewable legacy/V2 comparisons. The current V2 graph is a failed diagnostic candidate, not a shippable graph. Do not report the feature complete until the gates below pass or every unsupported source connection is precisely documented as unresolved.

The running app at `http://localhost:4666` currently uses the canonical semantic floor and legacy graph. It is not displaying V2. Preserve this separation until V2 passes its graph, route, and regression gates.

## Read first

Read these repository instructions and evidence documents before changing geometry or runtime integration:

- `AGENTS.md` and `memory.md` for project guardrails and file ownership.
- `docs/SOURCE_AUDIT.md` for coordinate transforms, source provenance, and limitations of the architectural drawings.
- `docs/DATA_CONTRACTS.md` for graph shape, candidate/unknown status, routing policy, and endpoint contracts.
- `docs/SEMANTIC_REVIEW.md` for room contours, door/approach qualifications, shared approaches, and unresolved geometry.
- `docs/QA_REPORT.md` and `docs/KNOWN_ISSUES.md` for current application test evidence and limitations.
- `docs/navigation-v2/architecture.md`, `graph-generation.md`, `developer-guide.md`, and `benchmark.md` for the implementation and diagnostic findings to date.

Do not run `npm run pipeline` as a V2 generator. It regenerates the canonical legacy data from the existing source pipeline.

## Current repository state

- Branch: `feature/centerline-routing-v2`.
- Latest branch commit: `0223812 Add centerline navigation connectivity diagnostics` (pushed to `origin`).
- The latest V2 scripts, artifacts, and four V2 documents are in that commit.
- `apps/web/app/page.tsx` imports `data/buildings/B03/GF.json` and `data/buildings/B03/GF.graph.json`; V2 is not runtime-wired.
- Canonical GF legacy graph remains 428 nodes / 627 edges. Do not overwrite it during diagnostics.
- The app may already be running on port 4666 with `NEXT_DIST_DIR=.next-dev-4666`; check the listener before starting another server. That instance displays the existing app, not V2.
- The worktree has unrelated QA/generated files and directories. Inspect `git status` and preserve those changes. Do not bulk-stage the worktree.

## Latest diagnostic facts

Generated files under `artifacts/navigation-v2/` currently report:

- 31 configured/raw spine components; clipping and union produce 62 line components.
- 1,774 nearby endpoint-pair candidates in the diagnostic report; 175 pass the current exact-domain direct segment and wall predicate.
- The reconstruction selects 104 candidate component links, but after exact geometry validation and serialization emits only 57 edges.
- Candidate output: 172 nodes, 57 edges, and 115 graph components. Its largest component has 14 nodes and only four room approaches.
- Only 46 of 54 source approach IDs exist in the emitted graph. Missing IDs: G-06, G-17, G-19, G-20, G-21, G-28, G-39, G-40.
- Emitted edges currently have zero exact walkable-union coverage failures, zero supplied-wall contacts, and zero tested room-interior crossings. This does not establish connectivity or route validity.
- G-39 and G-40 share source approach `[926.4935, 1431.457]`; the current direct and bounded local-A* connector attempts fail strict walkable-area/wall validation. Do not infer a passage from the shared point.
- The smaller graph is severe fragmentation, not a successful complexity reduction. There are no valid comparable route-length, turn, clearance, or performance results yet.

The reports are generated from scripts and may change as the algorithm changes. Re-run them before relying on any number in this handoff.

## Existing implementation points

- `scripts/semantic-map/navigation-config.json`: manually configured corridor spines and their reviewed source semantics.
- `scripts/semantic-map/diagnose_centerlines.py`: component coloring, endpoint candidates, distance/rejection report, and `spine-components.svg`.
- `scripts/semantic-map/reconstruct_centerline_graph.py`: independent candidate graph generation, exact walkable-domain/wall checks, room endpoint linking, bounded local A* fallback, and candidate report.
- `scripts/semantic-map/verify_centerline_candidate.py`: graph-level exact area, wall, room-obstacle, connectivity, and approach attachment checks. Overall acceptance is expected to fail on the current artifact.
- `artifacts/navigation-v2/connectivity-diagnostics.json`: endpoint candidate evidence.
- `artifacts/navigation-v2/reconstruction-report.json`: generator counts and unresolved connectors.
- `artifacts/navigation-v2/candidate-validation.json`: strict graph-level validation.
- `artifacts/navigation-v2/spine-components.svg`: 31/62 component diagnostic view. It currently shows only a subset of endpoint candidates and is not a route-comparison screenshot.
- `data/buildings/B03/GF.graph.json`: canonical legacy graph and geometric constraints. Legacy edges/paths must not be used as input to V2 topology generation.
- `packages/routing/`: existing Dijkstra, runtime graph contracts, and route safety validators. Reuse these for comparable route tests.
- `apps/web/app/page.tsx`: live app currently imports the canonical graph.

## Work sequence

### 1. Establish a reproducible baseline

1. Confirm branch, commit, and dirty/untracked files. Preserve unrelated work.
2. Run the current diagnosis, reconstruction, and strict verifier once; capture outputs and wall-clock durations without adding generation timestamps to canonical data.
3. Save the branch baseline for the four tests in `tests/integration/visual-corners.qa.test.ts`. Current recorded failures are all on `corners.some(c => c.applied && c.acceptedRadius > 12)` for GF G-01 to G-50, GF G-01 to G-05, floor 01 F-01 to F-50, and floor 01 F-01 to F-34. Do not loosen assertions. Establish whether these are still present at the current baseline before attributing any change to V2.
4. Run the required checks after code/data work: `npm run validate:data`, `npm run test:data`, `npm run typecheck`, and relevant Vitest tests.

Completion evidence: a checked-in or attached baseline report names the source commit, exact commands, exit status, and existing failures.

### 2. Diagnose all spine disconnections

1. Use configured spines as the primary geometric network and the canonical validated walkable polygons and walls as constraints.
2. Make component visualization legible at full-floor and local detail scales. Label every component with a stable ID, distinguish endpoints, intersections, proposed links, and rejection reasons, and ensure all components are visible. Produce a human-inspectable raster screenshot/PNG as well as machine-readable evidence; a raw SVG alone is not the complete visual deliverable.
3. Classify each observed gap as numerical/tolerance near-miss, missing corridor spine/connection, intentional separation, doorway/approach omission, or unresolved source evidence. Include exact coordinates, source component/spine IDs, distance, area/wall/restriction test outcomes, and source drawing references.
4. Investigate crossings and near-misses using Shapely `unary_union`, noding/splitting, `STRtree`, and snap only when the resulting connection remains source-justified. A crossing is a graph junction only when the linework represents a traversable connection; geometric intersection alone does not prove that.
5. Treat direct chords that happen to lie inside the walkable union as candidates for source review, not automatic physical links. Preserve valid alternative routes. Never join components solely to reduce component count.

Completion evidence: every one of the 31 original components and its clipped descendants is accounted for; every proposed connection has a reproducible accept/reject result and an evidence classification.

### 3. Reconstruct valid topology independently

1. Generate the graph only from the reviewed corridor spines, validated geometry, and source-backed room approach points. The legacy graph may supply geometric constraints and existing source approach coordinates/identities, but its routing edges and route paths must not contribute to the V2 corridor network.
2. Split at real line intersections and validated connection points. Represent intermediate corridor geometry as edge polyline points. Use graph nodes only for meaningful intersections/branches, corridor endpoints, room approaches, and required decision points.
3. Fix the cause of lost links and missing approach IDs. Do not bypass strict `domain.covers` checks with an unmeasured buffer. Keep tolerance values explicit and justified in map coordinates; do not call them metres.
4. Use bounded, cached local A* only for a necessary local geometric connector. Keep search limits deterministic and bounded. The final simplified/serialized connector must independently pass all geometry and wall checks.
5. Preserve stable room IDs, shared approach identities, candidate/unknown statuses, provenance, partial-route semantics, restrictions, and accessibility policy. An existing directory room is not proof of physical access.
6. Keep output deterministic. Prove repeated generation produces byte-identical graph and report outputs (or document the deterministic normalized comparison if an artifact deliberately contains measurements).

Completion evidence: all 54 room approaches appear with their correct source IDs, with documented shared/partial cases; every emitted edge passes exact walkable geometry and wall checks; all unresolved source cases are explicit and do not get silently bridged.

### 4. Validate routing and compare against legacy

1. Adapt the candidate to the existing TypeScript routing contract in tests or a diagnostic adapter; keep the production data import unchanged until promotion gates pass.
2. Run identical OD cases through legacy and V2 using the existing Dijkstra implementation and validators. Include representative near/far, same-wing/cross-wing, shared-approach, partial, and known difficult routes.
3. Compare connectivity, route length in drawing units, turn count using a documented angle threshold, minimum clearance from supplied walls/obstacles, generation time, and Dijkstra runtime. Do not convert drawing units to metres.
4. Check every route polyline for exact navigable-area containment, wall contact, and room-interior crossing. A graph edge check alone is insufficient if route assembly or smoothing changes the geometry.
5. Verify meaningful alternate paths remain. Do not collapse to a spanning tree and do not optimize only for counts.
6. Re-run the four visual-corner tests and compare the exact failure set/results to the branch baseline. Do not weaken assertions to make the result green.

Completion evidence: machine-readable benchmark output, a test summary, and no unreported policy or safety regressions. If full 54-approach connectivity cannot be supported by source evidence, stop short of runtime promotion and identify each blocker exactly.

### 5. Visual review and screenshots

Use the existing browser test setup/Playwright skills when appropriate. Do not modify the app layout as part of this task.

Capture reviewable screenshots under `artifacts/navigation-v2/screenshots/` (or another clearly named V2-owned directory):

- Full-floor legacy graph with nodes/edges visible.
- Full-floor V2 graph with meaningful topology nodes and intermediate edge geometry visible.
- Side-by-side legacy/V2 graph comparison using the same projection, extent, scale, and source plan.
- At least three identical OD route comparisons, including one cross-wing route and one route near a previously disconnected component.
- A detail image for every unresolved geometry area; annotate stable gap/component IDs and coordinates in an accompanying index/report rather than obscuring source linework.
- A browser screenshot of the application only if a safe development comparison mode has been implemented. Clearly label the data source and candidate status in the development view; production visitor routes must remain on the canonical graph until acceptance.

Record browser, viewport dimensions, URL, capture command, and relevant graph/report hashes. Inspect the saved images at full resolution. Screenshots must show source geometry and overlays clearly enough for a developer to judge alignment and rejected connections. Do not claim the existing `spine-components.svg` is a legacy/V2 route screenshot.

Completion evidence: image files exist, open successfully, and are referenced from `docs/navigation-v2/benchmark.md` with exact test-case IDs and capture method.

### 6. Documentation and handoff closure

Update all four files under `docs/navigation-v2/` to match the code and latest generated reports:

- `architecture.md`: actual data flow, coordinate systems, graph structures, and routing boundary.
- `graph-generation.md`: exact generation stages, geometric predicates, parameters, candidate classification, and references.
- `developer-guide.md`: working setup and commands, regeneration, geometry review, and debugging.
- `benchmark.md`: measured current counts and route metrics, test results, screenshots, limitations, and clear pass/fail status.

Remove stale figures whenever regeneration changes. Documentation must describe implemented behavior and must never label degree-two compression or the failed medial-axis experiment as centerline reconstruction.

## Acceptance gate

V2 is complete only when all of the following are evidenced:

- Independent construction from reviewed corridor spines, not legacy path unions.
- Every raw/clipped spine component and every candidate connection is explained.
- All 54 source room approaches are correctly represented and routable, including source-documented shared/partial cases; any truly unsupported case is explicitly reported and blocks a complete claim.
- Zero invalid-area crossings, wall contacts, or room-interior crossings for graph edges and tested routes.
- Existing Dijkstra, restriction, unknown accessibility, provenance, and partial-route semantics remain intact.
- Meaningful alternative routes are retained, the topology has fewer redundant structural elements for demonstrated reasons, and route length/turn/clearance comparisons show acceptable quality.
- Deterministic generation and bounded preprocessing are demonstrated.
- Legacy/V2 screenshots and quantitative benchmark are present and reproducible.
- Required data, type, relevant unit/integration/browser checks pass, with corner-test results compared to baseline and no silent assertion relaxation.
- Runtime promotion is a separate deliberate change after all gates pass. If any gate fails, keep the candidate diagnostic-only and report the exact missing evidence.

## Working commands

Run from the repository root. On Windows, use `.venv\Scripts\python.exe`; on POSIX, use `.venv/bin/python`.

```powershell
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/diagnose_centerlines.py
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/reconstruct_centerline_graph.py
.venv\Scripts\python.exe -X utf8 scripts/semantic-map/verify_centerline_candidate.py
npm run validate:data
npm run test:data
npm run typecheck
npm test
npm test -- tests/integration/visual-corners.qa.test.ts
```

The first three commands regenerate diagnostics, the diagnostic graph, and strict validation. They do not update the runtime graph. Browser/e2e tests require the app server; check current listeners and app identity before using port 4666. The old port owner served an unrelated Python directory server, so verify the returned app title/content before capturing browser evidence.

## Final report expected from the completing agent

Report the branch and commit, whether runtime integration occurred, files changed, final node/edge/component/approach counts, route benchmark results, exact unresolved source geometry, screenshot paths, deterministic/timing results, all test outcomes compared with baseline, and reproducible commands. State plainly whether every acceptance gate passed. Do not push, merge, or promote runtime data without explicit instruction.
