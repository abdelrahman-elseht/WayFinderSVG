# Baseline — live route destinations / T001

Captured 2026-09-22 from branch `codex/FirstFloorFinalFixes` before source contract edits.

- Working tree: `?? specs/` (the feature specification directory was already untracked); no tracked source changes were present.
- Node: `v22.23.2`
- npm: `10.9.8`

## Existing checks

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `npm test` | BASELINE FAILURES | 8 files / 116 tests collected; 6 files passed. Existing failures: 2 app-state assertions look for a missing `data-testid=room-directory`, and the live all-pairs route test timed out after 120s. These failures predate Phase 2 edits and were not changed here. |
| `npm run test:data` | PASS | 21 malformed-data rejection cases passed; canonical bundle accepted. |
| `npm run build` | PASS | Next.js production build completed; canonical B03 bundle validated and map asset prepared. |

The baseline failures are recorded for comparison and are outside T001–T010 scope.
