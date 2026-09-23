# UI and Configuration Contract

## Floor bundle

FloorData.rooms[*].availability is optional for backward compatibility. If present it must validate against the room record. The application exposes unavailable status in directory/details and prevents route start for that room.

## Floor map props

Extend the map contract with routeProgress, playbackPhase, followCamera, mapFeatures, and playback-stop/user-camera callbacks. route remains the complete validated polyline; the renderer clips it for display. route=[] means no overlay.

## Speech

TTSService.stop() is called before route-start state updates that can trigger route speech. speak(text, ar) is the Arabic route path. Unsupported speech never changes route status.

## Accessibility

Playback controls have localized accessible names and pressed/disabled states. Reduced motion renders the complete route immediately and does not auto-follow. Unavailable destinations expose localized status and no actionable route-start control.
