# Agent Operating Contract

## Read First

Before changing code or data, read `README.md`, then the relevant document:

- Product scope, commands, and ownership: `docs/PROJECT_SPEC.md` and `README.md`
- Source evidence and provenance: `docs/SOURCE_AUDIT.md` and `docs/SEMANTIC_REVIEW.md`
- Data shapes and validation: `docs/DATA_CONTRACTS.md`
- Accepted work, dependencies, and remaining work: `docs/EXECUTION_LOG.md`
- QA, known limitations, and deployment: `docs/QA_REPORT.md`, `docs/KNOWN_ISSUES.md`, and `docs/DEPLOYMENT.md`

Keep documentation routed by purpose. Update the owning document when behavior changes; do not create a parallel plan or duplicate contract in an arbitrary markdown file. Use `docs/handoffs/` only for bounded specialist evidence and handoffs.

## Implementation Order

Preserve the established pipeline: source PDFs and audit -> aligned vectors -> semantic rooms/content -> validated navigation graph -> shared services -> web UI -> integration -> independent QA -> build/deployment docs. Treat existing generated map/data files as outputs of that pipeline. Run the smallest relevant validation after each change, then the full checks before reporting completion.

## Invariants and Gates

- Source evidence remains traceable through provenance; originals are never rewritten.
- Never invent kiosk coordinates, metre scale, room geometry, photographs, architectural dimensions, or accessibility claims.
- Drawing-based routing may use validated candidate geometry, but must remain explicitly drawing-based and fail closed on invalid or unsupported paths.
- Preserve bilingual (`en`/`ar`) behavior, RTL support, accessibility, and partial-route disclosures.
- Respect package ownership and frozen data contracts; change the contract deliberately and update its consumers/tests together.
- Verify state-changing work with tests, validation output, or a production browser check before claiming success.

## Agent Discipline

Prefer deterministic commands and repository evidence over conversational assumptions. Keep tasks bounded, reversible, and auditable; stop at an ambiguity that changes product truth instead of guessing. Treat these rules as de-humanization gates: they remove ad-hoc improvisation and model-specific shortcuts from execution. This file is the shared instruction source for Codex and other harnesses; keep it concise and suitable for automated auditing and future `backpass` review. Do not weaken a gate to make a test or task pass.

