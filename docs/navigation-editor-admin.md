# Navigation editor access and safety

`/admin` uses HTTP Basic authorization with `WAYFINDING_ADMIN_USER` and
`WAYFINDING_ADMIN_PASSWORD`. There is no project identity provider yet. Both
values must be set by the operator; passwords shorter than 5 characters fail
closed. Set them in the deployment secret store or untracked
`apps/web/.env.local` before starting/restarting the Next.js server. Never
commit credentials.
Five-character passwords are weak; use this minimum only on a trusted local network.

The editor is grounded in B03/GF canonical SVG coordinates (x right, y down).
Source corridor controls edit the V2 spine configuration. Graph nodes can also
be moved or deleted in an admin-only simulation; their incident edge endpoints
follow node moves and deleted nodes remove incident edges from that simulation.
These node operations are saved with preview drafts, not written to source
configuration.

`Save preview draft` stores a reversible draft under the ignored
`artifacts/navigation-editor/` directory. `Run in admin` reconstructs and
simulates selected room-to-room routes without applying geometry validation.
This is deliberately not a production-safety claim and does not alter normal
wayfinding. `Build source candidate` applies the geometry and connectivity gates
before writing source spine changes and diagnostic reconstruction artifacts.
It creates a recoverable backup. Runtime wayfinding never imports the edited
diagnostic graph; promotion is out of scope.

Source endpoints remain fixed. Drawn source connections require existing
anchors, cited evidence and a justification. The build gates verify edge
geometry, room connectivity, G-35/G-01 and G-37/G-42; G-39/G-40 remain
edge-free. An interrupted multi-file save leaves `recovery.json` and the backup
in place and blocks later worker operations until an operator restores the
files listed in that journal.

No separately verified building-envelope polygon exists in the current GF
geometry contract. The editor reports true source wall distance and distance
to the walkable-domain boundary, and explicitly reports facade/building
clearance unavailable rather than mislabelling map extent as a building facade.
Minimum/preferred clearances are drawing-unit settings, not surveyed or
accessibility criteria.

Validation:

```sh
npm run validate:data
npm run test:data
npm run typecheck
npx vitest run tests/unit/navigation-editor.test.ts
python tests/qa/admin_editor_test.py
npm run build
```
