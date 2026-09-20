# Data contracts v1

Canonical TypeScript types: `packages/map-engine/src/types.ts`. Do not change without orchestrator approval. All files UTF-8, deterministic stable IDs, no generation timestamps in map/data output.

## Coordinates and evidence
Coordinates are `[x,y]`, x right and y down, in normalized master SVG drawing units. `Floor.viewBox` is `[x,y,width,height]`. Renderer maps x to scene x and y to scene z, height to scene y. Calibration is null unless source-backed and recorded. Status is `confirmed`, `candidate`, or `unknown`. Confirmed means evidence-backed extraction, not an assertion of public access or facility approval.

## Source ingestion (A)
`maps/B03/GF/master.svg`: cleaned vector floor master. `maps/B03/GF/alignment.json`: transforms, crops, calibration provenance and common viewBox. `maps/B03/GF/source/{0001,0002}.json`: `texts[]` with id,text,bbox,origin,font,size,direction; `paths[]` with id,layer,bbox,type,items,stroke,fill,width,closed,evenOdd,dashes. Each item has `type: line|cubic|rect|quad` and `points: Point[]`. All source coordinates are already rotated to display coordinates; apply `displayToMaster` exactly once. Source 0001 identity, source 0002 translates (+1033.29,-28.35). Master viewBox `[650,500,3100,1550]`. Six shared text anchors validate translation to residual <=0.00011 drawing units. Keep full original vector extraction distinct from cleaned presentation. Both sheets represent the same floor.

## Semantic map (B)
`data/buildings/B03/GF.json`: FloorData. `data/buildings/B03/GF.graph.json`: NavigationGraph. `content/B03/GF.json`: RoomContent[]. Geometry and content are separate. A nullable polygon or door means unknown, never a guessed rectangle. Candidate polygons must carry provenance. Codes/names must be associated through label position and enclosing evidence. Arabic translations of clear English source names may be supplied with documented translation provenance; missing names use localized 'Room [code]' rather than invented uses. Public flag is a directory presentation choice and cannot imply route access.

Kiosk defaults: `nodeId: null`, `status: unknown`. An empty or candidate graph is valid and results in an explanatory unavailable state. Confirmed graph nodes/edges require source evidence, navigable containment and valid door intersections. `distance` always declares unit. Graph `walls` and `navigableAreas` provide geometry validation inputs.

## Search and localization (E)
`packages/search/src/index.ts`: `normalizeSearch(text: string): string`; `searchRooms(rooms: Room[], query: string, language?: Language): Room[]` ordered best-first. Empty query returns stable inventory. Arabic diacritics/tatweel/alef/ya variations normalized.
`packages/i18n/src/index.ts`: `getDirection(language): 'rtl'|'ltr'`; `resolveLanguage(value: unknown): Language`; `t(language: Language, key: string): string`; localized UI dictionary exported. Keys are agreed with UI agent through handoff.
`packages/audio/src/index.ts`: `TTSService` with `speak(text, language)`, `stop()`, `setMuted(muted)`, `isSupported(): boolean`; `createBrowserTTS(): TTSService`. Browser globals only accessed client-side. No UI code depends on SpeechSynthesis directly.

## Routing (C)
`packages/routing/src/index.ts`: `findRoute(graph: NavigationGraph, startId: string | null, endId: string | null, options?: {accessibleOnly?: boolean}): RouteResult`; `generateInstructions(graph, nodeIds: string[], edgeIds: string[]): RouteInstruction[]`; `polylineLength(points: Point[]): number`. Return structured unavailable/unconfirmed/invalid results instead of exceptions for ordinary route failures. Unknown or candidate graph links cannot generate visitor routes. Accessible-only excludes unknown accessibility. Do not use a heuristic that can overestimate vertical or mixed-scale paths; Dijkstra is permissible as zero-heuristic A*.

**User revision:** the preceding verified-route gate applies to the default `routingPolicy: 'verified-only'`. Explicit `routingPolicy: 'drawing-based'` permits source-derived candidate nodes/edges and unknown current restrictions after wall/enclosure validation, while preserving their evidence statuses. Closed edges, unknown geometry, invalid geometry, missing navigable areas, and unknown accessibility under accessible-only remain rejected. Drawing-based routes are functional plan routes, not claims of current facility inspection. See `RESUMPTION_PLAN.md`.

`FloorData.navigationDefaults?: {startRoomId:string}` names the planning start when no configured physical kiosk node exists. The room and its navigation connection must be present. The UI names that room explicitly and never calls this fallback the kiosk's actual location.

`Room.navigationNote?: Localized` qualifies the route endpoint; `navigationPartial?: boolean` flags missing final source coverage. Partial routes require a bilingual note. Drawing-mode `doorNodeId` is the legacy connection field and may reference a room-linked door, entrance or junction approach, provided the room/floor identities match. Verified-only mode retains its stricter door contract. Qualified endpoints use mapped-entrance/approach arrival language; partial journeys are explicitly labeled incomplete in both languages.

## UI (D) and integration (F)
Import shared types from `@wayfinding/map-engine`, search/i18n/audio/routing from matching aliases. Static canonical data can be imported from JSON. Source asset is served under `/maps/B03/GF/master.svg`; integration copies it from canonical map output. Keep selection, start, destination, active floor/building, language and mute explicit. Custom start null means fall back to configured kiosk node, not an arbitrary room. Unsupported routes show meaningful localized status; never invent a demonstration route on the live map. Draw candidate room contours distinctly; clickable source label markers are valid when geometry is unresolved.

`validateFloorBundle(floorData: unknown, graph: unknown, contents: unknown): FloorBundle` is the runtime validation boundary before UI use. `createMapRegistry(inputs)` validates consistent building/floor declarations and unique kiosk IDs, then exposes buildings, floors, getFloor and getKiosk. Production generation selects only existing records through WAYFINDING_BUILDING_ID/FLOOR_ID/KIOSK_ID. Changing these requires a rebuild. A kiosk status of confirmed requires a confirmed node in that building/floor.

Confirmed same-floor graph edges require positive geometry-consistent distances and verified navigable areas at ingestion. Routing rejects supplied wall contacts and paths outside the complete union of navigable polygons, not merely endpoints. V1 wall/area evidence is not floor-scoped; constrained graphs spanning multiple confirmed floors fail closed pending a versioned floor-scoped extension. Future vertical nodes/edge types exist, but this limitation is not a commissioned multi-floor route.

The semantic `centroid` currently records the source room-name label center, not necessarily the mathematical polygon centroid. This deliberate marker anchor preserves evidence alignment when polygons are unknown; consumers must not use it as a door or route endpoint. Candidate outer footprints omit obstruction holes and therefore are display geometry only.

## Tests
Vitest tests under tests/unit and tests/integration; Playwright under tests/e2e. Synthetic route fixtures must be named as such and never shipped as live B03 graph. Source/geometry validation can use Python. Persist review evidence and unresolved assumptions.
