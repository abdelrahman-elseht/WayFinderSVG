import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('configured First Floor directory and prepared map asset', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('combobox', 'Floor')).toHaveValue('01');
  await screen.getByRole('button', 'Browse', { exact: true }).tap();
  await expect(screen.getByRole('searchbox')).toBeVisible();
  await screen.getByRole('searchbox').fill('F-31');
  await expect(screen.getByRole('button', 'LIBRARY F-31 · Other', { exact: true })).toBeVisible();
  await screen.getByRole('button', 'LIBRARY F-31 · Other', { exact: true }).tap();
  await expect(screen.getByRole('heading', 'LIBRARY', { exact: true })).toBeVisible();
  const response = await fetch(new URL('/maps/B03/01/master.svg', app.baseUrl));
  expect(response.status).toBe(200);
  expect(await response.text()).toMatch(/viewBox="580(?:\.0)? 315(?:\.0)? 2910(?:\.0)? 1585(?:\.0)?"/);
});

test('agent explores bilingual source-marker selection', { skip: !process.env.OPENAI_API_KEY && 'Tooling blocker: no configured provider key or saved e2e subscription login; deterministic coverage runs separately.' }, async ({ app, agent, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('combobox', 'Floor')).toHaveValue('01');
  await agent.act('Find and select the LIBRARY destination using code F-31.');
  await expect(screen.getByRole('heading', 'LIBRARY')).toBeVisible();
  await agent.act('Switch the interface to Arabic.');
  await expect(screen.getByRole('heading', 'المكتبة')).toBeVisible();
});
