import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const artifacts = 'artifacts/qa/floor-01';
mkdirSync(artifacts, { recursive: true });
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Floor', exact: true })).toHaveValue('01');
  await expect(page.locator('.map-label')).toHaveCount(54);
  await page.evaluate(() => document.fonts.ready);
}
async function browse(page: Page) {
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(54);
}
async function journey(page: Page, start = 'F-01', end = 'F-50') {
  await page.getByTestId('start-select').selectOption(`B03-01-${start}`);
  await page.getByTestId('destination-select').selectOption(`B03-01-${end}`);
  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

test('configured floor, prepared vector asset, private sources and clean application requests', async ({ page, request }) => {
  const errors: string[] = [], failures: string[] = [], requested: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => requested.push(req.url()));
  page.on('response', res => { if (res.status() >= 400 && !res.url().endsWith('/favicon.ico')) failures.push(`${res.status()} ${res.url()}`); });
  await ready(page);
  await expect(page.getByTestId('start-select')).toHaveValue('');
  await expect(page.getByTestId('kiosk-status')).toContainText('Choose a starting point');
  await expect(page.getByTestId('start-select').locator('option')).toHaveCount(55);
  const response = await request.get('/maps/B03/01/master.svg');
  expect(response.status()).toBe(200);
  const svg = await response.text();
  expect(svg).toMatch(/viewBox="580(?:\.0)? 315(?:\.0)? 2910(?:\.0)? 1585(?:\.0)?"/);
  expect((svg.match(/<path\b/g) || []).length).toBe(3966);
  expect(svg).not.toMatch(/<image\b/);
  expect((await request.get('/maps/B03/01/source/0001.json')).status()).toBe(404);
  expect(requested.filter(url => /\.pdf|\/source\//.test(url))).toEqual([]);
  expect(errors).toEqual([]); expect(failures).toEqual([]);
  writeFileSync(`${artifacts}/application-requests.json`, JSON.stringify({ errors, failures, requested, knownBrowserRequest: 'favicon.ico is absent (404), inherited from the baseline app' }, null, 2));
  await shot(page, 'default-en');
});

test('all mapped entries, code and Arabic search, keyboard and candidate source footprint', async ({ page }) => {
  await ready(page); await browse(page);
  await page.getByRole('searchbox').fill('F-31');
  const library = page.getByRole('button', { name: 'LIBRARY F-31 · Other', exact: true });
  await expect(library).toBeVisible();
  await library.focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('room-details').getByRole('heading')).toHaveText('LIBRARY');
  await shot(page, 'selection-en');
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('searchbox').fill('الْمَكْتَبَة');
  await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(1);
  await expect(page.getByTestId('room-details').getByRole('heading')).toHaveText('المكتبة');
  await shot(page, 'selection-ar');
  await page.getByTestId('language-toggle').click();
  await page.getByRole('searchbox').fill('F-11');
  await page.getByTestId('room-directory').locator('[data-room-id="B03-01-F-11"]').click();
  await expect(page.getByTestId('room-details')).toContainText('Room outline not yet verified');
  await expect(page.getByTestId('room-details').locator('.room-preview svg polygon')).toHaveCount(1);
  await expect(page.getByTestId('room-details').locator('.room-preview svg circle')).toHaveCount(0);
  for (const code of ['F-10', 'F-18', 'F-28', 'F-29', 'F-45']) {
    await page.getByRole('searchbox').fill(code);
    await expect(page.getByTestId('room-directory').locator(`[data-room-id="B03-01-${code}"]`)).toHaveCount(0);
  }
});

test('cross-seam route and reverse preserve qualifications, RTL and no metric claims', async ({ page }) => {
  await ready(page); await journey(page);
  await expect(page.getByTestId('route-status')).toContainText('Route on floor plan');
  await expect(page.getByTestId('route-status')).toContainText('Physical access and distance scale are unverified');
  await expect(page.getByTestId('arrival-note')).toContainText('mapped corridor approach');
  await expect(page.getByTestId('route-status')).not.toContainText('You have arrived at your destination.');
  await shot(page, 'route-en');
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByTestId('arrival-note')).toContainText('نقطة الاقتراب');
  await shot(page, 'route-ar');
  await page.getByTestId('language-toggle').click();
  await expect(page.getByTestId('destination-select')).toHaveValue('B03-01-F-50');
  await journey(page, 'F-50', 'F-01');
  await expect(page.getByTestId('route-status')).toContainText('Starting point: Route ends at the mapped corridor approach');
});

test('repaired First Floor endpoints route through the shared corridor graph', async ({ page }) => {
  await ready(page);
  await journey(page, 'F-30', 'F-20');
  await expect(page.getByTestId('route-status')).toContainText('Route on floor plan');
  await shot(page, 'route-f30-to-f20');
  await journey(page, 'F-32', 'F-20');
  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  await shot(page, 'route-f32-to-f20');
  await journey(page, 'F-01', 'F-20');
  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  await shot(page, 'route-f01-to-f20');
});

test('hearing to intellectual difficulties uses the repaired southern corridor in both languages', async ({ page }) => {
  await ready(page);
  await journey(page, 'F-20', 'F-34');
  await expect(page.getByTestId('route-status').locator('progress')).toHaveAttribute('value', '1');
  await shot(page, 'route-hearing-to-intellectual-en');
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  await shot(page, 'route-hearing-to-intellectual-ar');
});

