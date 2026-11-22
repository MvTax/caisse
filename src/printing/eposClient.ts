/**
 * Impression directe sur l'Epson TM-m30II depuis Safari, sans passerelle (ePOS-Print).
 *
 * L'imprimante expose un service web en HTTPS : https://IP/cgi-bin/epos/service.cgi.
 * Vérifié en boutique le 22/11/2026 depuis l'iPhone (testeur, rapport v2026-11-22.6) :
 * la page GitHub Pages peut l'appeler et lire la réponse, une fois l'avertissement de
 * certificat accepté dans Safari (ouvrir https://IP une fois).
 *
 * - Le ticket est le même que pour la passerelle : les octets ESC/POS (ticket.ts, PC858)
 *   sont transmis tels quels dans un élément <command> (hexadécimal).
 * - Si l'imprimante refuse ce format (SchemaError), on réessaie avec des éléments <text>
 *   construits à partir de l'aperçu du ticket.
 * - Corps envoyé en text/plain : requête « simple », sans preflight CORS (essai n° 5 du
 *   rapport, réussi sur la vraie imprimante).
 */
import type { BridgeError, PrintResponse, Result } from './bridgeClient';
import type { PreviewLine } from './escpos';

export const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

export const eposUrl = (ip: string) =>
  `https://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;

export const EPOS_MESSAGES = {
  unreachable:
    'Imprimante Epson injoignable : l’iPhone est-il sur le Wi-Fi de la boutique ? La 1ʳᵉ fois sur cet iPhone, ouvre la page de l’imprimante (Réglages → Impression) et accepte l’avertissement.',
  timeout: 'L’imprimante Epson ne répond pas (délai dépassé). Réessaie dans un instant.',
  badResponse: 'Réponse inattendue de l’imprimante Epson.',
} as const;

/** Codes d'erreur ePOS-Print → message pour l'employé. */
const CODES: Record<string, string> = {
  EPTR_COVER_OPEN: 'capot ouvert',
  EPTR_REC_EMPTY: 'plus de papier',
  EPTR_CUTTER: 'massicot bloqué (papier coincé ?)',
  EPTR_MECHANICAL: 'erreur mécanique',
  EPTR_AUTOMATICAL: 'erreur passagère (surchauffe, papier…), patiente puis réessaie',
  EPTR_UNRECOVERABLE: 'erreur grave : éteins puis rallume l’imprimante',
  DeviceNotFound: 'imprimante interne introuvable',
  SchemaError: 'format de ticket refusé',
  PrintSystemError: 'erreur du système d’impression',
  EX_TIMEOUT: 'délai dépassé',
  EX_BADPORT: 'port de communication indisponible',
};

/** Bits d'état ePOS-Print signalant un problème. */
const STATUS_BITS: [number, string][] = [
  [0x1, 'pas de réponse'],
  [0x8, 'hors ligne'],
  [0x20, 'capot ouvert'],
  [0x400, 'erreur mécanique'],
  [0x800, 'massicot bloqué'],
  [0x2000, 'erreur grave'],
  [0x4000, 'erreur passagère'],
  [0x20000, 'papier presque fini'],
  [0x80000, 'plus de papier'],
];

export function statusProblems(status: number): string[] {
  return STATUS_BITS.filter(([bit]) => (status & bit) !== 0).map(([, label]) => label);
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

const xmlEscape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );

export function envelope(inner: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    inner +
    '</s:Body></s:Envelope>'
  );
}

/** Document ePOS-Print vide : sert à lire l'état de l'imprimante sans rien imprimer. */
export const statusDoc = () => `<epos-print xmlns="${EPOS_NS}"/>`;

/** Octets ESC/POS bruts dans un élément <command>. */
export function commandDoc(bytes: Uint8Array): string {
  return `<epos-print xmlns="${EPOS_NS}"><command>${toHex(bytes)}</command></epos-print>`;
}

/** Variante de secours : le ticket reconstruit en éléments <text> depuis son aperçu. */
export function textDoc(lines: PreviewLine[], opts: { drawer: boolean }): string {
  let body = '<text lang="en" smooth="true"/>';
  for (const l of lines) {
    body +=
      `<text align="${l.align}" width="${l.width}" height="${l.height}" ` +
      `em="${l.bold}" reverse="${l.invert}">${xmlEscape(l.text)}&#10;</text>`;
  }
  body += '<text align="left" width="1" height="1" em="false" reverse="false"/>';
  body += '<cut type="feed"/>';
  if (opts.drawer) body += '<pulse drawer="drawer_1" time="pulse_100"/>';
  return `<epos-print xmlns="${EPOS_NS}">${body}</epos-print>`;
}

/** Le ticket contient-il la commande d'ouverture du tiroir (ESC p) ? */
export function hasDrawerPulse(bytes: Uint8Array): boolean {
  for (let i = 0; i + 1 < bytes.length; i++) {
    if (bytes[i] === 0x1b && bytes[i + 1] === 0x70) return true;
  }
  return false;
}

