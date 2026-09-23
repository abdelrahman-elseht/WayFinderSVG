# Quickstart Validation

1. Run `npm ci`, `npm run typecheck`, and `npm run validate:data`.
2. Run `npm run build` and `npm start -- --port 3001`.
3. Choose a known start and destination. Start navigation and verify ordered line reveal, smooth camera follow, stop/reset, and reduced-motion static display.
4. Mark one known room unavailable in floor JSON, rebuild, and verify it remains discoverable but cannot start a route. Restore available and verify routing returns.
5. Inspect elevator/electric-stair features and cafeteria/remaining reviewed blocks at desktop and mobile sizes. Verify consistent raised shading and no invented dimensions.
6. Verify localized human-readable labels with codes secondary; switch to Arabic and confirm RTL.
7. Start room speech, immediately start a route, and verify cancellation before the first route instruction. Repeat in Arabic and test missing/muted speech fallback.
8. Run `npm test`, `npm run test:data`, and `QA_BASE_URL=http://localhost:3001 npm run test:e2e`.

Expected result: existing checks remain green, unavailable destinations are blocked, routes animate or honor reduced motion, and English/Arabic journeys remain usable.
