import { expect, test } from '@playwright/test';

const credentials = { username: process.env.WAYFINDING_ADMIN_USER || 'local-admin', password: process.env.WAYFINDING_ADMIN_PASSWORD || 'local-editor-test-password-123' };
test.use({ httpCredentials: credentials });

test('admin editor requires configured credentials and serves the source drawing', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Navigation layers' })).toBeVisible();
  await expect(page.getByLabel('Navigation graph canvas')).toBeVisible();
  await expect(page.getByText(/Source configuration and architectural evidence|Ready\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'V2 · DIAGNOSTIC ONLY' })).toHaveCount(0);
  await page.close();
});

test('select and group-nudge source controls with shared geometry delta and undo', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials, viewport: { width: 1550, height: 1000 } });
  await page.goto('/admin');
  const first = page.locator('[data-testid="control-spine:0/1"]');
  const second = page.locator('[data-testid="control-spine:0/2"]');
  await expect(first).toBeVisible();
  await first.click({ modifiers: ['Shift'] });
  await second.click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 source controls selected')).toBeVisible();
  const before = await Promise.all([first.getAttribute('cx'), second.getAttribute('cx')]);
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  const after = await Promise.all([first.getAttribute('cx'), second.getAttribute('cx')]);
  expect(Number(after[0]) - Number(before[0])).toBe(1);
  expect(Number(after[1]) - Number(before[1])).toBe(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => Number(await first.getAttribute('cx'))).toBe(Number(before[0]));
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.getByLabel('Navigation graph canvas').press('Control+a');
  await expect(page.getByText(/\d+ source controls selected/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Build source candidate' })).toBeEnabled();
  await page.close();
});

test('dragging a source control with mouse commits its drawing-coordinate movement', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials, viewport: { width: 1550, height: 1000 } });
  await page.goto('/admin');
  const control = page.locator('[data-testid="control-spine:0/1"]');
  await expect(control).toBeVisible();
  const before = await control.getAttribute('cx');
  const box = await control.boundingBox();
  if (!box) throw new Error('Control handle has no hit target');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await control.getAttribute('cx'))).toBeGreaterThan(Number(before) + 20);
  await expect(page.getByText(/Unsaved preview edits/)).toBeVisible();
  await page.close();
});

test('route comparison runs an admin simulation between the selected rooms', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials, viewport: { width: 1550, height: 1000 } });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Run selected room route in admin' }).click();
  const results = page.locator('.route-results');
  await expect(page.getByRole('status').last()).toContainText(/candidate|failure|route/i, { timeout: 60000 });
  await expect(results).toContainText('original', { timeout: 60000 });
  await expect(results).toContainText('edited');
  await expect(results).toContainText('du');
  await expect(page.locator('.editor-report > summary')).toContainText('Admin simulation only');
  await page.close();
});

test('any graph node can be dragged and deleted in the preview layer', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials, viewport: { width: 1550, height: 1000 } });
  await page.goto('/admin');
  const node = page.locator('[data-testid^="graph-node-"]').first();
  const nodeTestId = await node.getAttribute('data-testid');
  await expect(node).toBeVisible();
  const before = Number(await node.getAttribute('cx'));
  const box = await node.boundingBox();
  if (!box) throw new Error('Graph node has no hit target');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 12, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await node.getAttribute('cx'))).toBeGreaterThan(before + 15);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator(`[data-testid="${nodeTestId}"]`)).toHaveCount(0);
  await page.close();
});

test('corridor source edits remain drafts until build is explicitly requested', async ({ browser }) => {
  const page = await browser.newPage({ httpCredentials: credentials, viewport: { width: 1550, height: 1000 } });
  await page.goto('/admin');
  await page.locator('[data-testid="control-spine:0/1"]').click();
  const x = page.getByRole('spinbutton', { name: 'Node X' });
  await expect(x).toBeVisible();
  await x.fill('1411');
  await expect(page.getByRole('button', { name: 'Build source candidate' })).toBeEnabled();
  await expect(page.getByText(/Unsaved preview edits/)).toBeVisible();
  await page.close();
});
