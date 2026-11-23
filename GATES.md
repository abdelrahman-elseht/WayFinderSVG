# Gates: cross-floor vertical navigation

OWNS: packages/map-engine/**, packages/routing/**, apps/web/app/**, apps/web/components/**, apps/web/lib/**, scripts/semantic-map/**, tests/**, docs/**

Scope: author source-reviewed paired escalator and lift landings on separate floors, route across valid pairs, and switch the public map floor during playback.

- [x] G1: project TypeScript contracts and consumers compile
  CHECK: npm run typecheck && node -e "console.log('TYPECHECK_PASS')"
  EXPECT: TYPECHECK_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=bcba165ceeaf056867de34ebb8da04086219be3bca882f727d46c3840253d881; exit=0; EXPECT=matched; output-sha256=3066091e3dffc322b80270ff77d5870c6915a2df473dbb345272ac88f7f8de10; output-bytes=69; shell=/bin/sh; cwd=/mnt/f/projects/WaySvgTransition; path=14e601db6bf6/52 entries

- [x] G2: floor-scoped routing, transition pairing, and playback tests pass
  CHECK: npx vitest run tests/unit/multifloor-navigation.test.ts tests/unit/navigation-editor-authoring.test.tsx tests/integration/multifloor-wayfinding.test.tsx tests/integration/visual-playback.qa.test.tsx tests/integration/app-state.qa.test.tsx && node -e "console.log('TRANSITION_TESTS_PASS')"
  EXPECT: TRANSITION_TESTS_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=bf777a9152fad6d54d589e3f3062548d46d34cd36fb9596978152e4f8a8a408b; exit=0; EXPECT=matched; output-sha256=52a86af37a18e7c838c600b40d2ff2203913cdeb518c764462ea6f21524d0425; output-bytes=623; shell=/bin/sh; cwd=/mnt/f/projects/WaySvgTransition; path=14e601db6bf6/52 entries

- [x] G3: Python authoring and persistence checks pass
  CHECK: ./.venv/bin/python tests/qa/admin_authoring_test.py && ./.venv/bin/python tests/qa/navigation_persistence_test.py && node -e "console.log('PYTHON_TESTS_PASS')"
  EXPECT: PYTHON_TESTS_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=e3098196c786f54c02fda9b909c1ea199ad2408dbe0c8ee39a35056f81308251; exit=0; EXPECT=matched; output-sha256=d7beee24cb740edfc87d26cfbbe67c18f963118b2546700b277e29ea772779c2; output-bytes=229; shell=/bin/sh; cwd=/mnt/f/projects/WaySvgTransition; path=14e601db6bf6/52 entries

- [x] G4: local admin and public floor selection load without application errors
  EVIDENCE: Browser check on port 3666 verified `/admin` authentication with admin/admin, editor floor selection between GF and 01, and public floor selection updating the URL, heading and room list. No changes were published during the browser check. The synthetic playback integration test covers automatic transitions in both directions.
