import { expect, test, type Page } from '@playwright/test';
import { BRIDGE, mockBridge, useBridgeMode, type Mode } from './bridgeMock';

async function orderSandwich(page: Page, bipper = 'Bipper 18') {
  await page.getByRole('button', { name: /^Sandwich/ }).click();
  await page.getByRole('button', { name: /^Valider · 1 article/ }).click();
  await page.getByRole('radio', { name: /Carte/ }).click();
  await page.getByRole('radio', { name: bipper }).click();
  await page.getByRole('button', { name: /Valider la commande/ }).click();
}

test.beforeEach(({ page }) => {
  page.on('dialog', (d) => d.accept());
});

test('impression automatique réussie : octets ESC/POS envoyés, pastille verte', async ({
  page,
}) => {
  const prints = await mockBridge(page, () => 'ok');
  await page.goto('/');
  await expect(page.getByTestId('printer-pill')).toHaveAttribute('data-state', 'ok');

  await orderSandwich(page);
  await expect(page.getByRole('status').filter({ hasText: 'Commande #1 imprimée' })).toBeVisible();
  expect(prints).toHaveLength(1);
  const p = prints[0]!;
  expect(p.copies).toBe(1);
  expect(p.label).toBe('Commande #1 bipper 18');
  const bytes = Buffer.from(p.data, 'base64');
  expect([...bytes.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x13]); // init + PC858
  const latin1 = bytes.toString('latin1');
  expect(latin1).toContain('COMMANDE #1');
  expect(latin1).toContain('Sandwich');
  expect(bytes.includes(0xd5)).toBe(true); // €
  expect([...bytes.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]); // coupe

  await page.getByRole('button', { name: /^Commandes/ }).click();
  await expect(page.getByTestId('order-row').first().getByLabel('Ticket imprimé')).toBeVisible();
});

test('imprimante en panne : commande conservée, « Imprimer plus tard » puis rattrapage', async ({
  page,
}) => {
  let mode: Mode = 'printer-down';
  const prints = await mockBridge(page, () => mode);
  await page.goto('/');
  await expect(page.getByTestId('printer-pill')).toHaveAttribute('data-state', 'warn');

  await orderSandwich(page);
  const sheet = page.getByRole('alertdialog', { name: /Ticket non imprimé/ });
  await expect(sheet).toContainText('la commande est bien enregistrée');
  await expect(page.getByTestId('print-fail-message')).toContainText('Imprimante injoignable');

  // Réessayer : toujours en panne
  await sheet.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByTestId('print-fail-message')).toContainText('Imprimante injoignable');
  await sheet.getByRole('button', { name: 'Imprimer plus tard' }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: /^Commandes/ }).click();
  await expect(page.getByText('1 ticket non imprimé')).toBeVisible();
  await expect(
    page.getByTestId('order-row').first().getByLabel('Ticket non imprimé'),
  ).toBeVisible();

  // L'imprimante revient : on imprime à la demande
  mode = 'ok';
  await page.getByRole('button', { name: 'Imprimer maintenant' }).click();
  await expect(page.getByText('1 ticket non imprimé')).toBeHidden();
  await expect(page.getByTestId('order-row').first().getByLabel('Ticket imprimé')).toBeVisible();
  // 3 essais (auto, réessayer, rattrapage), même jobId tant qu'aucun n'a réussi
  expect(prints).toHaveLength(3);
  expect(new Set(prints.map((p) => p.jobId)).size).toBe(1);
});

test('passerelle muette : délai dépassé, message clair', async ({ page }) => {
  test.setTimeout(40_000);
  await mockBridge(page, () => 'hang');
  await page.goto('/');
  await orderSandwich(page, 'Bipper 6');
  await expect(page.getByTestId('print-fail-message')).toContainText('délai dépassé', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Imprimer plus tard' }).click();
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await expect(page.getByTestId('order-row')).toHaveCount(1);
});

test('passerelle absente : pastille grise, message en français', async ({ page }) => {
  await useBridgeMode(page);
  await page.route(`${BRIDGE}/api/**`, (route) => route.abort('connectionrefused'));
  await page.goto('/');
  await expect(page.getByTestId('printer-pill')).toHaveAttribute('data-state', 'off');
  await page.getByTestId('printer-pill').click();
  await expect(page.getByTestId('bridge-status')).toContainText('fenêtre MA+ Bridge');
});

test('réglages : ticket de test et réimpression', async ({ page }) => {
  const prints = await mockBridge(page, () => 'ok');
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByTestId('printer-status')).toContainText('OK');
  await page.getByRole('button', { name: /Imprimer un ticket de test/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket de test envoyé' })).toBeVisible();
  expect(Buffer.from(prints[0]!.data, 'base64').toString('latin1')).toContain('IMPRESSION OK');
  await expect(page.getByTestId('launch-command')).toContainText(
    'mvtax.github.io/caisse/bridge.ps1',
  );

  await page
    .getByRole('button', { name: /Retour|Accueil/ })
    .first()
    .click();
  await orderSandwich(page, 'Bipper 22');
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await page.getByRole('button', { name: 'Réimprimer la commande 1' }).click();
  await expect.poll(() => prints.length).toBe(3);
  // Réimpression volontaire après succès : nouveau jobId (sinon ignorée comme doublon)
  expect(prints[2]!.jobId).not.toBe(prints[1]!.jobId);
});