test('CAD raster covers the canonical viewBox without shifting its landmarks', async ({ page }) => {
  await page.route('**/maps/B03/01/master.svg', async route => {
    const response = await route.fetch();
    const svg = (await response.text()).replace('</svg>',
      '<rect x="580" y="315" width="12" height="12" fill="#ff00ff"/></svg>');
    await route.fulfill({ response, body: svg });
  });
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
      original.apply(this, args);
      const source = args[0];
      if (source instanceof HTMLImageElement && source.src.startsWith('blob:') && this.canvas.width === 4096) {
        // The top-left source landmark must occupy the top-left texture texel.
        // SVG xMidYMid meet previously inserted horizontal margins here.
        const pixel = Array.from(this.getImageData(2, 2, 1, 1).data);
        document.documentElement.dataset.cadCorner = pixel.join(',');
      }
    } as typeof original;
  });
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-cad-corner', '255,0,255,255');
});

test('missing start, unsupported destinations and unknown accessibility fail closed; reset restores no origin', async ({ page }) => {
  await ready(page);
  await page.getByTestId('destination-select').selectOption('B03-01-F-31');
  await expect(page.getByTestId('route-status')).toHaveClass(/\bunavailable\b/);
  await expect(page.getByTestId('route-status')).toContainText('starting point');
  await journey(page);
  await page.getByRole('checkbox').check();
  await expect(page.getByTestId('route-status')).toContainText('confirmed step-free accessibility');
  await expect(page.getByTestId('playback-toggle')).toHaveCount(0);
  await page.getByRole('checkbox').uncheck();
  for (const [code, note] of [['F-17', 'Navigation is unavailable'], ['F-49', 'do not establish its walking surface'], ['F-57', 'Navigation remains unavailable']]) {
    await page.getByTestId('destination-select').selectOption(`B03-01-${code}`);
    await expect(page.getByTestId('route-status')).toHaveClass(/\bunavailable\b/);
    await expect(page.getByTestId('room-details').locator('.room-navigation-note')).toContainText(note);
  }
  await shot(page, 'blocked-en');
  await page.getByTestId('reset-kiosk').click();
  await expect(page.getByTestId('start-select')).toHaveValue('');
  await expect(page.getByTestId('destination-select')).toHaveValue('');
  await expect(page.getByTestId('route-status')).toHaveCount(0);
  await expect(page.getByTestId('room-details')).toHaveCount(0);
});

test('shared suite approach has explicit bilingual changing-room qualification', async ({ page }) => {
  await ready(page); await journey(page, 'F-01', 'F-12');
  await expect(page.getByTestId('arrival-note')).toContainText('suite');
  await shot(page, 'qualified-en');
  await page.getByTestId('language-toggle').click();
  await expect(page.getByTestId('arrival-note')).toContainText('جناح');
  await page.getByTestId('language-toggle').click();
  await journey(page, 'F-12', 'F-50');
  await expect(page.getByTestId('route-status')).toContainText('Starting point:');
  await expect(page.getByTestId('route-status')).toContainText('suite');
});

test('route playback pause, stop and reset; reduced motion completes immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page); await journey(page);
  const progress = page.getByTestId('route-status').locator('progress');
  await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
  await page.getByTestId('playback-toggle').click();
  await expect(page.getByTestId('playback-toggle')).toHaveText('Start route playback');
  await page.getByTestId('playback-stop').click();
  await expect(progress).toHaveAttribute('value', '0');
  await page.getByTestId('playback-reset').click();
  await page.getByTestId('playback-toggle').click();
  await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload(); await journey(page);
  await expect(page.getByTestId('route-status').locator('progress')).toHaveAttribute('value', '1');
  await expect(page.getByTestId('playback-toggle')).toBeDisabled();
});

test('five English/Arabic directory, selection and route states pass axe WCAG AA', async ({ page }) => {
  test.setTimeout(180000);
  await ready(page); await browse(page);
  const results: { state: string; violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'] }[] = [];
  async function audit(state: string) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    results.push({ state, violations: result.violations });
    expect(result.violations, state).toEqual([]);
  }
  await audit('directory-en');
  await page.getByRole('searchbox').fill('F-31');
  await page.getByTestId('room-directory').locator('[data-room-id="B03-01-F-31"]').click();
  await audit('selection-en');
  await page.getByTestId('language-toggle').click(); await audit('selection-ar');
  await page.getByTestId('reset-kiosk').click(); await audit('directory-ar');
  await page.getByTestId('language-toggle').click();
  await page.getByRole('button', { name: 'Navigate', exact: true }).click();
  await journey(page); await audit('route-en');
  writeFileSync(`${artifacts}/axe.json`, JSON.stringify(results, null, 2));
});

test('Arabic mobile, forced colors and 200% text retain usable controls without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page); await browse(page); await page.getByTestId('language-toggle').click();
  await page.getByRole('searchbox').fill('المكتبة');
  await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(1);
  await shot(page, 'mobile-ar');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, 'text-200-ar');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.getByRole('searchbox')).toBeVisible();
  await shot(page, 'forced-colors-ar');
});

test('WebGL-disabled fallback retains all source-label destinations', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.map-fallback img')).toBeVisible();
  await browse(page);
  await page.getByRole('searchbox').fill('F-31');
  await page.getByTestId('room-directory').locator('[data-room-id="B03-01-F-31"]').click();
  await expect(page.getByTestId('room-details')).toContainText('LIBRARY');
  await shot(page, 'webgl-fallback');
});
