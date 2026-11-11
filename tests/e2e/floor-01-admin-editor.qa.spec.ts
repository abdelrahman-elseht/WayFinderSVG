import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const artifactDirectory = process.env.QA_ARTIFACT_DIR || 'artifacts/qa/floor-01/admin-editor';
const credentials = {
  username: process.env.WAYFINDING_ADMIN_USER || 'local-admin',
  password: process.env.WAYFINDING_ADMIN_PASSWORD || 'local-editor-test-password-123',
};

mkdirSync(artifactDirectory, { recursive: true });
test.use({ httpCredentials: credentials });

const gfSourceFiles = [
  'scripts/semantic-map/navigation-config.json',
  'scripts/semantic-map/navigation-v2-config.json',
  'data/buildings/B03/GF.json',
  'data/buildings/B03/GF.graph.json',
  'scripts/semantic-map/admin_editor.py',
];

function hashGfSourceFiles() {
  return Object.fromEntries(gfSourceFiles.map(path => [
    path,
    createHash('sha256').update(readFileSync(path)).digest('hex'),
  ]));
}

function hashValue(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type Session = {
  config: unknown;
  graph: unknown;
  runtimeGraph: unknown;
  floor: { floor: { id: string; name: { en: string }; mapAsset: string }; rooms: unknown[] };
  spines: Array<{ id: string; coordinates: number[][] }>;
};

type GraphNode = { id: string; roomId?: string; point: number[] };

async function readSession(page: Page, floorId: 'GF' | '01'): Promise<Session> {
  return page.evaluate(async id => {
    const response = await fetch(`/api/admin/navigation?floorId=${id}`);
    if (!response.ok) throw new Error(`Could not load ${id} admin session (${response.status})`);
    return response.json();
  }, floorId);
}

async function selectSourceControl(page: Page, id: string) {
  const control = page.locator(`[data-testid="control-${id}"]`);
  if (await control.count()) {
    await control.click();
  } else {
    const cluster = page.locator('g[role="button"]').filter({
      has: page.locator('title', { hasText: `source: ${id}` }),
    });
    await expect(cluster).toHaveCount(1);
    const title = await cluster.locator('title').textContent() || '';
    const members = title.split(' · ').map(member => member.replace(/^(source|graph): /, ''));
    expect(members).toContain(id);
    const selected = page.locator('.editor-right code');
    for (let attempt = 0; attempt < members.length; attempt++) {
      await cluster.press('Enter');
      if (await selected.textContent() === id) break;
    }
  }
  await expect(page.locator('.editor-right code')).toHaveText(id);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${artifactDirectory}/${name}.png`, fullPage: true });
}

test('Floor 01 admin source editing stays isolated and GF remains unchanged', async ({ page, browser }) => {
  test.setTimeout(420_000);
  const gfSourceHashesBefore = hashGfSourceFiles();
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const networkResponses: Array<{ method: string; pathname: string; status: number }> = [];
  const postActions: Array<{ floorId?: string; action?: string }> = [];
  const apiRequests: Array<{ method: string; pathname: string; floorId?: string; action?: string }> = [];
  const unexpectedApiCalls: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    networkResponses.push({
      method: response.request().method(),
      pathname: new URL(response.url()).pathname,
      status: response.status(),
    });
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      failedRequests.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      let payload: { floorId?: string; action?: string } = {};
      try {
        payload = request.postDataJSON() || {};
      } catch {}
      const floorId = url.searchParams.get('floorId') || payload.floorId;
      apiRequests.push({ method: request.method(), pathname: url.pathname, floorId: floorId || undefined, action: payload.action });
      if (url.pathname !== '/api/admin/navigation' || !['GF', '01'].includes(floorId || '')) {
        unexpectedApiCalls.push(`${request.method()} ${url.pathname}${floorId ? ` floorId=${floorId}` : ''}`);
      }
      if (request.method() === 'POST' && url.pathname === '/api/admin/navigation') postActions.push(payload);
    }
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Navigation layers' })).toBeVisible();
  await expect(page.getByLabel('Navigation graph canvas')).toBeVisible();
  const floorPicker = page.getByRole('combobox', { name: 'Floor', exact: true });
  await expect(floorPicker).toHaveValue('GF');
  await expect(page.locator('.editor-brand')).toHaveText('B03 / GF');
  await expect(page.locator('.canvas-heading')).toContainText('Graph current');
  const gfBefore = await readSession(page, 'GF');
  const gfSessionHashesBefore = {
    config: hashValue(gfBefore.config),
    runtimeGraph: hashValue(gfBefore.runtimeGraph),
  };
  await selectSourceControl(page, 'spine:0/1');
  await expect(page.getByRole('spinbutton', { name: 'Node X' })).toBeEnabled();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await screenshot(page, 'desktop-gf-initial');

  await floorPicker.selectOption('01');
  await expect(page.locator('.editor-brand')).toHaveText('B03 / 01');
  await expect(page.locator('.canvas-heading')).toContainText('Graph current');
  await expect(page.getByRole('status')).toContainText(/Floor 01 source spine editor ready/i);
  const floor01 = await readSession(page, '01');
  expect(floor01.floor.floor.id).toBe('01');
  expect(floor01.floor.floor.name.en).toBe('First Floor');
  expect(floor01.floor.floor.mapAsset).toBe('/maps/B03/01/master.svg');
  expect(floor01.floor.rooms.length).toBeGreaterThan(0);
  expect(floor01.spines.length).toBeGreaterThan(0);
  await expect(page.locator(`image[href="${floor01.floor.floor.mapAsset}"]`)).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Room', exact: true }).locator('option')).toHaveCount(floor01.floor.rooms.length + 1);
  await expect(page.locator('[data-spine]')).toHaveCount(
    floor01.spines.reduce((count, spine) => count + spine.coordinates.length - 1, 0),
  );
  await expect(page.getByLabel('Corridor centerlines lock')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Build source candidate', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save isolated draft only', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/room approaches and derived graph are read-only/i);
  await screenshot(page, 'desktop-floor-01-loaded');

  const sourceSpine = floor01.spines.find(spine => spine.id === 'spine:0');
  if (!sourceSpine) throw new Error('First Floor source spine 0 is missing');
  const originalX = sourceSpine.coordinates[1][0];
  await selectSourceControl(page, 'spine:0/1');
  const nodeX = page.getByRole('spinbutton', { name: 'Node X' });
  await expect(nodeX).toBeVisible();
  await nodeX.fill(String(originalX + 1));
  await expect(nodeX).toHaveValue(String(originalX + 1));
  await expect(page.locator('.canvas-heading')).toContainText('Unsaved preview edits');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.canvas-heading')).toContainText('Source unchanged');
  await selectSourceControl(page, 'spine:0/1');
  await expect(page.getByRole('spinbutton', { name: 'Node X' })).toHaveValue(String(originalX));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.canvas-heading')).toContainText('Unsaved preview edits');
  await selectSourceControl(page, 'spine:0/1');
  await expect(page.getByRole('spinbutton', { name: 'Node X' })).toHaveValue(String(originalX + 1));

  const graphNodes = (floor01.graph as { nodes: GraphNode[] }).nodes;
  let approach: GraphNode | undefined;
  for (const node of graphNodes.filter(candidate => candidate.roomId)) {
    if (await page.locator(`[data-testid="graph-node-${node.id}"]`).count()) {
      approach = node;
      break;
    }
  }
  if (!approach) throw new Error('No derived room approach exists on Floor 01');
  const graphNode = page.locator(`[data-testid="graph-node-${approach.id}"]`);
  await expect(graphNode).toBeVisible();
  const graphNodeId = await graphNode.getAttribute('data-testid');
  const nodeBefore = {
    x: await graphNode.getAttribute('cx'),
    y: await graphNode.getAttribute('cy'),
  };
  const graphBox = await graphNode.boundingBox();
  if (!graphBox) throw new Error('Derived graph approach has no visible hit target');
  await page.mouse.move(graphBox.x + graphBox.width / 2, graphBox.y + graphBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(graphBox.x + graphBox.width / 2 + 35, graphBox.y + graphBox.height / 2 + 12, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(`[data-testid="${graphNodeId}"]`)).toHaveAttribute('cx', nodeBefore.x || '');
  await expect(page.locator(`[data-testid="${graphNodeId}"]`)).toHaveAttribute('cy', nodeBefore.y || '');
  await expect(page.locator('.editor-right')).toContainText('read-only derived node');
  await expect(page.getByRole('spinbutton', { name: 'Graph node X' })).toHaveCount(0);
  await expect(page.locator('.canvas-heading')).toContainText('Unsaved preview edits');
  await screenshot(page, 'desktop-floor-01-read-only-approaches');

  await page.getByRole('button', { name: 'Run in admin', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/Admin preview generated|safety check/i, { timeout: 180_000 });
  await expect(page.locator('.editor-report')).toContainText(/Admin simulation only|Reconstruction diagnostics/i);
  await page.getByRole('button', { name: 'Save isolated draft', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText(/Preview draft .* saved/i, { timeout: 150_000 });
  await expect(page.getByRole('status')).toContainText(/does not change navigation/i);
  await screenshot(page, 'desktop-floor-01-preview-draft');

  const gfAfter = await readSession(page, 'GF');
  expect(gfAfter.config).toEqual(gfBefore.config);
  expect(gfAfter.graph).toEqual(gfBefore.graph);
  expect(gfAfter.runtimeGraph).toEqual(gfBefore.runtimeGraph);
  expect(gfAfter.spines).toEqual(gfBefore.spines);
  const gfSessionHashesAfter = {
    config: hashValue(gfAfter.config),
    runtimeGraph: hashValue(gfAfter.runtimeGraph),
  };
  expect(gfSessionHashesAfter).toEqual(gfSessionHashesBefore);
  const gfSourceHashesAfter = hashGfSourceFiles();
  expect(gfSourceHashesAfter).toEqual(gfSourceHashesBefore);
  await floorPicker.selectOption('GF');
  await expect(page.locator('.editor-brand')).toHaveText('B03 / GF');
  await expect(floorPicker).toHaveValue('GF');
  await expect(page.locator('.canvas-heading')).toContainText('Graph current');
  await expect(page.getByRole('status')).toContainText(/Ready\./);
  await screenshot(page, 'desktop-gf-restored');

  await page.setViewportSize({ width: 390, height: 844 });
  await floorPicker.selectOption('01');
  await expect(page.getByLabel('Navigation graph canvas')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/room approaches and derived graph are read-only/i);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => page.locator('.editor-toolbar').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const mobilePanelLayout = await page.evaluate(() => {
    const left = document.querySelector('.editor-left')!.getBoundingClientRect();
    const right = document.querySelector('.editor-right')!.getBoundingClientRect();
    return { leftWidth: left.width, rightWidth: right.width, stacked: right.top > left.top };
  });
  expect(mobilePanelLayout.leftWidth).toBeGreaterThan(350);
  expect(mobilePanelLayout.rightWidth).toBeGreaterThan(350);
  expect(mobilePanelLayout.stacked).toBe(true);
  await screenshot(page, 'mobile-floor-01-loaded');
  await floorPicker.selectOption('GF');
  await expect(page.locator('.editor-brand')).toHaveText('B03 / GF');
  await expect(page.locator('.canvas-heading')).toContainText('Graph current');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, 'mobile-gf-restored');

  expect(postActions.length).toBeGreaterThanOrEqual(2);
  expect(postActions.every(({ floorId, action }) => floorId === '01' && ['preview', 'draft'].includes(action || ''))).toBe(true);
  expect(apiRequests.every(({ pathname, floorId }) => pathname === '/api/admin/navigation' && ['GF', '01'].includes(floorId || ''))).toBe(true);
  expect(unexpectedApiCalls).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  writeFileSync(`${artifactDirectory}/browser-observations.json`, JSON.stringify({
    viewportCoverage: ['1440x1000 desktop', '390x844 mobile'],
    browser: `${browser.browserType().name()} ${browser.version()}`,
    floor01: {
      roomCount: floor01.floor.rooms.length,
      spineCount: floor01.spines.length,
      graphNodeCount: Array.isArray((floor01.graph as { nodes?: unknown[] }).nodes)
        ? (floor01.graph as { nodes: unknown[] }).nodes.length
        : null,
      sourceControlEditUndoRedo: 'passed; preview edit retained for isolated preview and draft',
      protectedRoomApproachId: approach.id,
      derivedApproachDrag: 'coordinates unchanged',
    },
    apiRequests,
    networkResponses,
    unexpectedApiCalls,
    postActions,
    gfSourceHashesBefore,
    gfSourceHashesAfter,
    gfSessionHashesBefore,
    gfSessionHashesAfter,
    gfConfigGraphRuntimeGraphAndSpinesUnchanged: true,
    pageErrors,
    failedRequests,
  }, null, 2));
});
