# Delegation map — Phase 1–2 foundations

The feature source of truth is `specs/001-live-route-destinations-tts-map/`. Phase 2 freezes shared contracts before story work. Changes remain bounded to the T001–T010 files listed below.

## Ownership boundaries

| Area | Contract / owner | Phase 1–2 boundary |
|---|---|---|
| Floor and room data | `packages/map-engine/src/types.ts`, `validate.ts` | `Room.availability` is optional and operational. It has `status`, bilingual `reason`, and optional `configurationId`; it does not alter geometry, evidence, `public`, door, or accessibility fields. Validation rejects malformed status/reasons and an embedded room reference. |
| Audio | `packages/audio/src/index.ts` | Existing `TTSService` remains unchanged. Route speech and lifecycle integration belong to the later speech owner. |
| Localization | `packages/i18n/src/index.ts` | English and Arabic keys for availability, playback, route speech, transitions, and no-voice fallback are added together. Both locale records remain type-checked against the same key set. |
| Web components | `apps/web/components/routePlayback.ts` | Playback phase/progress/index/follow-camera types and pure clipping helpers only. `WayfindingApp.tsx` and `FloorMap.tsx` remain story-owner files. |
| Routing fixtures | `tests/fixtures/routing.ts` | Synthetic fixture inventory is explicitly test-only and has no relationship to B03 live data. |
| Generated B03 data | `data/buildings/B03/*`, `content/B03/*` | No generated data changed in T001–T010. Availability configuration will require its owning pipeline in a later phase. |
| QA/deployment docs | `docs/QA_REPORT.md`, `docs/KNOWN_ISSUES.md`, `docs/DEPLOYMENT.md` | No edits in Phase 2; final behavior and operational configuration belong to later integration/release work. |

## Compatibility decisions

`Room.availability` is omitted from current B03 records, preserving the existing bundle and directory behavior. Consumers should treat omission as the legacy available default when implementing destination actions. An explicit `unavailable` state is still searchable/details-visible but must not become a route destination. Configuration identifiers are opaque non-empty strings and carry no physical-access meaning.

Validation remains the single untrusted-data boundary. Availability is inline on its owning room, so a `roomId` property is rejected instead of allowing a dangling/non-room reference. Both `reason.en` and `reason.ar` are required whenever availability is present.

The baseline test command has pre-existing failures (see `baseline.md`); Phase 2 verification uses bounded typecheck, data self-test, and the focused availability contract test.
\.specify/extensions.yml is absent, so no extension hooks require execution. .specify/feature.json points to this feature directory.
