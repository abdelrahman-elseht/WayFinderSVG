# Deployment and physical kiosk configuration

## Production build

Use Node.js 22.23+ and the committed lockfile. From the repository root:

```sh
npm ci
npm run typecheck
npm test
npm run test:data
npm run build
npm start
```

`prebuild` validates floor/content/graph contracts and copies `maps/B03/GF/master.svg` to `apps/web/public/maps/B03/GF/master.svg`. It does not require Python or access the source PDFs. `npm start` uses `next start apps/web --hostname 0.0.0.0`, normally port 3000; use `npm start -- --port 3001` to select another port. Run the process under your operating system's service/process supervisor. A local kiosk can use `http://localhost:3000`; a network installation should put its usual HTTPS reverse proxy in front of the Node server.

For deployment from a checkout, retain `node_modules`, `apps/web/.next`, `apps/web/public`, the root manifest/lockfile, and the Next.js configuration. This project currently uses Next's normal Node server, not a standalone-output package or static export. Source PDFs and full extraction JSON are audit inputs, not public assets. Do not copy `maps/B03/GF/source` into the public directory. Inter and Noto Sans Arabic are bundled locally, with no runtime font CDN request.

## Configuration

Optional environment variables are read by the server page **during production generation**. Set them before `npm run build`; rebuild after changing them. For local development, restart `npm run dev` after changing configuration.

| Variable | Default | Meaning |
| --- | --- | --- |
| `WAYFINDING_BUILDING_ID` | `B03` | An actually imported and registered building. |
| `WAYFINDING_FLOOR_ID` | `GF` | An actually imported and registered floor. |
| `WAYFINDING_KIOSK_ID` | The floor's sole kiosk, if exactly one exists | Select an existing kiosk record; does not create or confirm a position. |
| `PYTHON_EXECUTABLE` | Repository `.venv`, then system Python | Source regeneration only; absolute executable path supported. |
| `QA_BASE_URL` | `http://localhost:3000` | Browser-test target. |
| `QA_BROWSER_CHANNEL` | Playwright Chromium | Optional installed browser channel, for example `msedge`; omit for `npx playwright install chromium`. |

PowerShell configuration example:

```powershell
$env:WAYFINDING_BUILDING_ID = 'B03'
$env:WAYFINDING_FLOOR_ID = 'GF'
$env:WAYFINDING_KIOSK_ID = 'B03-GF-kiosk'
npm run build
npm start
```

POSIX shell equivalent:

```sh
WAYFINDING_BUILDING_ID=B03 WAYFINDING_FLOOR_ID=GF WAYFINDING_KIOSK_ID=B03-GF-kiosk npm run build
npm start
```

Unknown IDs fail the build. No coordinate or arbitrary node environment override exists. In the supplied source bundle, `B03-GF-kiosk` has `nodeId: null` and `status: "unknown"`; selecting that record does not establish a physical kiosk origin. Instead, `navigationDefaults.startRoomId` supplies the named Main Entrance planning origin. If a floor has multiple kiosks, select an explicit kiosk ID rather than relying on array order.

## Confirming a physical starting point

Confirm the kiosk's physical placement with facility staff and relate it to the current drawing. Record the evidence with the semantic generation/review inputs, add the correct graph node, and set that kiosk's `nodeId` and status only after verification. Update the generation source as well as generated JSON so a subsequent pipeline run does not erase the configuration. A confirmed kiosk must reference a confirmed node on the same building/floor; the validator enforces this.

The supplied B03 graph explicitly uses `routingPolicy: "drawing-based"`. Candidate source connections with unknown physical access can generate routes only after navigable-area and wall checks; closed links and unknown geometry remain excluded. The optional verified-accessibility filter still requires confirmed step-free evidence. Omitting the policy retains the stricter `verified-only` behavior. Confirm current public access, door restrictions and wheelchair access separately with facility staff. Add physical scale only with recorded calibration evidence, keeping floor and graph calibration synchronized. Without calibration, the UI shows “Route on floor plan” and turn instructions, not invented metre distances. Re-run the source pipeline, actual B03 journey tests and review before release. Algorithm and geometry tests do not establish current building conditions.

Starting-point precedence is a custom room, then a confirmed configured kiosk, then `navigationDefaults.startRoomId`. The default room is a planning origin and is never labeled as the physical kiosk or “you are here”. Clearing the custom choice restores that precedence. “Reset route / start” clears the destination, selection and custom start; a confirmed kiosk changes this button to “Reset to kiosk”. Room-specific `navigationNote` text explains qualified suite or landmark endpoints before instructions and in room details. Qualified arrivals refer to a mapped entrance or approach, not the room itself. `navigationPartial: true` on either endpoint labels the result “Partial route”: only the connected source-covered segment is drawn, and the UI does not claim the complete journey is shown.

## Local kiosk operation

1. Start the production Node service automatically at sign-in or boot, and wait for [localhost:3000](http://localhost:3000) to respond before opening the browser.
2. Launch a maintained Chromium/Edge browser in kiosk/fullscreen mode against that address. For example, on Windows: `msedge.exe --kiosk http://localhost:3000 --edge-kiosk-type=fullscreen`. Resolve the browser executable through your managed installation if it is not on PATH.
3. Verify the actual display and touch device: English/Arabic switch, RTL direction, search, keyboard focus, room selection, zoom/pan/reset, description speech, mute/stop and start/destination controls.
4. Install English and Arabic system speech voices where audio is required. Browser speech availability and automatic playback vary by device; the directory and room details remain usable without audio.
5. Exercise real B03 routes from the default entrance and from a custom room, in both languages. Check the route line and turn instructions, qualified arrival notes, reset behavior and the verified-accessibility unavailable state. Confirm the default origin is clearly distinct from the unconfigured physical kiosk and that no metre estimate appears without calibration.

WebGL is required for the 2.5D map; the keyboard directory remains the equivalent room selection path. This release is a local/network web application, not an offline PWA: keep the local service running. Test browser restart, power restoration and the actual kiosk zoom/accessibility settings before installation.

## Updating source evidence

Keep both original PDFs with their exact names at repository root, install the pinned Python dependencies described in the README, and run `npm run pipeline`. Inspect `maps/B03/GF/inspection`, `data/buildings/B03/GF.semantic-review.png`, and the written source/semantic review before accepting generated changes. Run browser tests against the production server, including Arabic and mobile/touch layouts. Preserve unresolved evidence in `docs/KNOWN_ISSUES.md`; the build passing is not a claim of facility approval.
