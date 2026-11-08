# Navigation editor access

`/admin` uses HTTP Basic authorization with `WAYFINDING_ADMIN_USER` and
`WAYFINDING_ADMIN_PASSWORD`. Set both values in the deployment secret store or
untracked `apps/web/.env.local` before starting/restarting the Next.js server.
Never commit credentials. Passwords shorter than five characters fail closed.

For local development, `apps/web/.env.local` may contain
`WAYFINDING_ADMIN_USER=admin` and `WAYFINDING_ADMIN_PASSWORD=admin`. Use a
stronger secret in any shared or deployed environment.

The editor uses B03/GF canonical SVG coordinates (x right, y down). Every source
corridor point, including endpoints, can be moved. Graph nodes can also be
moved or deleted; incident edge endpoints follow node moves, and deleted nodes
remove their incident edges.

`Save preview draft` stores a reversible draft under the ignored
`artifacts/navigation-editor/` directory. `Run in admin` reconstructs and
simulates selected room-to-room routes. `Build source candidate` immediately
reconstructs and writes the edited graph to
`data/buildings/B03/GF.graph.json`, which the wayfinding app imports at runtime.
Node moves and deletions are applied to that graph too. Geometry and
connectivity findings are informational and do not block the save. Diagnostic
artifacts are updated and a recoverable backup is created. Test the saved graph
in the app.

New source connections still require existing anchors, cited evidence and a
justification. An interrupted multi-file save leaves `recovery.json` and its
backup in place and blocks later worker operations until an operator restores
the files listed in that journal.

No separately verified building-envelope polygon exists in the current GF
geometry contract. The editor reports source wall distance and distance to the
walkable-domain boundary, and reports building clearance as unavailable rather
than treating map extent as a building facade. Clearance settings use drawing
units; they are not surveyed or accessibility criteria.

Validation:

```sh
npm run validate:data
npm run test:data
npm run typecheck
npx vitest run tests/unit/navigation-editor.test.ts
python tests/qa/admin_editor_test.py
npm run build
```
