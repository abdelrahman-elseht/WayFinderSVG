import { defineConfig } from '@playwright/test';
const artifactDirectory = process.env.QA_ARTIFACT_DIR || 'artifacts/qa';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: [['list'], ['json', {outputFile:`${artifactDirectory}/browser-results.json`}]],
  outputDir: `${artifactDirectory}/browser-tests`,
  use: { baseURL: process.env.QA_BASE_URL || 'http://localhost:3000', browserName:'chromium', channel:process.env.QA_BROWSER_CHANNEL || undefined, viewport:{width:1440,height:1000}, reducedMotion:'reduce', screenshot:'only-on-failure', trace:'retain-on-failure', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']} },
});
