import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { openai } from '@ai-sdk/openai';

export default {
  tests: 'tests/agentic/**/*.e2e.ts',
  targets: [{
    engine: web({ viewport: { width: 1440, height: 1000 } }),
    app: { url: process.env.QA_BASE_URL || 'http://localhost:3101' },
  }],
  ...(process.env.OPENAI_API_KEY ? { agents: { default: {
    model: openai(process.env.E2E_MODEL || 'gpt-6-luna-fast'),
    context: 'Bilingual drawing-based wayfinding. Access and accessibility are unknown. Phase 2 tests use a build configured for First Floor; interactive floor switching is not implemented yet. Room outlines may be unresolved; they remain selectable source markers. No physical kiosk or default start is configured on First Floor.',
  } } } : {}),
  workers: 1,
  trace: 'on',
} satisfies E2EConfig;
