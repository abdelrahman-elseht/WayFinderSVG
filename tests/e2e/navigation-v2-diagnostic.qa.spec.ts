import { readFileSync, mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const artifactDirectory = 'artifacts/navigation-v2/port-5250-e2e';
const matrixPath = 'artifacts/navigation-v2/route-coverage-matrix.json';
const baselinePath = 'artifacts/navigation-v2/route-coverage-baseline.json';
type PairCase = {
  fromCode: string;
  toCode: string;
  destinationPartial: boolean;
  intentionalExclusion: boolean;
  legacy: { status: string; routeSafety: boolean };
  v2: { status: string; routeSafety: boolean };
};
type Matrix = { cases: PairCase[] };

function readMatrix(path: string): Matrix {
  return JSON.parse(readFileSync(path, 'utf8')) as Matrix;
}

async function choosePair(page: import('@playwright/test').Page, from: string, to: string) {
  await page.getByTestId('start-select').selectOption(`B03-GF-${from}`);
  await page.getByTestId('destination-select').selectOption(`B03-GF-${to}`);
  const status = page.getByTestId('route-status');
  await expect(status).toBeVisible();
  return status;
}

test('V2 diagnostic agrees with the full legacy-connected coverage matrix', async ({ page }) => {
  test.setTimeout(300000);
  mkdirSync(artifactDirectory, { recursive: true });
  const matrix = readMatrix(matrixPath);
  const baseline = readMatrix(baselinePath);
  expect(matrix.cases).toHaveLength(baseline.cases.length);
  await page.goto('/');
  await expect(page.getByTestId('navigation-v2-diagnostic-banner')).toContainText('G-39 and G-40 have no incident edges');

  const failures: string[] = [];
  for (const pair of matrix.cases) {
    const status = await choosePair(page, pair.fromCode, pair.toCode);
    const expected = pair.v2.status;
    const actual = await status.getAttribute('class');
    const shouldRoute = expected === 'ok' && pair.v2.routeSafety;
    if (shouldRoute && !actual?.includes(' ok')) failures.push(`${pair.fromCode}->${pair.toCode}: expected route, got ${actual}`);
    if (!shouldRoute && !actual?.includes('unavailable')) failures.push(`${pair.fromCode}->${pair.toCode}: expected unavailable, got ${actual}`);
    if (shouldRoute && pair.destinationPartial) {
      await expect(status).toContainText('Partial route');
      await expect(status).not.toContainText('You have arrived at your destination.');
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);

  const summary = {
    matrixPath,
    checkedPairs: matrix.cases.length,
    v2Available: matrix.cases.filter(pair => pair.v2.status === 'ok' && pair.v2.routeSafety).length,
    v2Unavailable: matrix.cases.filter(pair => pair.v2.status !== 'ok' || !pair.v2.routeSafety).length,
    intentionallyExcluded: matrix.cases.filter(pair => pair.intentionalExclusion).map(pair => `${pair.fromCode}->${pair.toCode}`),
    failures,
  };
  await page.screenshot({ path: `${artifactDirectory}/matrix-final-state.png`, fullPage: true });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${artifactDirectory}/matrix-browser-results.json`, `${JSON.stringify(summary, null, 2)}\n`);
});

test('restored destinations and Meeting Room approach render on the source plan', async ({ page }) => {
  await page.goto('/');
  const status = page.getByTestId('route-status');
  for (const code of ['G-05', 'G-42']) {
    await page.getByTestId('start-select').selectOption('B03-GF-G-01');
    await page.getByTestId('destination-select').selectOption(`B03-GF-${code}`);
    await expect(status).toHaveClass(/\bok\b/);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${artifactDirectory}/restored-g01-${code.toLowerCase()}.png`, fullPage: true });
  }

  await page.getByTestId('start-select').selectOption('B03-GF-G-44');
  await page.getByTestId('destination-select').selectOption('B03-GF-G-30');
  await expect(status).toHaveClass(/\bok\b/);
  await expect(status).toContainText('Route on floor plan');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${artifactDirectory}/g44-g30-after.png`, fullPage: true });
});

test('G-39/G-40 stay disconnected in both directions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('navigation-v2-diagnostic-banner')).toContainText('G-39 and G-40 have no incident edges');
  const status = page.getByTestId('route-status');
  for (const [from, to] of [['G-39', 'G-40'], ['G-40', 'G-39']]) {
    await page.getByTestId('start-select').selectOption(`B03-GF-${from}`);
    await page.getByTestId('destination-select').selectOption(`B03-GF-${to}`);
    await expect(status).toHaveClass(/unavailable/);
    await expect(status).toContainText('No confirmed open route connects these points');
  }
  await page.screenshot({ path: `${artifactDirectory}/g39-g40-unavailable.png`, fullPage: true });
});

test('Arabic RTL, keyboard route selection, reduced motion and accessible-only filtering remain usable', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('navigation-v2-diagnostic-banner')).toBeVisible();
  await page.screenshot({ path: `${artifactDirectory}/arabic-rtl-default.png`, fullPage: true });

  await page.getByTestId('start-select').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByTestId('destination-select').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('route-status')).toBeVisible();

  await page.getByTestId('start-select').selectOption('B03-GF-G-39');
  await page.getByTestId('destination-select').selectOption('B03-GF-G-40');
  const accessibleOnly = page.locator('.checkbox-label input[type="checkbox"]');
  await accessibleOnly.check();
  await expect(page.getByTestId('route-status')).toHaveClass(/unavailable/);
  await expect(page.getByTestId('route-status')).toContainText(/لا يوجد|No confirmed open route/i);
  await page.screenshot({ path: `${artifactDirectory}/arabic-accessible-only.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('route-status')).toBeVisible();
});
