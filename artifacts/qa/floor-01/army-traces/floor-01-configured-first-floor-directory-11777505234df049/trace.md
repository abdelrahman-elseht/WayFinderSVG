# ✓ configured First Floor directory and prepared map asset

`tests/agentic/floor-01.e2e.ts` · passed · 7.7s

Ran on: browser `chromium 153.0.8010.12` · user agent `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36`

## Steps

1. ✓ `app.open` `/` (517ms) — `node_modules/e2e/dist/run/steps.js:29`
   - ↪ navigated to /
   - screen: 181 nodes at `/`
2. ✓ `expect.toHaveValue` `getByRole("combobox", name: "Floor")` (53ms) — `node_modules/e2e/dist/run/steps.js:29`
3. ✓ `locator.tap` `getByRole("button", name: "Browse")` (3.1s) — `node_modules/e2e/dist/run/steps.js:29`
   - tap button "Browse" (3.1s)
   - ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
   - ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
   - ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
   - ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat) (at /:1)`
   - screen: 531 changes since step 1 at `/`, 472 nodes
     - `changed button "Browse" [pressed] (was: button "Browse")`
     - `changed button "Navigate" (was: button "Navigate" [pressed])`
     - `added text="Search rooms"`
     - `added searchbox "Search rooms"`
     - `added text="Filter by category"`
     - `added combobox "Filter by category" value="all"`
     - `added option "All spaces" [selected]`
     - `added option "Circulation"`
     - `added option "Office"`
     - `added option "Other"`
     - `added option "Laboratory"`
     - `added option "Restroom"`
     - 519 more
4. ✓ `expect.toBeVisible` `getByRole("searchbox")` (235ms) — `node_modules/e2e/dist/run/steps.js:29`
5. ✓ `locator.fill` `getByRole("searchbox")` (1.2s) — `node_modules/e2e/dist/run/steps.js:29`
   - fill searchbox "Search rooms" (1.2s)
   - screen: 267 changes since step 3 at `/`, 209 nodes
     - `changed searchbox "Search rooms" value="F-31" (was: searchbox "Search rooms")`
     - `added button "Clear search"`
     - `changed text="1 spaces" (was: text="54 spaces")`
     - `removed button "CORRIDOR 1 F-01 · Circulation"`
     - `removed image`
     - `removed text="CORRIDOR 1"`
     - `removed text="F-01 · Circulation"`
     - `removed image`
     - `removed button "CORRIDOR 2 F-02 · Circulation"`
     - `removed image`
     - `removed text="CORRIDOR 2"`
     - `removed text="F-02 · Circulation"`
     - 255 more
6. ✓ `expect.toBeVisible` `getByRole("button", name: "LIBRARY F-31 · Other")` (150ms) — `node_modules/e2e/dist/run/steps.js:29`
7. ✓ `locator.tap` `getByRole("button", name: "LIBRARY F-31 · Other")` (1.9s) — `node_modules/e2e/dist/run/steps.js:29`
   - tap button "LIBRARY F-31 · Other" (1.9s)
   - screen: 33 changes since step 5 at `/`, 233 nodes
     - `changed button "LIBRARY F-31 · Other" [pressed] (was: button "LIBRARY F-31 · Other")`
     - `changed button "LIBRARY, F-31" [pressed] (was: button "LIBRARY, F-31")`
     - `added complementary "Room details" testid="room-details"`
     - `added text="DESTINATION DETAILS"`
     - `added button "Close"`
     - `added image "Source floor drawing: LIBRARY · F-31"`
     - `added text="Drawing detail"`
     - `added text="Other"`
     - `added text="F-31"`
     - `added heading "LIBRARY"`
     - `added text="المكتبة"`
     - `added text="Building First Floor"`
     - 21 more
8. ✓ `expect.toBeVisible` `getByRole("heading", name: "LIBRARY")` (176ms) — `node_modules/e2e/dist/run/steps.js:29`

## App log

What the app logged, oldest first, with the step it happened in.

- step 3 · ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
- step 3 · ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
- step 3 · ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (at /:1)`
- step 3 · ⚠ console warning: `[.WebGL-0x4954001efe00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat) (at /:1)`

<sub>e2e 0.19.0 · run `01a12786-d880-7ddc-a63e-2e423837c9ef` · the whole run is in `report.json`</sub>
