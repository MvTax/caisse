import { expect, test, type Page } from '@playwright/test';
import { mockBridge } from './bridgeMock';

/** Accepte automatiquement les confirmations (« Supprimer ? »). */
test.beforeEach(async ({ page }) => {
  await mockBridge(page, () => 'ok');
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function addSmoothie(page: Page, name: string, size: string) {
  await page.getByRole('button', { name: /^Boissons/ }).click();
  await page.getByRole('button', { name: /^Smoothies/ }).click();
  await expect(page.getByRole('heading', { name: 'Choisir le smoothie' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('heading', { name: 'Choisir la taille' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${size}`) }).click();
}

test('commande complète multi-articles en espèces → liste → détail → terminer', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Commander', { exact: false }).first()).toBeVisible();

  // 1. Smoothie Tahiti Moyen (6,75 €)
  await addSmoothie(page, 'Tahiti', 'Moyen');
  await expect(page.getByRole('heading', { name: 'Panier' })).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('6,75 €');

  // 2. Gaufre Chocolat + Oreo + Chantilly, sur place (5,85 €)
  await page.getByRole('button', { name: /^＋ Ajouter/ }).click();
  await page.getByRole('button', { name: /^Crêpes & Gaufres/ }).click();
  await expect(page.getByRole('heading', { name: 'Crêpe ou Gaufre ?' })).toBeVisible();
  await page.getByRole('button', { name: /^Gaufre/ }).click();
  await expect(page.getByRole('heading', { name: 'Choisir le nappage' })).toBeVisible();
  await page.getByRole('button', { name: 'Chocolat' }).click();
  await page.getByRole('checkbox', { name: 'Oreo' }).click();
  await page.getByRole('checkbox', { name: 'Chantilly' }).click();
  await expect(page.locator('.live-total')).toContainText('5,85 €');
  await page.getByRole('button', { name: /^Continuer/ }).click();
  await expect(page.getByRole('heading', { name: 'Sur place ou à emporter ?' })).toBeVisible();
  await page.getByRole('button', { name: /Sur place/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('12,60 €');

  // 3. Glace Pot Grand (4,50 €)
  await page.getByRole('button', { name: /^＋ Ajouter/ }).click();
  await page.getByRole('button', { name: /^Glaces/ }).click();
  await expect(page.getByRole('heading', { name: 'Cornet ou Pot ?' })).toBeVisible();
  await page.getByRole('button', { name: /^Pot/ }).click();
  await expect(page.getByRole('button', { name: /^Petit/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Grand/ }).click();

  // 4. Bouteille d'eau (2,20 €) — le piège historique de l'apostrophe
  await page.getByRole('button', { name: /^＋ Ajouter/ }).click();
  await page.getByRole('button', { name: /^Boissons/ }).click();
  await page.getByRole('button', { name: /^Sodas & Eau/ }).click();
  await page.getByRole('button', { name: /^Bouteille d'eau/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('19,30 €');

  // Quantité : 2 bouteilles d'eau → 21,50 €
  await page
    .getByRole('group', { name: "Quantité de Bouteille d'eau" })
    .getByRole('button', { name: 'Ajouter un' })
    .click();
  await expect(page.getByTestId('cart-total')).toHaveText('21,50 €');

  // Encaissement : espèces 50 € → rendu 28,50 €
  await page.getByRole('button', { name: /^Valider · 5 articles/ }).click();
  await expect(page.getByTestId('checkout-total')).toHaveText('21,50 €');
  const validate = page.getByRole('button', { name: /Valider la commande/ });
  await expect(validate).toBeDisabled();
  await page.getByRole('radio', { name: /Espèces/ }).click();
  await page.getByLabel('Montant donné par le client').fill('10');
  await expect(page.getByTestId('change')).toContainText('Manque');
  await page.getByRole('button', { name: '50 €' }).click();
  await expect(page.getByTestId('change')).toContainText('À rendre');
  await expect(page.getByTestId('change')).toContainText('28,50 €');
  await expect(page.getByTestId('change')).toContainText('1 × 20 €');
  await expect(validate).toBeDisabled(); // pas encore de bipper
  await page.getByRole('radio', { name: 'Bipper 13' }).click();
  await expect(validate).toBeEnabled();
  await validate.click();

  await expect(
    page.getByRole('status').filter({ hasText: /Commande #1 .*Bipper 13/ }),
  ).toBeVisible();

  // Liste des commandes
  await page.getByRole('button', { name: /^Commandes/ }).click();
  const row = page.getByTestId('order-row').first();
  await expect(row).toContainText('Tahiti M');
  await expect(row).toContainText('21,50 €');
  await expect(row.getByLabel('Bipper 13')).toBeVisible();

  // Détail puis terminer
  await row.locator('.order-main').click();
  const sheet = page.getByRole('dialog', { name: 'Commande 1' });
  await expect(sheet).toContainText('Glace Pot Grand');
  await expect(sheet).toContainText("2× Bouteille d'eau");
  await expect(sheet).toContainText('28,50 €');
  await sheet.getByRole('button', { name: /Terminer/ }).click();
  await expect(page.getByRole('heading', { name: 'Terminées aujourd’hui (1)' })).toBeVisible();

  // Persistance après rechargement
  await page.reload();
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await expect(page.getByRole('heading', { name: 'Terminées aujourd’hui (1)' })).toBeVisible();

  // Statistiques
  await page.getByRole('button', { name: 'Commander' }).click();
  await page.getByRole('button', { name: 'Statistiques' }).click();
  await expect(page.getByTestId('kpi-revenue')).toHaveText('21,50 €');
});

test('sandwich : ajout direct sans étape ; panier conservé après rechargement', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Sandwich/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('6,95 €');
  await page.reload();
  await expect(page.getByRole('button', { name: /Panier en cours/ })).toContainText('6,95 €');
});

test('retour arrière : changer de format sans tout recommencer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Crêpes & Gaufres/ }).click();
  await page.getByRole('button', { name: /^Crêpe/ }).click();
  await page.getByRole('button', { name: /Retour/ }).click();
  await expect(page.getByRole('heading', { name: 'Crêpe ou Gaufre ?' })).toBeVisible();
  await page.getByRole('button', { name: /^Gaufre/ }).click();
  await page.getByRole('button', { name: 'Sucre' }).click();
  await page.getByRole('button', { name: /^Sans supplément/ }).click();
  await page.getByRole('button', { name: /À emporter/ }).click();
  await expect(page.locator('.cart-line')).toContainText('Gaufre Sucre');
  await expect(page.locator('.cart-line')).toContainText('À emporter');
  await expect(page.getByTestId('cart-total')).toHaveText('3,95 €');
});

test('grille des bippers : bipper remis grisé, avertissement non bloquant', async ({ page }) => {
  await page.goto('/');
  for (const round of [1, 2]) {
    await page.getByRole('button', { name: /^Sandwich/ }).click();
    await page.getByRole('button', { name: /^Valider · 1 article/ }).click();
    await page.getByRole('radio', { name: /Carte/ }).click();
    const grid = page.getByRole('radiogroup', { name: 'Bipper' });
    await expect(grid.getByRole('radio')).toHaveCount(11);
    if (round === 1) {
      await grid.getByRole('radio', { name: 'Bipper 24' }).click();
      await expect(page.locator('.warning')).toHaveCount(0);
    } else {
      const busy = grid.getByRole('radio', { name: 'Bipper 24 (déjà remis)' });
      await expect(busy).toHaveClass(/busy/);
      await busy.click();
      await expect(page.locator('.warning')).toContainText('déjà sur la commande #1');
    }
    await page.getByRole('button', { name: /Valider la commande/ }).click();
    await expect(page.getByRole('status').filter({ hasText: `Commande #${round}` })).toBeVisible();
  }
});

test('autre numéro de bipper saisi à la main', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Sandwich/ }).click();
  await page.getByRole('button', { name: /^Valider · 1 article/ }).click();
  await page.getByRole('radio', { name: /Carte/ }).click();
  await page.getByLabel('Autre numéro').fill('42');
  await page.getByRole('button', { name: /Valider la commande/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /Bipper 42/ })).toBeVisible();
});
