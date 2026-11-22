import { describe, expect, it, vi } from 'vitest';
import {
  bridgeBaseUrl,
  getHealth,
  MESSAGES,
  sendPrint,
  toBase64,
} from '../../src/printing/bridgeClient';

const target = { ip: '192.168.1.200', port: 9100 };
const settings = { bridgeHost: '192.168.1.122', bridgePort: 8080 };
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('bridgeBaseUrl', () => {
  it('servie par la passerelle → même origine', () => {
    expect(bridgeBaseUrl('bridge', 'http://192.168.1.122:8080', settings)).toBe(
      'http://192.168.1.122:8080',
    );
  });
  it('HTTPS → aucune URL (mixed content)', () => {
    expect(bridgeBaseUrl('https', 'https://mvtax.github.io', settings)).toBeNull();
  });
  it('dev → URL réglée', () => {
    expect(bridgeBaseUrl('dev', 'http://localhost:5173', settings)).toBe(
      'http://192.168.1.122:8080',
    );
  });
});

describe('sendPrint', () => {
  const bytes = Uint8Array.from([0x1b, 0x40, 0x41, 0xd5]);

  it('envoie base64 + copies + jobId en text/plain', async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) =>
      json({ ok: true, bytes: 4, ms: 12 }),
    );
    const r = await sendPrint(
      { baseUrl: 'http://b', fetchImpl: fetchImpl as unknown as typeof fetch },
      bytes,
      { jobId: 'j1', copies: 1, target },
    );
    expect(r).toEqual({ ok: true, value: { ok: true, bytes: 4, ms: 12 } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://b/api/print');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    expect(JSON.parse(String(init?.body))).toEqual({
      data: 'G0BB1Q==',
      copies: 1,
      jobId: 'j1',
      printer: target,
    });
  });

  it('jeton optionnel', async () => {
    const fetchImpl = vi.fn((_u: string, _i?: RequestInit) => json({ ok: true }));
    await sendPrint(
      { baseUrl: 'http://b', token: 'abc', fetchImpl: fetchImpl as unknown as typeof fetch },
      bytes,
      {
        jobId: 'j',
        copies: 1,
        target,
      },
    );
    expect((fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>)['X-MA-Token']).toBe(
      'abc',
    );
  });

  it('HTTPS : refus immédiat avec explication, sans appel réseau', async () => {
    const fetchImpl = vi.fn();
    const r = await sendPrint({ baseUrl: null, fetchImpl }, bytes, {
      jobId: 'j',
      copies: 1,
      target,
    });
    expect(r).toEqual({ ok: false, error: { kind: 'https', message: MESSAGES.https } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passerelle injoignable', async () => {
    const fetchImpl = () => Promise.reject(new TypeError('Load failed'));
    const r = await sendPrint({ baseUrl: 'http://b', fetchImpl }, bytes, {
      jobId: 'j',
      copies: 1,
      target,
    });
    expect(r.ok === false && r.error.kind).toBe('unreachable');
    expect(r.ok === false && r.error.message).toMatch(/fenêtre MA\+ Bridge/);
  });

  it('imprimante injoignable (réponse de la passerelle)', async () => {
    const fetchImpl = () => json({ ok: false, code: 'printer', error: 'connexion refusée' }, 502);
    const r = await sendPrint({ baseUrl: 'http://b', fetchImpl }, bytes, {
      jobId: 'j',
      copies: 1,
      target,
    });
    expect(r).toEqual({
      ok: false,
      error: { kind: 'printer', message: MESSAGES.printer, detail: 'connexion refusée' },
    });
  });

  it('délai dépassé (sans AbortSignal)', async () => {
    vi.useFakeTimers();
    const fetchImpl = () => new Promise<Response>(() => {});
    const p = sendPrint(
      { baseUrl: 'http://b', fetchImpl },
      bytes,
      { jobId: 'j', copies: 1, target },
      1000,
    );
    await vi.advanceTimersByTimeAsync(1001);
    const r = await p;
    vi.useRealTimers();
    expect(r.ok === false && r.error.kind).toBe('timeout');
  });

  it('réponse non JSON', async () => {
    const fetchImpl = () => Promise.resolve(new Response('<html>', { status: 500 }));
    const r = await sendPrint({ baseUrl: 'http://b', fetchImpl }, bytes, {
      jobId: 'j',
      copies: 1,
      target,
    });
    expect(r.ok === false && r.error.kind).toBe('bad-response');
  });
});

describe('getHealth', () => {
  it('passe l’imprimante visée en paramètre', async () => {
    const health = {
      ok: true,
      version: '1.0.0',
      printer: { ...target, reachable: true, latencyMs: 8 },
      uptimeSec: 3,
    };
    const fetchImpl = vi.fn((_u: string, _i?: RequestInit) => json(health));
    const r = await getHealth(
      { baseUrl: 'http://b', fetchImpl: fetchImpl as unknown as typeof fetch },
      target,
    );
    expect(r).toEqual({ ok: true, value: health });
    expect(fetchImpl.mock.calls[0]![0]).toBe('http://b/api/health?ip=192.168.1.200&port=9100');
  });
});

describe('toBase64', () => {
  it('gros tickets (> 32 Ko) sans erreur', () => {
    const big = new Uint8Array(100_000).fill(0x41);
    expect(atob(toBase64(big))).toHaveLength(100_000);
  });
});
