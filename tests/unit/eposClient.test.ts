import { describe, expect, it, vi } from 'vitest';
import {
  commandDoc,
  envelope,
  EPOS_MESSAGES,
  eposPrint,
  eposStatus,
  eposUrl,
  hasDrawerPulse,
  parseResponse,
  statusProblems,
  textDoc,
  toHex,
} from '../../src/printing/eposClient';
import { EscPos } from '../../src/printing/escpos';

const IP = '192.168.1.103';
const OK =
  '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
  '<response success="true" code="" status="251658262" battery="0" xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"/>' +
  '</s:Body></s:Envelope>';
const fail = (code: string, status = 0) =>
  `<s:Envelope><s:Body><response success="false" code="${code}" status="${status}" battery="0"/></s:Body></s:Envelope>`;
const xml = (body: string, status = 200) => Promise.resolve(new Response(body, { status }));

function ticket() {
  const p = new EscPos({ columns: 48 }).init().codepage858().bold(true).textLine('Café 3,50 €');
  p.cut();
  return { bytes: p.toBytes(), preview: p.toPreview() };
}

describe('format ePOS-Print', () => {
  it('URL du service en HTTPS', () => {
    expect(eposUrl(IP)).toBe(
      'https://192.168.1.103/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000',
    );
  });

  it('hexadécimal sur 2 chiffres', () => {
    expect(toHex(Uint8Array.from([0x1b, 0x40, 0x0a, 0xd5]))).toBe('1b400ad5');
  });

  it('octets ESC/POS dans <command>, enveloppe SOAP', () => {
    const doc = envelope(commandDoc(Uint8Array.from([0x1b, 0x40])));
    expect(doc).toContain('<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">');
    expect(doc).toContain(
      '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><command>1b40</command></epos-print>',
    );
  });

  it('variante <text> : styles repris de l’aperçu, texte échappé, coupe', () => {
    const p = new EscPos({ columns: 48 }).align('center').size(2, 2).bold(true).textLine('A&B <1>');
    const doc = textDoc(p.toPreview(), { drawer: true });
    expect(doc).toContain(
      '<text align="center" width="2" height="2" em="true" reverse="false">A&amp;B &lt;1&gt;&#10;</text>',
    );
    expect(doc).toContain('<cut type="feed"/>');
    expect(doc).toContain('<pulse drawer="drawer_1" time="pulse_100"/>');
  });

  it('détecte la commande de tiroir (ESC p)', () => {
    expect(hasDrawerPulse(new EscPos({ columns: 48 }).openDrawer().toBytes())).toBe(true);
    expect(hasDrawerPulse(ticket().bytes)).toBe(false);
  });
});

describe('réponse de l’imprimante', () => {
  it('lit success, code et status', () => {
    expect(parseResponse(OK)).toEqual({ success: true, code: '', status: 251658262 });
    expect(parseResponse(fail('EPTR_COVER_OPEN', 40))).toEqual({
      success: false,
      code: 'EPTR_COVER_OPEN',
      status: 40,
    });
    expect(parseResponse('<html>404</html>')).toBeNull();
  });

  it('état réel relevé en boutique : aucun problème', () => {
    expect(statusProblems(251658262)).toEqual([]);
  });

  it('bits d’état traduits', () => {
    expect(statusProblems(0x20 | 0x80000)).toEqual(['capot ouvert', 'plus de papier']);
  });
});

