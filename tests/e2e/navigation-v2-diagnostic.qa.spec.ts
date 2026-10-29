import { expect, test } from '@playwright/test';

test('V2 diagnostic is visibly isolated and reports disconnected G-39/G-40 approaches', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('navigation-v2-diagnostic-banner')).toContainText('G-39 and G-40 have no incident edges');

  const start = page.getByTestId('start-select');
  const destination = page.getByTestId('destination-select');
  const status = page.getByTestId('route-status');

  await start.selectOption('B03-GF-G-39');
  await destination.selectOption('B03-GF-G-40');
  await expect(status).toHaveClass(/unavailable/);
  await expect(status).toContainText('No confirmed open route connects these points');

  await start.selectOption('B03-GF-G-40');
  await destination.selectOption('B03-GF-G-39');
  await expect(status).toHaveClass(/unavailable/);
  await page.screenshot({ path: 'artifacts/navigation-v2/port-5250-e2e/g39-g40-unavailable.png', fullPage: true });

  await start.selectOption('');
  await destination.selectOption('B03-GF-G-50');
  await expect(status).toHaveClass(/\bok\b/);
});
