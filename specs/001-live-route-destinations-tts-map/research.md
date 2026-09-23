# Research: Live Route Playback, Configurable Destinations, and Map Fidelity

## Decision: Extend existing state and contracts

WayfindingApp already owns journey state, route calculation, instruction timing, and TTS lifecycle. FloorMap already receives route points and owns the Three.js camera and controls. The audio package already cancels speech before speaking and selects locale-matching voices. Add playback progress and camera target at these existing boundaries.

## Decision: Store availability in the floor data bundle

Destination selection comes from FloorData.rooms. A validated per-room availability field keeps configuration with the destination and lets the build validator reject unknown references. Keep it separate from public visibility, evidence, and accessibility.

## Decision: Reuse MapFeature for vertical transitions

MapFeature already represents escalators/elevators, provenance, connected floors, and evidence. Rendering should use feature geometry and shared extrusion helpers without implying commissioned cross-floor routing.

## Decision: Animate by polyline arc length

Normalized arc-length progress is deterministic for uneven segments and repeated points. A reduced-motion branch renders the complete route. Camera following updates the existing controls and stops at completion.

## Decision: Make route speech exclusive

TTSService.speak already calls stop. Route start must stop description speech before state changes, then speak the first localized instruction. Arabic uses the same service with language ar.

## Evidence constraint

The drawings do not prove exact real-world stair/elevator connectivity or measured heights. This feature limits vertical work to visual transition treatment and validated current routing behavior.
