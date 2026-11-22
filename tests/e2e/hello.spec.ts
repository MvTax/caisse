import { expect, test } from '@playwright/test';

test('la page d’accueil MA+ s’affiche', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MA+ Commander' })).toBeVisible();
  await expect(page.getByTestId('serving-mode')).toHaveAttribute('data-mode', 'dev');
});
