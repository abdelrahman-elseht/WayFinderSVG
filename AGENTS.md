# Local agent guide

This file is the repository-local contract. Keep it short. Start with [README.md](README.md), then open only the owning document for the task. For floor expansion or routing work, use [memory.md](memory.md) and then the targeted runbook [docs/FLOOR_ONBOARDING.md](docs/FLOOR_ONBOARDING.md). For parallel Floor 01/02 spec planning, use [the handoff](docs/handoffs/B03_FLOOR_01_02_SPEC_PLANS_HANDOFF.md).

If `.codegraph/` contains a usable index, query it before text search; otherwise use `rg`. Complete the requested scope rather than silently replacing it with a prototype or first slice.

## Work in the pipeline order

Source PDFs and audit -> aligned vectors -> semantic rooms/content -> validated graph -> shared services -> web UI -> integration -> independent QA -> build/deployment docs. Generated files under `maps/`, `data/`, `content/`, and `apps/web/public/maps/` are outputs; change their source/configuration and regenerate them.

## Open documents by trigger

- Source files, coordinates, transforms, or provenance: [docs/SOURCE_AUDIT.md](docs/SOURCE_AUDIT.md).
- JSON shapes, IDs, evidence states, or routing contracts: [docs/DATA_CONTRACTS.md](docs/DATA_CONTRACTS.md).
- Room contours, doors, endpoint qualifications, or semantic review: [docs/SEMANTIC_REVIEW.md](docs/SEMANTIC_REVIEW.md).
- QA, known limitations, or release checks: [docs/QA_REPORT.md](docs/QA_REPORT.md), [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Existing decisions and accepted work: [docs/DECISIONS.md](docs/DECISIONS.md), [docs/EXECUTION_LOG.md](docs/EXECUTION_LOG.md).

## Hard gates

- Preserve original evidence and provenance. Never invent room geometry, kiosk coordinates, metre scale, photographs, architectural dimensions, or accessibility claims.
- A drawing-based route is a corridor/approach graph. Every segment must stay in the graph's navigable-area union and have no contact with supplied wall segments; do not route through room solids, voids, the building envelope, or a straight room-centroid shortcut.
- Use source-derived door or approach nodes. Keep candidate/unknown status and bilingual partial-route notes; directory visibility does not grant physical access.
- Keep `en`/`ar`, RTL, keyboard, reduced-motion, and accessible-only behavior intact. Unknown accessibility is excluded when the accessible filter is requested.
- Treat `GF` as the only currently registered runtime floor. Verified source packs for `01` and `02` exist, but adding them to the app requires complete semantic bundles, registry imports, floor-scoped graph evidence, and tests before enabling floor options or cross-floor journeys.

## Validation

Run the smallest relevant check after each change. Before reporting a data or integration change, run `npm run validate:data`, `npm run test:data`, `npm run typecheck`, and the relevant Vitest/browser checks. Use `npm run pipeline` only when regenerating source-derived outputs. Record unresolved evidence in the owning review/known-issues document.
