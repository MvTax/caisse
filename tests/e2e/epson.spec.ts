import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Epson TM-m30II en Wi-Fi direct (réglage par défaut) : on simule son service ePOS-Print.
 * Réponse réelle relevée en boutique : success="true" status="251658262".
 */
const EPOS = 'https://192.168.1.103/cgi-bin/epos/service.cgi**';
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/xml; charset=utf-8' };
const response = (success: boolean, code = '', status = 251658262) =>
  '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
  `<response success="${success}" code="${code}" status="${status}" battery="0" xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"/>` +
  '</s:Body></s:Envelope>';

type Mode = 'ok' | 'cover-open';

async function mockEpson(page: Page, mode: () => Mode) {
  const prints: string[] = [];
  await page.route(EPOS, async (route: Route) => {
    const body = route.request().postData() ?? '';
    const isPrint = body.includes('<command>') || body.includes('<text');
    if (isPrint) prints.push(body);
    if (mode() === 'cover-open' && isPrint) {
      return route.fulfill({ headers, body: response(false, 'EPTR_COVER_OPEN', 0x20 | 0x8) });
    }
    return route.fulfill({ headers, body: response(true) });
  });
  return prints;
}

async function orderSandwich(page: Page, bipper = 'Bipper 18') {
  await page.getByRole('button', { name: /^Sandwich/ }).click();
  await page.getByRole('button', { name: /^Valider · 1 article/ }).click();
  await page.getByRole('radio', { name: /Carte/ }).click();
  await page.getByRole('radio', { name: bipper }).click();
  await page.getByRole('button', { name: /Valider la commande/ }).click();
}

/** Octets ESC/POS transmis dans <command> (hexadécimal). */
function commandBytes(body: string): Buffer {
  const hex = /<command>([0-9a-f]+)<\/command>/.exec(body)?.[1] ?? '';
  return Buffer.from(hex, 'hex');
}

test.beforeEach(({ page }) => {
  page.on('dialog', (d) => d.accept());
});

test('Epson : impression automatique en Wi-Fi, même ticket ESC/POS que la passerelle', async ({
  page,
}) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await expect(page.getByTestId('printer-pill')).toHaveAttribute('data-state', 'ok');

  await orderSandwich(page);
  await expect(page.getByRole('status').filter({ hasText: 'Commande #1 imprimée' })).toBeVisible();
  expect(prints).toHaveLength(1);
  const bytes = commandBytes(prints[0]!);
  expect([...bytes.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x13]); // init + PC858
  const latin1 = bytes.toString('latin1');
  expect(latin1).toContain('COMMANDE #1');
  expect(latin1).toContain('Sandwich');
  expect(bytes.includes(0xd5)).toBe(true); // €
  expect([...bytes.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]); // coupe

  await page.getByRole('button', { name: /^Commandes/ }).click();
  await expect(page.getByTestId('order-row').first().getByLabel('Ticket imprimé')).toBeVisible();
});

test('Epson : capot ouvert → message clair, commande conservée, réimpression', async ({ page }) => {
  let mode: Mode = 'cover-open';
  const prints = await mockEpson(page, () => mode);
  await page.goto('/');
  await orderSandwich(page);
  await expect(page.getByTestId('print-fail-message')).toContainText('capot ouvert');
  await page.getByRole('button', { name: 'Imprimer plus tard' }).click();

  mode = 'ok';
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await page.getByRole('button', { name: 'Imprimer maintenant' }).click();
  await expect(page.getByText('1 ticket non imprimé')).toBeHidden();
  expect(prints).toHaveLength(2);
});

test('Epson injoignable : pastille grise et aide « première fois »', async ({ page }) => {
  await page.route(EPOS, (route) => route.abort('connectionrefused'));
  await page.goto('/');
  await expect(page.getByTestId('printer-pill')).toHaveAttribute('data-state', 'off');
  await page.getByTestId('printer-pill').click();
  await expect(page.getByTestId('printer-status')).toContainText('Imprimante Epson injoignable');
  await expect(page.getByTestId('epson-open')).toHaveAttribute('href', 'https://192.168.1.103/');
});

test('Epson : ticket de test depuis les réglages', async ({ page }) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByTestId('printer-status')).toContainText('OK');
  await page.getByRole('button', { name: /Imprimer un ticket de test/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket de test envoyé' })).toBeVisible();
  expect(commandBytes(prints[0]!).toString('latin1')).toContain('IMPRESSION OK');
});

test('Epson : format « Simple » (secours) → ticket envoyé en <text>', async ({ page }) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('radio', { name: 'Simple' }).click();
  await page.getByRole('button', { name: /Imprimer un ticket de test/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket de test envoyé' })).toBeVisible();
  expect(prints[0]).not.toContain('<command>');
  expect(prints[0]).toContain('IMPRESSION OK');
});

test('Epson : récapitulatif de la journée depuis les statistiques', async ({ page }) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await orderSandwich(page);
  await expect(page.getByRole('status').filter({ hasText: 'Commande #1 imprimée' })).toBeVisible();
  await page.getByRole('button', { name: 'Statistiques', exact: true }).click();
  await page.getByRole('button', { name: /Imprimer le récapitulatif/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Récapitulatif envoyé' })).toBeVisible();
  expect(prints).toHaveLength(2);
  const recap = commandBytes(prints[1]!).toString('latin1');
  expect(recap).toContain('CAPITULATIF'); // « RÉCAPITULATIF » en PC858
  expect(recap).toContain('1x Sandwich');
  expect(recap).toContain('non fiscal');
});

test('Epson : ticket client et note sans détail depuis la fiche commande', async ({ page }) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await orderSandwich(page);
  await expect(page.getByRole('status').filter({ hasText: 'Commande #1 imprimée' })).toBeVisible();
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await page.getByTestId('order-row').first().click();

  await page.getByRole('button', { name: /Ticket client/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket client imprimé' })).toBeVisible();
  const client = commandBytes(prints[1]!).toString('latin1');
  expect(client).toContain('Mangos Creteil Soleil');
  expect(client).toContain('SIRET:839 932 977 00029');
  expect(client).toContain('Sandwich');
  expect(client).toContain('REGLEMENT : Carte bancaire');
  expect(client).toContain('MT TVA');
  expect(client).not.toContain('BIPPER');

  await page.getByRole('button', { name: /Sans détail/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Note sans détail imprimée' }),
  ).toBeVisible();
  const note = commandBytes(prints[2]!).toString('latin1');
  expect(note).toContain('NOTE');
  expect(note).toContain('TOTAL TTC');
  expect(note).not.toContain('Sandwich');
  expect(note).not.toContain('Carte');
  expect(prints).toHaveLength(3);
});

test('Réglages : taux de TVA modifiable, utilisé sur le ticket client', async ({ page }) => {
  const prints = await mockEpson(page, () => 'ok');
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'TVA Sandwich' })
    .getByRole('radio', { name: '20 %' })
    .click();
  await page.getByRole('button', { name: /^Accueil/ }).click();
  await orderSandwich(page);
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await page.getByTestId('order-row').first().click();
  await page.getByRole('button', { name: /Ticket client/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket client imprimé' })).toBeVisible();
  expect(commandBytes(prints.at(-1)!).toString('latin1')).toMatch(/\n20% +1,16 +5,79 +6,95/);
});
