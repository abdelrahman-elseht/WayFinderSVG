import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Run against each configured floor with QA_FLOOR_ID and QA_CORNER_STAGE.
const floor = process.env.QA_FLOOR_ID ?? 'GF';
const stage = process.env.QA_CORNER_STAGE ?? 'after';
const pairs = floor === 'GF' ? [['G-01', 'G-50'], ['G-01', 'G-05']] : [['F-01', 'F-50'], ['F-01', 'F-34']];
test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
for (const [from, to] of pairs) {
  test(`fixed-view rounded route ${floor} ${from} to ${to}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: 'Floor', exact: true })).toHaveValue(floor);
    await expect(page.locator('.map-label')).toHaveCount(54);
    await page.getByTestId('start-select').selectOption(`B03-${floor}-${from}`);
    await page.getByTestId('destination-select').selectOption(`B03-${floor}-${to}`);
    await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
    await expect(page.locator('.playback-progress')).toHaveAttribute('value', '1');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    // Match camera, selection and viewport; reduced motion disables camera follow.
    await page.waitForTimeout(500);
    const directory = `artifacts/corner-rounding/${stage}`;
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/${floor}-${from}-${to}.png` });
    expect(errors).toEqual([]);
  });
}
