import { test, expect } from '@playwright/test';

test('floor picker navigates between registered Ground and First Floor bundles', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByRole('combobox', { name: 'Floor', exact: true });
  await expect(picker).toHaveValue(/^(GF|01)$/);
  await expect(picker.locator('option')).toHaveCount(2);
  const initial = await picker.inputValue();
  const other = initial === 'GF' ? '01' : 'GF';
  await picker.selectOption(other);
  await expect(page).toHaveURL(new RegExp(`\\?floor=${other}$`));
  await expect(picker).toHaveValue(other);
  await expect(page.getByTestId('start-select').locator('option').filter({ hasText: other === '01' ? 'F-01' : 'G-01' })).toHaveCount(1);
  await picker.selectOption(initial);
  await expect(page).toHaveURL(new RegExp(`\\?floor=${initial}$`));
  await expect(picker).toHaveValue(initial);
});
