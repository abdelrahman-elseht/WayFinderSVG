- [x] Inspect the attached semantic-map and 2.5D screenshots. Evidence: `artifacts/navigation-fix/before/` and `artifacts/navigation-fix/navigation-audit.json`.
- [x] Read the repository, package scripts, and available E2E/browser-testing skills. Evidence: repository contract plus `e2e` and `chrome-devtools-axi` workflows.
- [x] Run the application and capture a reproducible before baseline. Evidence: `artifacts/navigation-fix/before/` and the baseline metrics in `navigation-audit.json`.
- [x] Find the root causes of dense nodes, broken connectivity, route collisions, and misalignment. Evidence: `navigation-audit.json` root-cause record.
- [x] Implement a sparse, connected, collision-safe navigation graph. Evidence: 138 nodes, 137 edges, one component, zero wall/area/room-interior failures in `01.navigation-validation.review.json`.
- [x] Fix F30, F32-to-F20 connectivity, and the F01 corridor. Evidence: integration regressions, Playwright route screenshots, and `navigation-audit.json`.
- [ ] Use one canonical transform for the floor plan, graph, route, and 2.5D geometry.
- [ ] Model all rooms, blocks, elevators, stairs, and escalators correctly in 2.5D.
- [x] Add unit, integration, and E2E regression tests. Evidence: First Floor Vitest regressions and `tests/e2e/floor-01.qa.spec.ts`.
- [x] Verify with the E2E skill, Playwright MCP, and Chrome DevTools MCP. Evidence: 10 Playwright tests passed; DevTools console/network checks recorded in `navigation-audit.json`.
- [x] Capture before/after screenshots and visual-regression evidence. Evidence: `artifacts/navigation-fix/before/`, `artifacts/qa/floor-01/`, and `artifacts/navigation-fix/after/`.
- [x] Produce metrics, an audit JSON, changed files, test results, and limitations. Evidence: `artifacts/navigation-fix/navigation-audit.json`.
Update this checklist while working. Mark an item complete only after objective evidence exists.
# Role
Act as a senior frontend graphics, computational-geometry, indoor-mapping, and navigation engineer. Work in implementation mode, not advisory mode.
Inspect the codebase. Run the app.
Modify the code. Add tests.
Use the browser tools. Verify the final behavior.
Do not stop at a plan or diagnosis. Ask a question only when a required value cannot be discovered from the repository, runtime, screenshots, data, or tests.
# Visual references
Use both attached screenshots as visual references. The semantic screenshot shows the generated graph in orange.
Its light-blue region represents intended navigable space. Several footprints marked with `?` are unresolved or access-unknown.
The current graph has excessive node clusters. Some doors and corridors are disconnected.
The 2.5D screenshot shows raised room and building blocks. The selected route is shown as a teal line.
Some 2.5D blocks are visibly offset from the underlying plan. Some elevator, stair, and escalator features are missing or inconsistent.
Some routes enter or cross raised building geometry. Do not estimate production coordinates from screenshots.
Use actual semantic data and application transforms. Use screenshots only for comparison and verification.
# Primary goal
Fix the semantic-to-navigation-to-2.5D pipeline. Make the graph sparse, deterministic, readable, and centered in walkable corridors.
Create exactly one node at each traversable door. Keep only necessary corridor, turn, junction, dead-end, and portal nodes.
Connect all reachable doors and corridors through valid walkable geometry. Connect F30 correctly.
Provide a valid continuous route from F32 to F20. Include corridor F01 in the connected graph.
Prevent every edge and route from entering blocked geometry. Represent every relevant room, block, elevator, stair, and escalator in 2.5D.
Align the floor plan, polygons, nodes, edges, labels, route, and extrusions. Make the fix generic and data-driven.
Do not hardcode coordinates or special edges for the named regression cases.
# Required investigation
Trace the complete data and rendering pipeline before changing behavior. Trace semantic source loading.
Trace feature parsing and classification. Trace source-coordinate normalization.
Trace walkable-area construction. Trace obstacle-area construction.
Trace door extraction. Trace centerline, skeleton, or navmesh generation.
Trace graph-node generation. Trace graph-edge generation.
Trace graph simplification. Trace connected-component validation.
Trace route search. Trace route smoothing.
Trace endpoint selection. Trace 2.5D footprint generation.
Trace extrusion and placement. Trace camera and screen projection.
Map each reported symptom to its responsible layer. Record evidence for each confirmed root cause.
# Root-cause candidates to test
Do not assume any candidate is correct without evidence. Check whether raw skeleton pixels become graph nodes.
Check whether contour or triangulation samples become graph nodes. Check whether overlapping passes create duplicate nodes.
Check whether door nodes use room centroids instead of door openings. Check whether graph simplification removes bridge edges.
Check whether tiny coordinate gaps split components. Check whether F01 is filtered, misclassified, or omitted.
Check whether F30 lacks a detected door or connector. Check whether F32 and F20 are in separate components.
Check whether unknown footprints are treated as walkable. Check whether elevators, stairs, or escalators are absent from obstacles.
Check whether route smoothing bypasses collision checks. Check whether route endpoints are placed inside rooms.
Check whether different layers use different scales or offsets. Check Y inversion, axis mapping, crop offsets, padding, rotation, and aspect ratio.
Check whether canvas sizing or device-pixel-ratio logic causes visual drift. Check whether asynchronous loading produces stale graph or transform state.
# Canonical coordinate system
Create one source of truth for semantic-to-world coordinates. Use it for the base floor image or texture.
Use it for walkable polygons. Use it for obstacle polygons.
Use it for room and building footprints. Use it for door openings.
Use it for elevators, stairs, and escalators. Use it for graph nodes and edges.
Use it for route geometry. Use it for labels and destination anchors.
Use it for debug overlays. Use it for hit testing and selection.
Represent source width and height explicitly. Represent rendered floor width and height explicitly.
Represent origin explicitly. Represent X/Y-to-X/Z axis mapping explicitly.
Represent Y-axis inversion explicitly. Represent scale explicitly.
Represent rotation explicitly. Represent crop and padding offsets explicitly.
Represent floor elevation explicitly. Represent extrusion height explicitly.
Remove unexplained per-layer offsets. Remove per-room visual corrections.
Add semantic-to-world tests. Add world-to-semantic tests.
Add transform round-trip tests. Add landmark alignment tests.
Use an appropriate numerical tolerance. Add a top-down alignment overlay mode.
# Semantic classification
Assign every feature one explicit category. Supported categories must include walkable corridor or floor.
Supported categories must include traversable door opening. Supported categories must include room or building footprint.
Supported categories must include wall or fixed obstacle. Supported categories must include elevator.
Supported categories must include stair. Supported categories must include escalator.
Supported categories must include vertical-circulation portal. Supported categories must include exterior or non-floor area.
Supported categories must include unknown or unresolved footprint. Default unknown or unresolved footprints to non-walkable.
Do not infer walkability from empty or white pixels alone. Treat the intended navigation region as the allowed walkable domain.
Include explicit door and portal areas where valid. Keep room interiors blocked.
Keep building interiors blocked. Route room destinations to a valid door threshold.
Do not route to the room-label centroid. When multiple doors are valid, use the existing policy or shortest valid door.
When no valid door exists, return an unreachable state. Never draw an unchecked fallback line into a room.
# Sparse node generation
Fix the graph data, not only its visualization. Create one node at each traversable door.
Create nodes at true corridor junctions. Create nodes at true corridor dead ends.
Create nodes at necessary direction changes. Create nodes at valid vertical-circulation portals.
Add spacing nodes only on exceptionally long straight segments when required. Do not retain every skeleton pixel.
Do not retain every contour point. Do not retain every triangulation point.
Do not retain tiny direction variations. Store a reason for every retained node.
Allowed reasons include `door`. Allowed reasons include `junction`.
Allowed reasons include `turn`. Allowed reasons include `dead-end`.
Allowed reasons include `long-segment`. Allowed reasons include `vertical-portal`.
Store the source feature ID where applicable. Merge duplicate nodes.
Merge nearly overlapping nodes. Remove unnecessary degree-two nearly-collinear nodes.
Preserve nodes required to avoid obstacle-cutting shortcuts. Remove tiny clusters around doors.
Remove nodes inside blocked footprints. Use tolerances derived from map scale or corridor width.
Avoid unexplained fixed-pixel magic numbers. Keep graph generation deterministic for identical input.
# Skeleton or centerline pipeline
When the implementation starts from raster skeleton data, preserve topology. Generate a corridor medial line or equivalent centerline.
Trace connected pixels into ordered polylines. Collapse degree-two pixel chains.
Identify true branches and endpoints. Simplify nearly collinear sections.
Insert door and portal anchors. Connect anchors to valid centerline locations.
Revalidate every simplified edge. Do not simplify across a corner.
Do not simplify through a wall. Do not simplify through a blocked footprint.
Do not create self-intersecting graph geometry.
# Door-node rules
Create exactly one node for each traversable door opening. Place it at the real opening or threshold.
Associate it with the correct room and door feature. Connect it to the nearest valid corridor centerline.
Keep the connector inside valid walkable space. Do not place it at a label.
Do not place it at a room centroid. Do not create overlapping duplicates.
Do not connect through a wall. Preserve distinct nodes for genuinely distinct doors.
Use a valid door node as the room route endpoint. Report missing or ambiguous doors instead of fabricating access.
# Edge construction
Every edge must connect two valid nodes. Every edge must remain inside approved walkable geometry.
Every edge must avoid walls and fixed obstacles. Every edge must avoid room and building footprints.
Every edge must avoid elevator shafts. Every edge must avoid blocked stair and escalator footprints.
Every edge must avoid unresolved footprints. Validate agent clearance, not only a zero-width line.
Use vector geometry when vector polygons exist. Otherwise use sufficiently dense, scale-aware sampling.
Treat the valid domain as walkable area minus obstacles. Make edges bidirectional unless semantics explicitly define one-way travel.
Give each edge deterministic cost and geometry. Remove zero-length edges.
Remove duplicate edges. Remove unexplained tiny segments.
Reject any edge that fails collision validation. Acceptance requires zero invalid retained edges.
# Connectivity diagnostics
Compute connected components after graph generation. Record each component size.
Record door-node counts per component. Record isolated nodes.
Record inaccessible features and reasons. Treat unintended isolated traversable doors as failures.
Show component IDs in debug mode. Do not bridge components through blocked space.
Do not add arbitrary direct lines to force connectivity.
# F30 regression
Detect the actual valid access point for F30. Create the correct F30 door node.
Connect it to the correct corridor centerline. Prove a route can start or finish at F30.
Add a regression test using real floor data. Do not hardcode an F30 coordinate.
Do not add an F30-only special edge.
# F32-to-F20 regression
Place F32 and F20 in the expected connected component. Provide a continuous route through real corridors.
Do not require or add a direct F32-to-F20 edge. Validate every route segment against obstacles.
Validate any smoothed route segment again. Add an automated route-exists test.
Capture a final route screenshot.
# F01 corridor regression
Determine why corridor F01 is unused or disconnected. Classify F01 correctly.
Generate its centerline, nodes, and edges. Connect it to the surrounding graph.
Prove it can carry a valid route. If another route is shorter, still prove F01 belongs to the component.
Add a dedicated integration and E2E case. Capture a final F01 route screenshot.
# Pathfinding and rendering
Search only over validated graph edges. Use valid door or portal endpoints.
Do not use room centroids as endpoints. Do not fall back to a straight line when search fails.
Display the existing unreachable state when no route exists. Revalidate line-of-sight optimization.
Revalidate string pulling. Revalidate Bézier or rounded-corner output.
Remove unsafe smoothing when it cannot be validated. Keep the rendered route within navigable space.
Keep it outside unresolved footprints. Keep it outside raised building blocks.
Allow vertical-circulation entry only through explicit portals. Raise the route only enough to avoid z-fighting.
Keep its horizontal footprint identical to validated geometry. Keep route alignment stable under zoom, pan, resize, and camera changes.
# Vertical circulation
Detect elevators. Detect normal stairs.
Detect escalators or electric stairs. Detect their entrances and landing zones.
Represent each footprint in the 2.5D scene. Treat shafts and blocked interiors as obstacles.
Do not treat an entire stair or escalator footprint as freely walkable. Create portal nodes only at explicit valid entrances.
Connect floors only when multi-floor routing already exists or is in scope. For same-floor routing, block invalid crossings.
When multi-floor routing is out of scope, keep correct same-floor semantics. Add route tests near each available vertical-circulation type.
# Complete 2.5D geometry
Generate geometry for every expected closed non-walkable footprint. Include large rooms.
Include small utility rooms. Include service blocks.
Include elevators. Include stairs.
Include escalators. Use the canonical transform for every footprint.
Start extrusion at the correct floor elevation. Use consistent extrusion height rules.
Match semantic footprint boundaries. Prevent systematic translation.
Prevent systematic rotation. Prevent scale or aspect-ratio drift.
Prevent accidental overlap between adjacent blocks. Keep doors visually consistent with semantic openings.
Keep corridors at floor level. Keep labels associated with the correct IDs.
Do not hide missing geometry using the camera or clipping. Do not apply a global CSS shift as a substitute for correct coordinates.
# Debug and test instrumentation
Add or improve a development-only debug mode. Display the walkable region.
Display obstacle polygons. Display unresolved polygons.
Display door openings. Display door nodes.
Display junction nodes. Display turn nodes.
Display vertical-portal nodes. Display graph edges.
Display connected-component IDs. Display the current route.
Highlight invalid edges clearly. Display alignment landmarks.
Display canonical transform values. Keep debug rendering out of production behavior.
For Canvas or WebGL, expose a read-only E2E interface. Use a name such as `window.__NAV_DEBUG__`.
Expose graph nodes and node reasons. Expose graph edges.
Expose components. Expose walkable and obstacle polygons.
Expose door associations. Expose route coordinates.
Expose route-validation results. Expose transform parameters.
Expose alignment landmarks. Expose a map-ready signal.
Do not expose mutation methods.
# Guardrails
Do not hardcode coordinates, paths, transforms, or edges for F01, F20, F30, or F32. Use those IDs only as regression cases.
Do not hide extra nodes with CSS. Do not delete required junction or turn nodes just to reduce count.
Do not classify unknown footprints as walkable. Do not connect components through blocked space.
Do not route to room labels or centroids. Do not disable collision checking.
Do not retain unsafe smoothing. Do not create per-room alignment offsets.
Do not update visual baselines blindly. Do not accept screenshot-only evidence.
Do not perform a large unrelated refactor. Preserve room IDs, labels, controls, and public APIs unless required.
Prefer existing geometry and rendering libraries. Add a dependency only with clear justification.
Do not finish with uncaught errors or failed critical requests. Do not claim a tool is unavailable before inspecting available skills and MCP tools.
When a named tool is genuinely unavailable, record the limitation and use the nearest equivalent. Do not mark its verification complete without equivalent evidence.
# Phase 1: repository and skills
Inspect repository structure. Inspect package scripts.
Identify the framework and renderer. Identify geometry libraries.
Identify graph and pathfinding code. Identify unit, integration, and E2E frameworks.
Locate and read relevant `SKILL.md` files. Follow the available E2E skill workflow.
Use the existing package manager. Determine the correct start command and URL.
Run existing lint, typecheck, unit, integration, and E2E tests. Record the baseline status before editing.
# Phase 2: reproduce the defects
Start the application. Open the affected floor.
Use a deterministic viewport. Prefer `1600 × 900` and DPR `1` unless the project defines another standard.
Wait for fonts, textures, semantic data, and geometry. Capture the current semantic graph.
Capture the current default 2.5D scene. Capture the current F32-to-F20 attempt.
Capture the current F30 state. Capture the current F01 state.
Capture at least one route collision when reproducible. Record before node count.
Record before edge count. Record before component count.
Record before isolated nodes. Record before invalid edges and route segments.
Store baseline artifacts under `artifacts/navigation-fix/before/`.
# Phase 3: root-cause analysis
Inspect source code and runtime state. Use the E2E skill for repeatable reproduction.
Use Playwright MCP for user-facing flows. Use Chrome DevTools MCP for console, network, and live-browser inspection.
Inspect DOM and CSS where relevant. Inspect Canvas or WebGL state where relevant.
Inspect coordinate transforms at runtime. Inspect graph and collision diagnostics.
Create a root-cause table. Include symptom.
Include responsible pipeline stage. Include evidence.
Include intended fix. Include regression test.
Do not implement a workaround before locating the cause.
# Phase 4: implementation order
Implement the canonical transform first. Then fix semantic classification.
Then fix walkable and obstacle geometry. Then fix door extraction.
Then fix sparse centerline graph generation.
Then fix graph simplification.
Then fix edge collision validation.
Then repair valid connectivity.
Then resolve F30, F32-to-F20, and F01 regressions.
Then fix route smoothing and rendering.
Then complete 2.5D extrusion.
Then add debug and test instrumentation.
Run the smallest relevant tests after each step.
# Unit tests
Test semantic-to-world conversion.
Test world-to-semantic conversion.
Test round-trip accuracy.
Test Y inversion and origin handling.
Test scale, rotation, crop, and padding.
Test feature classification.
Test unknown-footprint blocking.
Test door-center extraction.
Test exactly-one-node-per-door behavior.
Test node deduplication.
Test collinear degree-two-node removal.
Test junction preservation.
Test necessary turn preservation.
Test edge-within-walkable validation.
Test buffered edge-obstacle intersection.
Test route-smoothing collision validation.
Test connected-component detection.
Test destination-to-door selection.
Test elevator, stair, escalator, and portal semantics.
Test deterministic graph output.
# Integration tests
Use the real affected floor data.
Assert every traversable door has exactly one node.
Assert no ordinary graph node lies inside an obstacle.
Assert no retained edge crosses an obstacle.
Assert unresolved footprints are never walkable.
Assert F30 has a valid graph connection.
Assert F32 and F20 share the expected component.
Assert a valid F32-to-F20 route exists.
Assert F01 belongs to the surrounding component.
Assert F01 can carry a valid route.
Assert no unintended isolated traversable door remains.
Assert every expected 2.5D footprint is rendered.
Assert vertical-circulation footprints are represented.
Assert all geometry uses the canonical transform.
Assert alignment landmarks stay within tolerance.
# E2E tests
Use the installed E2E skill and Playwright.
Exercise the actual user interface.
Open the floor.
Select route origins and destinations.
Trigger route calculation.
Change view or camera when relevant.
Assert `semantic graph uses sparse centerline nodes`.
Assert `each traversable door has one door node`.
Assert `F30 is connected`.
Assert `F32 can route to F20`.
Assert `F01 corridor is connected and routable`.
Assert `selected route never intersects blocked footprints`.
Assert `room routes end at door thresholds`.
Assert `vertical circulation blocks invalid crossing`.
Assert `2.5D footprints align with the plan`.
Assert `alignment survives zoom and camera movement`.
Use the read-only debug interface for Canvas or WebGL assertions.
Retain trace, screenshot, and console evidence on failure.
# Screenshot verification
Use deterministic browser, OS or container, viewport, DPR, camera, and data.
Wait for the map-ready signal.
Wait for fonts and assets.
Disable or finish animations.
Move the pointer away from hover-sensitive elements.
Use Playwright visual assertions where stable.
Use `expect(page).toHaveScreenshot(...)` or the project equivalent.
Create `after/semantic-graph-debug.png`.
Create `after/2.5d-default.png`.
Create `after/alignment-overlay.png`.
Create `after/route-f32-to-f20.png`.
Create `after/f30-connected.png`.
Create `after/f01-corridor-route.png`.
Create `after/vertical-circulation.png`.
Create `after/long-cross-map-route.png`.
Do not update a baseline until functional geometry assertions pass.
Manually inspect every changed baseline.
Keep screenshots as evidence, not as the only validation.
# Chrome DevTools MCP verification
Inspect browser console messages.
Inspect uncaught exceptions.
Inspect source-mapped stack traces.
Inspect failed network requests.
Inspect semantic, texture, and geometry resource loading.
Inspect canvas or WebGL dimensions.
Inspect device pixel ratio.
Inspect runtime transform values.
Inspect route-calculation diagnostics.
Inspect resize and layout offsets.
Take at least one final screenshot.
Require zero uncaught application exceptions.
Require zero failed critical data or geometry requests.
Require no recurring invalid-geometry warnings.
Require no stale-state race during route selection.
# Playwright MCP verification
Navigate to the application.
Open the affected floor.
Inspect the live page state.
Select F32 and F20 through the UI.
Generate and inspect the route.
Confirm the route follows valid corridors.
Select F30 and a connected destination.
Confirm F30 is routable.
Exercise a route that uses F01.
Exercise a route near vertical circulation.
Confirm no route enters a raised block.
Capture final screenshots.
Do not verify only through internal function calls.
# Acceptance criteria: graph
Every retained node has a valid topological reason.
No raw skeleton or contour samples remain as exposed nodes.
No duplicates remain within merge tolerance.
No unnecessary nearly-collinear degree-two node remains.
Every traversable door has exactly one node.
Door nodes lie on actual openings or thresholds.
The before and after node counts are reported.
Counts by node reason are reported.
The node count should decrease unless evidence proves the old graph already met all sparsity rules.
# Acceptance criteria: connectivity
F30 is connected.
F32 can route to F20 through valid corridors.
F01 is connected and usable.
There are zero unintended isolated traversable door nodes.
All intentionally inaccessible features are reported with reasons.
No invalid direct bridge is added between blocked components.
# Acceptance criteria: collision safety
Zero retained graph edges intersect blocked footprints with clearance.
Zero tested route segments intersect blocked footprints.
Zero smoothed segments bypass validation.
Zero routes enter unresolved footprints.
Room routes terminate at valid door thresholds.
No unchecked straight-line fallback exists.
# Acceptance criteria: 2.5D
All expected non-walkable footprints are represented.
Elevators are represented.
Stairs are represented.
Escalators are represented.
No required block is hidden by camera or clipping.
No feature uses an unrelated offset.
The route stays outside raised blocks.
# Acceptance criteria: alignment
Use at least eight landmarks distributed across the floor.
Include left, right, upper, and lower areas.
Use a canonical top-down debug view.
At `1600 × 900`, DPR `1`, maximum landmark deviation is `5 CSS px`.
Use a stricter existing project tolerance when available.
There must be no systematic translation.
There must be no systematic rotation.
There must be no scale or aspect-ratio drift.
Alignment must remain stable after zoom, pan, resize, and supported camera changes.
# Acceptance criteria: quality
All relevant unit tests pass.
All relevant integration tests pass.
All relevant E2E tests pass.
Typecheck passes.
Lint passes or introduces no new errors.
No uncaught console errors occur in tested flows.
No critical network request fails.
All required screenshots exist and are reviewed.
# Diagnostic artifact
Create `artifacts/navigation-fix/navigation-audit.json`.
Include floor identifier.
Include before and after node counts.
Include nodes by reason.
Include before and after edge counts.
Include traversable-door count.
Include door-node count.
Include missing-door-node count.
Include duplicate-door-node count.
Include connected-component count.
Include door nodes per component.
Include unintended isolated-node count.
Include invalid-edge count.
Include invalid-route-segment count per tested route.
Include unknown-footprint count.
Include unknown footprints incorrectly marked walkable.
Include expected and rendered 2.5D footprint counts.
Include alignment errors and maximum error.
Include tested routes.
Include test-suite status.
Include console-error count.
Include critical network-failure count.
# Final response
Return `## Completion Checklist`.
Repeat the opening checklist with honest `[x]` states.
Return `## Confirmed Root Causes`.
For each issue, state the cause, module, evidence, and fix.
Return `## Files Changed`.
Explain each changed file briefly.
Return `## Before/After Metrics`.
Use a concise table for nodes, edges, components, door coverage, isolated nodes, invalid geometry, footprint coverage, and alignment.
Return `## Regression Scenarios`.
Report F30, F32-to-F20, F01, vertical circulation, and a long route.
Return `## Test Evidence`.
List commands and results for unit, integration, E2E, typecheck, lint, Playwright MCP, and Chrome DevTools MCP.
Return `## Screenshot Evidence`.
List every before, after, and visual-diff artifact.
Return `## Remaining Limitations`.
State only real remaining limitations.
Do not claim completion when any required acceptance criterion fails.
# Definition of done
The graph is visibly and programmatically sparse.
Every traversable door has exactly one node.
F30 is connected.
F32 routes to F20.
F01 is connected and usable.
No graph edge crosses blocked geometry.
No selected route crosses blocked geometry.
Unknown footprints remain blocked.
Vertical-circulation features are correctly modeled.
Every required block is represented in 2.5D.
All layers share one canonical transform.
The plan and 2.5D scene are aligned.
Automated tests pass.
Browser verification passes.
Before and after evidence proves the result.
