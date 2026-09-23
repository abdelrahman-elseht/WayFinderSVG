# Data Model

## Room availability

Add optional availability to Room: status available or unavailable; localized reason; optional configuration identifier. Validate unique room IDs, required status, and both localized reason strings. Unavailable rooms remain searchable and details-visible but cannot be route destinations. Availability does not alter public, geometry, door, or accessibility evidence.

## Route playback state

UI state derived from RouteResult: phase idle, ready, playing, paused, complete, or stopped; progress 0..1; arc-length-clipped visible points; bounded instruction index; and followCamera. Invalid or unavailable routes never enter playing. Reset clears overlay and returns idle.

## Map feature presentation

Use existing MapFeature fields and a renderer display profile for illustrative height, color, and transition icon. Values are UI conventions, not measured building dimensions. Reviewed blocks without source geometry remain marker-only.

## Speech session

An exclusive UI session has kind description or route, language, text, and active state. Starting a route calls stop then starts route speech. Mute stops and prevents new speech.