export interface EposResponse {
  success: boolean;
  code: string;
  status: number;
}

export function parseResponse(xml: string): EposResponse | null {
  const tag = /<(?:\w+:)?response\b([^>]*)>/.exec(xml);
  if (!tag) return null;
  const attrs = tag[1] ?? '';
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
  const success = attr('success');
  if (success === undefined) return null;
  return {
    success: success === 'true',
    code: attr('code') ?? '',
    status: Number(attr('status') ?? 0) || 0,
  };
}

/** Erreur d'impression lisible à partir d'une réponse « success=false ». */
export function responseError(r: EposResponse): BridgeError {
  const reason = CODES[r.code] ?? (r.code || 'raison inconnue');
  const more = statusProblems(r.status).filter((p) => p !== reason);
  return {
    kind: 'printer',
    message: `L’imprimante Epson a refusé le ticket : ${reason}${more.length ? ` (${more.join(', ')})` : ''}.`,
    detail: r.code,
  };
}

export interface EposOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

class Timeout extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Timeout()), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** Envoie un document ePOS-Print et lit la réponse de l'imprimante. */
export async function eposSend(
  ip: string,
  doc: string,
  opts: EposOptions = {},
): Promise<Result<EposResponse>> {
  const f = opts.fetchImpl ?? fetch;
  const ms = opts.timeoutMs ?? 15000;
  try {
    const res = await withTimeout(
      f(eposUrl(ip), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: envelope(doc),
        cache: 'no-store',
        credentials: 'omit',
      }),
      ms,
    );
    const text = await withTimeout(res.text(), ms);
    const parsed = parseResponse(text);
    if (!parsed) {
      return {
        ok: false,
        error: {
          kind: 'bad-response',
          message: EPOS_MESSAGES.badResponse,
          detail: `HTTP ${res.status}`,
        },
      };
    }
    return { ok: true, value: parsed };
  } catch (e) {
    if (e instanceof Timeout) {
      return { ok: false, error: { kind: 'timeout', message: EPOS_MESSAGES.timeout } };
    }
    return {
      ok: false,
      error: { kind: 'unreachable', message: EPOS_MESSAGES.unreachable, detail: String(e) },
    };
  }
}

/** État de l'imprimante (aucune impression). */
export async function eposStatus(
  ip: string,
  opts: EposOptions = {},
): Promise<Result<{ problems: string[]; status: number }>> {
  const r = await eposSend(ip, statusDoc(), { timeoutMs: 6000, ...opts });
  if (!r.ok) return r;
  if (!r.value.success) return { ok: false, error: responseError(r.value) };
  return { ok: true, value: { problems: statusProblems(r.value.status), status: r.value.status } };
}

/**
 * Format d'envoi à l'Epson :
 *  - 'escpos' : octets ESC/POS de ticket.ts dans <command> (PC858, bipper inversé…), avec
 *               repli automatique en <text> si l'imprimante répond SchemaError ;
 *  - 'text'   : directement en éléments <text>, la méthode utilisée par le testeur, dont un
 *               ticket est sorti en boutique le 22/11/2026. Solution de secours si le format
 *               ESC/POS sort mal (caractères bizarres, rien qui sort).
 */
export type EposFormat = 'escpos' | 'text';

/** Document <text> pour n exemplaires, avec ouverture du tiroir éventuelle. */
export function textPrintDoc(preview: PreviewLine[], copies: number, drawer: boolean): string {
  const inner = textDoc(preview, { drawer: false }).replace(
    /^<epos-print[^>]*>|<\/epos-print>$/g,
    '',
  );
  const pulse = drawer ? '<pulse drawer="drawer_1" time="pulse_100"/>' : '';
  return `<epos-print xmlns="${EPOS_NS}">${inner.repeat(copies)}${pulse}</epos-print>`;
}

/** Imprime un ticket (octets ESC/POS + aperçu pour la variante texte). */
export async function eposPrint(
  ip: string,
  ticket: { bytes: Uint8Array; preview: PreviewLine[] },
  copies: number,
  opts: EposOptions & { format?: EposFormat } = {},
): Promise<Result<PrintResponse>> {
  const n = Math.max(1, Math.min(3, Math.round(copies)));
  const all = new Uint8Array(ticket.bytes.length * n);
  for (let i = 0; i < n; i++) all.set(ticket.bytes, i * ticket.bytes.length);
  const asText = () => textPrintDoc(ticket.preview, n, hasDrawerPulse(ticket.bytes));

  const t0 = Date.now();
  let r: Result<EposResponse>;
  if (opts.format === 'text') {
    r = await eposSend(ip, asText(), opts);
  } else {
    r = await eposSend(ip, commandDoc(all), opts);
    if (r.ok && !r.value.success && r.value.code === 'SchemaError') {
      r = await eposSend(ip, asText(), opts);
    }
  }
  if (!r.ok) return r;
  if (!r.value.success) return { ok: false, error: responseError(r.value) };
  return { ok: true, value: { ok: true, bytes: all.length, ms: Date.now() - t0 } };
}
