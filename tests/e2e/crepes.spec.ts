import { expect, test } from '@playwright/test';

/** Planning des crêpes d'exposition : un jour sur deux, Ouarda en semaine, Kenza le week-end. */
const EPOS = 'https://192.168.1.103/cgi-bin/epos/service.cgi**';
const OK =
  '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
  '<response success="true" code="" status="251658262" battery="0" xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"/>' +
  '</s:Body></s:Envelope>';

test('planning de la semaine, semaine prochaine, réglage du jour, fiche imprimée', async ({
  page,
}) => {
  const prints: string[] = [];
  await page.route(EPOS, (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('<command>')) prints.push(body);
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/xml' },
      body: OK,
    });
  });
  // Mercredi 25/11/2026, 10 h à Paris.
  await page.clock.setFixedTime(new Date('2026-11-25T09:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Planning crêpes' })).toContainText(
    'Régler le planning',
  );
  await page.getByRole('button', { name: 'Planning crêpes' }).click();

  const week = page.getByTestId('rota-week');
  await expect(week).toContainText('Semaine du 23/11 au 29/11');
  await expect(page.getByRole('alert')).toContainText('Indique plus bas un jour');

  // Le changement a eu lieu mardi 24/11 → mar, jeu, sam (Kenza).
  await page.getByLabel('Un jour de changement').fill('2026-11-24');
  await page.getByLabel('Un jour de changement').dispatchEvent('change');
  await expect(page.getByRole('alert')).toBeHidden();
  const changes = week.locator('[data-testid="rota-day"][data-change="true"]');
  await expect(changes).toHaveText([
    /Mardi 24\/11.*Ouarda/,
    /Jeudi 26\/11.*Ouarda/,
    /Samedi 28\/11.*Kenza/,
  ]);

  await page.getByRole('tab', { name: 'Semaine prochaine' }).click();
  await expect(week).toContainText('Semaine du 30/11 au 06/12');
  await expect(changes).toHaveText([
    /Lundi 30\/11.*Ouarda/,
    /Mercredi 02\/12.*Ouarda/,
    /Vendredi 04\/12.*Ouarda/,
    /Dimanche 06\/12.*Kenza/,
  ]);

  await page.getByRole('button', { name: /Imprimer la fiche/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Fiche crêpes imprimée' })).toBeVisible();
  const hex = /<command>([0-9a-f]+)<\/command>/.exec(prints.at(-1) ?? '')?.[1] ?? '';
  const ticket = Buffer.from(hex, 'hex').toString('latin1');
  expect(ticket).toContain('PLANNING');
  expect(ticket).toMatch(/Lundi +Ouarda/);
  expect(ticket).toMatch(/Mardi +--/);
  expect(ticket).toMatch(/Dimanche +Kenza/);
  expect(ticket).not.toMatch(/\d\d\/\d\d/);

  // Réglage conservé après rechargement.
  await page.reload();
  // Accueil : consigne du jour (mercredi 25/11, changement prévu jeudi).
  await expect(page.getByRole('button', { name: 'Planning crêpes' })).toContainText(
    'Pas aujourd’hui · demain : Ouarda',
  );
  await page.getByRole('button', { name: 'Planning crêpes' }).click();
  await expect(page.getByLabel('Un jour de changement')).toHaveValue('2026-11-24');
});
