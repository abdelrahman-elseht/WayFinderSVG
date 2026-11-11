import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: {
    ...Object.fromEntries(['map-engine','routing','search','i18n','audio','ui'].map(name => [`@wayfinding/${name}`, path.resolve(`packages/${name}/src`)])),
    '@data': path.resolve('data'),
    '@content': path.resolve('content'),
  } },
  test: { include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'], environment: 'node' }
});
