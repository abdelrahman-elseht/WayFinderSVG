# B03 Ground Floor Navigation V2 Route Coverage Handoff

## Assignment

Continue the independent Navigation V2 graph work for **B03 Ground Floor (`GF`) only**. Address two user-visible gaps: the G-44 AV Control Room to G-30 Meeting Room route runs too close to the Meeting Room facade, and several destinations that route in the legacy graph are unavailable in V2. The user explicitly called out the Auditorium and Male Toilets. Audit the complete GF destination set, add only source-supported circulation and door approaches, improve route clearance where the drawing supports it, then refresh the diagnostics and browser evidence.

The supplied follow-up screenshot is from GF. It shows the teal G-44 to G-30 route following the thin circulation strip immediately beside the Meeting Room wall, then turning tightly under its south-west corner. Treat that as the route-quality report; do not move the line through G-30 or invent a wider corridor.

## Read first

- `AGENTS.md`, `memory.md`, `docs/SOURCE_AUDIT.md`, `docs/DATA_CONTRACTS.md`, and `docs/SEMANTIC_REVIEW.md` for repository and GF evidence rules.
- `docs/handoffs/NAVIGATION_V2_COMPLETION_HANDOFF.md` for the full graph acceptance gates.
- `docs/navigation-v2/architecture.md`, `graph-generation.md`, `developer-guide.md`, and `benchmark.md` for current implementation and results.
- `docs/EXTERIOR_ACCESS_REVIEW.md` for the reviewed AV foyer and toilet opening, plus known unsupported exterior gaps.
- The supplied user screenshot and existing captures in `artifacts/navigation-v2/port-5250-e2e/`.

## Current implementation and baseline

- V2 is diagnostic-only. The runtime app still uses `data/buildings/B03/GF.graph.json`; do not promote V2 while its route coverage or source gates fail.
- V2 construction lives in `scripts/semantic-map/centerline_common.py` and `scripts/semantic-map/reconstruct_centerline_graph.py`. Reviewed additions are isolated in `scripts/semantic-map/navigation-v2-config.json`; keep their coordinates and source references there.
- Latest generated candidate: 196 nodes, 162 edges, 38 components, 54 approaches represented, 52 attached, cycle rank 4. Strict edge verification reports no navigable-area, wall-contact, or room-interior failures. G-39 and G-40 intentionally remain disconnected and have no incident edges.
- Existing intended fixes route G-01 to G-10, G-12, G-13, G-43, G-44; G-07 to G-10; and G-44 to G-30. The G-44/G-30 route is 716.44 map units versus 628.71 in legacy and is visually too close to the Meeting Room wall. G-01 to G-05 (Auditorium) and G-01 to G-42 (Male Toilets) remain unavailable in the latest port-5250 browser checks. G-01 to G-41 is also unavailable. Re-run the matrix before relying on these results.
- Recent focused regression coverage is in `tests/integration/navigation-v2-routing.qa.test.ts`. Browser screenshots are under `artifacts/navigation-v2/port-5250-e2e/`; the dev-only V2 view is at `http://127.0.0.1:5250/` when that server is running.

## Work sequence

1. **Re-establish the GF matrix.** For every room approach in `data/buildings/B03/GF.json`, run the real TypeScript `findRoute` from G-01 and from relevant nearby route origins through both the legacy and V2 graphs. Save a machine-readable matrix with status and route safety. Identify every legacy-connected destination V2 loses, not just the three examples above. Completion criterion: each of the 54 approaches has a recorded comparison and the exact missing/unsafe pairs are named.
2. **Review the west route clearance.** Inspect the original GF PDF and source vectors around G-44, G-30, and the west/south circulation strip. Measure minimum distance from the assembled V2 route to supplied walls and room obstacles, and compare with the legacy route using the same method. Look for an already-configured/source-derived alternative centerline that remains in the navigable-area union. Do not optimize for clearance by leaving mapped circulation, crossing room solids, or merely smoothing a route across obstacles. Completion criterion: a source-supported alternative improves clearance and passes exact geometry checks, or the report precisely explains why the plan only supports the narrow approach.
3. **Restore supported missing destinations.** Trace each failed approach to its actual CAD door/leaf/swing and the corridor or vestibule on the circulation side. Start with Auditorium G-05 and Male Toilets G-42, then cover every other failure from the matrix. Reuse only source-backed door and corridor geometry; keep destination identity and partial-route qualifications accurate. A door symbol proves the opening, not the route to that opening. G-06, G-17, and G-23 have documented exterior-ground gaps in `docs/EXTERIOR_ACCESS_REVIEW.md`; preserve partial status unless additional source evidence closes them. Keep G-39/G-40 edge-free as explicitly requested. Completion criterion: each newly connected destination has a source reference, exact geometry tests, and an explicit endpoint/partial qualification.
4. **Add regressions before source/config changes.** Tests must exercise the actual graph generator output, `findRoute`, and route-level geometry validator. Assert the full matrix outcomes, no facade/room crossing, and a documented minimum-clearance comparison for G-44 to G-30. Keep `G-39` and `G-40` without incident edges. Completion criterion: the new test fails against the current candidate for the known misses and passes after evidence-backed updates.
5. **Regenerate and verify only V2 artifacts.** Run `diagnose_centerlines.py`, `reconstruct_centerline_graph.py`, `verify_centerline_candidate.py`, and the focused integration test. Prove deterministic graph/report outputs across two independent runs. Run `npm run validate:data`, `npm run test:data`, and `npm run typecheck`. Never run `npm run pipeline` for V2; it rebuilds canonical legacy outputs. Completion criterion: all emitted edges and selected test routes pass exact area, wall, and room-interior checks; every unresolved approach remains explicit; no V2 change leaks into canonical runtime data.
6. **Repeat browser review on GF.** Use the requested GPT-6.1 Sol at medium effort for browser/e2e work. Test every legacy-connected pair from the new matrix plus the named destinations on port 5250 in the diagnostic mode. Capture before/after route screenshots around the Meeting Room and screenshots for each restored destination; inspect them at full resolution. Completion criterion: browser status matches the matrix, captures are indexed, and the route no longer visually hugs the Meeting Room facade beyond what the source corridor requires.
7. **Close the handoff.** Update `docs/navigation-v2/benchmark.md`, the route matrix artifact, and `docs/KNOWN_ISSUES.md` or the owning review doc with current results. State whether V2 passes promotion gates; if connectivity remains incomplete, keep it diagnostic-only and report each unresolved room/gap with exact evidence.

## Hard constraints

- This task is GF-only. The screenshots are not First Floor (`01`).
- Preserve original evidence, transforms, source IDs, candidate status, unknown accessibility, bilingual notes, and partial endpoints.
- Do not import legacy edges or route polylines into V2 topology. Legacy is a comparison baseline only.
- Every emitted route segment must be covered by the exact navigable-area union, avoid all supplied wall contacts, and avoid room interiors. Check assembled route geometry after routing/smoothing as well as individual graph edges.
- Do not connect G-39/G-40. Do not infer a passage from their shared point.
- Do not weaken geometry validators, invent clearance buffers, or call drawing units metres.
- Keep the canonical runtime imports unchanged unless the complete V2 acceptance gate is independently passed and the user separately requests promotion.

## Expected report

Report changed files, the 54-destination legacy/V2 matrix, route lengths and minimum wall/obstacle clearance for the west route, all evidence references for added doors/links, unresolved destinations and partial notes, graph counts/components, deterministic hashes, test results, browser URLs/captures, and the runtime-promotion verdict.
