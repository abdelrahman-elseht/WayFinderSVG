# Optimization profile for `opt/optimisation01`

## Method

This report follows the evidence-first workflow from `fast-anything` and `shrink-anything`.

- The representative page was `http://127.0.0.1:3888/?floor=GF`.
- The server was the Next.js development server on port 3888.
- Browser tracing of a successful lift/escalator interaction was unavailable in this environment, so transition-specific findings are hypotheses unless marked otherwise.
- Existing production artifacts under `apps/web/.next-production-audit` were measured without rebuilding. A fresh standard production build remains blocked by the known GF graph validation error on edge 116.
- Existing route benchmark evidence under `artifacts/navigation-v2/route-benchmark.json` was used for route CPU context.

## Measurements

| Signal | Measurement | Interpretation |
|---|---:|---|
| Development HTML before floor split | 2,877,426 bytes, curl total 3.78 s | Both full floor payloads plus development overhead |
| Development HTML after initial graph deferral | 463,262 bytes raw, 44,382 compressed | About 83.9% less raw HTML than the original observation. Initial map data has zero routing edges. |
| GF map SVG | 956,900 bytes | Largest public asset |
| Floor 01 map SVG | 626,891 bytes | Second-largest public asset |
| Logo | 7,586 bytes | Already reduced from the previous 927 KB PNG |
| Existing production map chunk | 924,089 bytes raw | Three/R3F map chunk |
| Existing production map chunk gzip | 244,723 bytes | Transfer-size estimate for the map chunk |
| Existing route benchmark | 31.9–318.4 ms for recorded legacy GF cases | Route calculation can be meaningful for some graphs, but this benchmark is not a transition trace |
| Existing browser observation | 648.7 ms navigation, 2,455 ms map/fonts ready | Local headless Edge observation from the prior audit, not kiosk hardware |

The development waterfall’s Three.js, React Three Fiber, and related modules total roughly 593 KB in the supplied screenshot. These requests do not represent a production transfer because they include development chunks and HMR overhead.

The public page now sends the active floor's display data and both lightweight floor directories. Route planning fetches the required validated graph from `/api/navigation/:floorId`. Matching revision requests return immutable caching, while stale revision requests return the current bundle with `no-store` and status 409. A versioned SVG path returns `public, max-age=31536000, immutable`; the unversioned compatibility path retains its one-day cache.

The initial floor graph is now omitted from routing state and only its lift/escalator markers are included with the map. Starting either same-floor or cross-floor route planning fetches the required floor graph bundles. The 463,262-byte development response was measured after this second split, compared with 2,877,426 bytes before data splitting. Matching map SVG URLs also carry a content-derived revision and receive immutable cache headers.

## Transition profile status

A complete transition trace could not be collected. The available browser connection did not expose a usable Chrome DevTools performance trace, and the scripted browser run did not complete a known cross-floor selection. The dominant transition cost therefore remains unresolved between these candidates:

- destination SVG decode and rasterization into two 2048×1024 canvases
- WebGL texture upload and scene work at the floor switch
- route-choice preparation on filtered transition graphs
- React work associated with floor state and route playback
- label projection and camera-follow work

The current implementation already keeps the canvas mounted, caches floor texture promises, lowers texture resolution, removes directional shadows, and caches route preparation/results. The next transition-specific implementation should start the destination texture promise before the floor state changes and should reuse filtered transition graphs.

## Pure-function port decision

A Rust/WASM or native port is **not justified by current evidence**.

The available measurements show a large map asset and a substantial Three/R3F chunk, while the actual transition interaction has not produced a CPU trace. The likely texture upload and WebGL work would not benefit from a route-function port. The existing route benchmark shows some route calls above the 2% threshold in isolation, but it does not establish that route calculation dominates the end-to-end transition.

If a trace later shows route preparation above 2% of transition CPU time, the correct candidate is the outer route-preparation operation. A port should then:

1. Record real calls from GF-to-01 and 01-to-GF journeys.
2. Include lift, escalator, accessible-only, mutation, invalid graph, partial route, and empty-input cases.
3. Compare route status, node IDs, edge IDs, points, distance, and bilingual instructions.
4. Interleave original and optimized runs and compare median end-to-end transition time.
5. Enable the port only when replay parity passes and the browser interaction improves.

## Reproduction

Development request size and cache headers:

```sh
curl -sS -o /dev/null -w 'http=%{http_code} total=%{time_total} size=%{size_download}\n' \
  'http://127.0.0.1:3888/?floor=GF'

curl -sSI 'http://127.0.0.1:3888/maps/B03/GF/master.svg' \
  | rg -i 'HTTP|cache-control|content-length|etag'

curl -sSI 'http://127.0.0.1:3888/maps/B03/GF/master.svg?v=96108092be9fe309' \
  | rg -i 'HTTP|cache-control|content-length|etag'

curl -sS -D - 'http://127.0.0.1:3888/api/navigation/01?revision=bad' -o /dev/null \
  | rg -i 'HTTP|cache-control|etag'
```

Production chunk measurements:

```sh
du -b apps/web/.next-production-audit/static/chunks/16kr6tzr4cy3f.js
gzip -c apps/web/.next-production-audit/static/chunks/16kr6tzr4cy3f.js | wc -c
```

Route benchmark inspection:

```sh
node -e "const b=require('./artifacts/navigation-v2/route-benchmark.json');   console.log(b.cases.map(c => ({id:c.id, legacy:c.legacy.dijkstraMilliseconds, v2:c.v2.dijkstraMilliseconds})))"
```

A valid transition trace still requires a production server built after the GF edge 116 validation issue is resolved, or a previously validated production build. Start tracing after the page is warm, select a known cross-floor destination, choose lift or escalator, and stop after the destination route is visible.

## Limitations

- No CrUX or first-party RUM data is available.
- The 3.78-second development response is not a production performance metric.
- The production artifact was generated before the current branch’s later changes and was not rebuilt because data validation fails on GF edge 116.
- No WASM implementation was added because the evidence does not identify route CPU as the transition bottleneck.

