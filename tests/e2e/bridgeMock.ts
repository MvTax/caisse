import type { Page, Route } from '@playwright/test';

/**
 * Passerelle simulée : en dev l'app vise http://192.168.1.122:8080 (réglage par défaut).
 * On intercepte ces appels pour tester succès, imprimante en panne et délai dépassé.
 */
export const BRIDGE = 'http://192.168.1.122:8080';
const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export type Mode = 'ok' | 'printer-down' | 'hang';

export async function mockBridge(page: Page, mode: () => Mode) {
  const prints: { data: string; jobId: string; copies: number; label?: string }[] = [];
  await page.route(`${BRIDGE}/api/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const m = mode();
    if (url.pathname === '/api/health') {
      return route.fulfill({
        headers: cors,
        body: JSON.stringify({
          ok: true,
          version: '1.0.0',
          printer: {
            ip: '192.168.1.200',
            port: 9100,
            reachable: m === 'ok',
            latencyMs: m === 'ok' ? 9 : null,
          },
          uptimeSec: 5,
        }),
      });
    }
    if (url.pathname === '/api/print') {
      if (m === 'hang') return; // ne répond jamais
      prints.push(JSON.parse(route.request().postData() ?? '{}'));
      return m === 'ok'
        ? route.fulfill({ headers: cors, body: JSON.stringify({ ok: true, bytes: 900, ms: 120 }) })
        : route.fulfill({
            status: 502,
            headers: cors,
            body: JSON.stringify({ ok: false, code: 'printer', error: 'refused' }),
          });
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
  return prints;
}
