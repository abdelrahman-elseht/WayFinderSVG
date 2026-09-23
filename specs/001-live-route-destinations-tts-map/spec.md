# Feature Specification: Live Route Playback, Configurable Destinations, and Map Fidelity

**Feature Branch**: `001-live-route-destinations-tts-map`
**Created**: 2026-09-21
**Status**: Ready for planning
**Input**: Add live route playback with smooth camera following, configurable unavailable destinations, raised 2.5D vertical transitions and remaining blocks, route speech interruption with Arabic TTS, and human-readable room labels.

## User Scenarios & Testing

### User Story 1 - Follow a route as it plays (Priority: P1)
As a visitor, I want the route to draw itself while the map view follows it smoothly so I can understand the movement sequence.

**Independent Test**: Select a supported start and destination, start navigation, and observe progressive drawing, camera following, stop/reset behavior, and final framing.

**Acceptance Scenarios**:
1. **Given** a successful route, **When** navigation starts, **Then** the line reveals in route order and the view follows without abrupt jumps.
2. **Given** reduced-motion preferences, **When** navigation starts, **Then** the complete route remains visible without forced motion.
3. **Given** active playback, **When** the user stops or resets, **Then** animation and following stop and the map is usable.

### User Story 2 - Configure destination availability (Priority: P1)
As a site administrator, I want to mark destinations unavailable in data configuration so operational restrictions require no code changes.

**Independent Test**: Change destination configuration, reload, and verify directory visibility, selection, route actions, and localized unavailable messaging.

**Acceptance Scenarios**:
1. **Given** an unavailable destination, **When** a visitor opens it, **Then** its state is visible and route start is disabled or explained.
2. **Given** an available destination, **When** selected, **Then** validated route behavior remains available.
3. **Given** malformed availability data, **When** loaded, **Then** validation fails clearly.

### User Story 3 - Read a faithful, named map (Priority: P1)
As a visitor, I want vertical transitions and prominent blocks to use the same raised 2.5D visual language and labels to show actual room names.

**Independent Test**: Inspect highlighted transition areas, cafeteria/remaining flat blocks, and labels in English and Arabic.

**Acceptance Scenarios**:
1. Mapped elevators and electric stairs render raised, shaded, and identifiable as floor transitions without surveyed-height claims.
2. Reviewed flat blocks use a consistent low-rise 2.5D treatment without invented geometry.
3. Known human-readable names are prominent; source codes remain secondary identifiers.
4. English and Arabic show the correct localized name and text direction.

### User Story 4 - Hear route guidance in the selected language (Priority: P1)
As a visitor, I want route guidance to take over speech immediately and be available in Arabic as well as English.

**Independent Test**: Start a room description, choose a destination during playback, and verify interruption and route speech in the selected language.

**Acceptance Scenarios**:
1. Starting a route stops current speech immediately before route guidance.
2. Arabic route starts speak Arabic instructions with RTL-compatible text and an available Arabic voice.
3. Unsupported, muted, or blocked speech leaves visual directions usable.

### Edge Cases
- Partial, unavailable, invalid, or newly unavailable routes.
- Missing Arabic voice, active speech, or browser autoplay interruption.
- Language changes, reset, and destination changes during playback.
- Very short/repeated-point routes or camera bounds.
- Missing source polygon/cross-floor connection; unknown evidence stays unknown.
- Reduced motion, forced colors, keyboard, mobile, 200% text, and WebGL fallback.

## Requirements

### Functional Requirements
- **FR-001**: Provide explicit playback state that reveals successful routes in route order.
- **FR-002**: Smoothly follow the active segment while preserving controls and stable final framing.
- **FR-003**: Honor reduced motion and expose stop/reset behavior.
- **FR-004**: Support data-driven per-destination availability with localized unavailable text and no route start for unavailable destinations.
- **FR-005**: Validate availability with the floor bundle and reject unknown IDs, invalid statuses, and contradictions.
- **FR-006**: Render elevators and electric stairs as raised, shaded 2.5D features identifying vertical transitions without surveyed dimensions.
- **FR-007**: Apply the same 2.5D treatment to remaining reviewed blocks, including the cafeteria, using source-backed or explicitly illustrative geometry.
- **FR-008**: Display localized human-readable names primarily and retain codes as secondary searchable/accessibility identifiers.
- **FR-009**: Stop active room/detail speech before route speech, including mid-description.
- **FR-010**: Generate and speak English and Arabic route instructions through the replaceable speech service with no-voice fallback.
- **FR-011**: Preserve drawing-based safety, partial-route disclosures, RTL/LTR, keyboard, focus, contrast, and accessibility semantics.
- **FR-012**: Cover playback, configuration, 2.5D features, labels, interruption, Arabic speech, and accessibility with automated tests.

### Key Entities
- **Destination availability**: Localized operational state attached to a known destination.
- **Route playback**: Progress, camera-follow state, cancellation/reset state, and final route result.
- **Map feature**: Source-referenced transition or block footprint with name, type, status, and display geometry.
- **Localized room label**: Human-readable English/Arabic name paired with source code and aliases.
- **Speech session**: Current description or route instruction, language, mute state, and interruption lifecycle.

## Success Criteria
### Measurable Outcomes
- **SC-001**: Playback tests show complete validated geometry in route order with no camera jump over the configured threshold.
- **SC-002**: 100% of configuration tests prevent route start for unavailable destinations while available destinations retain validated behavior.
- **SC-003**: English and Arabic journeys interrupt active description speech before the first route instruction.
- **SC-004**: All mapped transitions and reviewed flat blocks use shared raised 2.5D treatment at desktop and mobile sizes.
- **SC-005**: At least 95% of supported journey participants identify destinations from visible localized names without source codes.
- **SC-006**: Existing source, route-safety, data-contract, accessibility, and production-build checks remain passing.

## Assumptions
- B03 Ground Floor remains the only commissioned floor; vertical features are visual transition markers unless a validated multi-floor graph is supplied.
- Availability is operational configuration, separate from physical accessibility and source evidence.
- Names come from existing source/content records or documented aliases; no architectural names are invented.
- Speech depends on installed voices and autoplay policy; visual instructions remain the fallback.
- Kiosk, mobile, keyboard, RTL, reduced-motion, and WebGL fallback remain in scope.