describe('eposPrint', () => {
  it('envoie en text/plain (sans preflight) le ticket en <command>', async () => {
    const f = vi.fn((_url: string, _init: RequestInit) => xml(OK));
    const t = ticket();
    const r = await eposPrint(IP, t, 1, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: true, value: { ok: true, bytes: t.bytes.length } });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(eposUrl(IP));
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain' });
    const body = String(init.body);
    expect(body).toContain(`<command>${toHex(t.bytes)}</command>`);
    expect(body).toContain('1b401b7413'); // init + PC858
    expect(body).toContain('d5'); // €
  });

  it('exemplaires : octets répétés', async () => {
    const f = vi.fn((_u: string, _i: RequestInit) => xml(OK));
    const t = ticket();
    await eposPrint(IP, t, 2, { fetchImpl: f as unknown as typeof fetch });
    expect(String(f.mock.calls[0]![1].body)).toContain(
      `<command>${toHex(t.bytes).repeat(2)}</command>`,
    );
  });

  it('format <command> refusé (SchemaError) → 2e essai en <text>', async () => {
    const f = vi
      .fn((_u: string, _i: RequestInit) => xml(OK))
      .mockImplementationOnce(() => xml(fail('SchemaError')));
    const r = await eposPrint(IP, ticket(), 1, { fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    const second = String(f.mock.calls[1]![1].body);
    expect(second).not.toContain('<command>');
    expect(second).toContain('Café 3,50 €&#10;</text>');
  });

  it('format « Simple » : directement en <text>, sans <command>', async () => {
    const f = vi.fn((_u: string, _i: RequestInit) => xml(OK));
    const r = await eposPrint(IP, ticket(), 2, {
      fetchImpl: f as unknown as typeof fetch,
      format: 'text',
    });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const body = String(f.mock.calls[0]![1].body);
    expect(body).not.toContain('<command>');
    expect(body.split('Café 3,50 €&#10;</text>')).toHaveLength(3); // 2 exemplaires
    expect(body.split('<cut type="feed"/>')).toHaveLength(3);
    expect(body).not.toContain('<pulse');
  });

  it('format « Simple » : tiroir ouvert une seule fois, après les exemplaires', async () => {
    const f = vi.fn((_u: string, _i: RequestInit) => xml(OK));
    const p = new EscPos({ columns: 48 }).init().textLine('X');
    p.cut().openDrawer();
    await eposPrint(IP, { bytes: p.toBytes(), preview: p.toPreview() }, 2, {
      fetchImpl: f as unknown as typeof fetch,
      format: 'text',
    });
    const body = String(f.mock.calls[0]![1].body);
    expect(body.split('<pulse').length).toBe(2);
    expect(body).toMatch(
      /<cut type="feed"\/><pulse drawer="drawer_1" time="pulse_100"\/><\/epos-print>/,
    );
  });

  it('capot ouvert → erreur imprimante en français', async () => {
    const f = () => xml(fail('EPTR_COVER_OPEN', 0x20 | 0x8));
    const r = await eposPrint(IP, ticket(), 1, { fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('printer');
      expect(r.error.message).toContain('capot ouvert');
      expect(r.error.message).toContain('hors ligne');
    }
  });

  it('réseau coupé ou certificat non accepté → message d’aide', async () => {
    const f = () => Promise.reject(new TypeError('Load failed'));
    const r = await eposPrint(IP, ticket(), 1, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toMatchObject({
      ok: false,
      error: { kind: 'unreachable', message: EPOS_MESSAGES.unreachable },
    });
  });

  it('pas de réponse → délai dépassé', async () => {
    const f = () => new Promise<Response>(() => {});
    const r = await eposPrint(IP, ticket(), 1, {
      fetchImpl: f as unknown as typeof fetch,
      timeoutMs: 20,
    });
    expect(r).toMatchObject({ ok: false, error: { kind: 'timeout' } });
  });

  it('réponse illisible → bad-response', async () => {
    const f = () => xml('<html>Not Found</html>', 404);
    const r = await eposPrint(IP, ticket(), 1, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: false, error: { kind: 'bad-response', detail: 'HTTP 404' } });
  });
});

describe('eposStatus', () => {
  it('document vide, aucune impression', async () => {
    const f = vi.fn((_u: string, _i: RequestInit) => xml(OK));
    const r = await eposStatus(IP, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: true, value: { problems: [], status: 251658262 } });
    expect(String(f.mock.calls[0]![1].body)).toContain(
      '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"/>',
    );
  });

  it('papier presque fini signalé', async () => {
    const f = () => xml(OK.replace('251658262', String(0x20000)));
    const r = await eposStatus(IP, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: true, value: { problems: ['papier presque fini'], status: 0x20000 } });
  });
});
