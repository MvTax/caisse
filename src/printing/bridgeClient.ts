/**
 * Appels HTTP à la passerelle (ma-bridge.ps1) sur la caisse.
 *
 * - Servie par la passerelle (http://192.168.1.122:8080) → même origine : aucun souci.
 * - Servie en HTTPS (GitHub Pages) → Safari bloque l'appel (mixed content) : on ne tente même
 *   pas, on explique.
 * - Le corps est envoyé en text/plain pour éviter les requêtes « preflight » CORS en dev.
 * - Délai maximum via Promise.race (pas d'AbortSignal.timeout, peu fiable sur iOS).
 */
import type { ServingMode } from '../app/env';

export type BridgeErrorKind = 'https' | 'unreachable' | 'timeout' | 'printer' | 'bad-response';

export interface BridgeError {
  kind: BridgeErrorKind;
  message: string;
  detail?: string;
}

export interface Health {
  ok: boolean;
  version: string;
  printer: { ip: string; port: number; reachable: boolean; latencyMs: number | null };
  uptimeSec: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: BridgeError };

export interface PrintTarget {
  ip: string;
  port: number;
}

export interface BridgeConfig {
  baseUrl: string | null;
  token?: string;
  fetchImpl?: typeof fetch;
}

export const MESSAGES = {
  https:
    'Impression impossible depuis la version en ligne. Ouvre l’app depuis l’adresse affichée sur la caisse (http://192.168.1.122:8080).',
  unreachable:
    'Passerelle injoignable : la fenêtre MA+ Bridge est-elle ouverte sur la caisse, et l’iPhone sur le Wi-Fi de la boutique ?',
  timeout: 'La passerelle ne répond pas (délai dépassé). Réessaie dans un instant.',
  printer: 'Imprimante injoignable : est-elle allumée, avec du papier, et branchée au réseau ?',
  badResponse: 'Réponse inattendue de la passerelle.',
} as const;

/** URL de la passerelle selon l'origine de la page. */
export function bridgeBaseUrl(
  mode: ServingMode,
  origin: string,
  settings: { bridgeHost: string; bridgePort: number },
): string | null {
  if (mode === 'https') return null;
  if (mode === 'bridge') return origin;
  return `http://${settings.bridgeHost}:${settings.bridgePort}`;
}

class Timeout extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Timeout()), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

async function call<T>(
  cfg: BridgeConfig,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Result<{ status: number; body: T }>> {
  if (!cfg.baseUrl) return { ok: false, error: { kind: 'https', message: MESSAGES.https } };
  const f = cfg.fetchImpl ?? fetch;
  const headers: Record<string, string> = {};
  if (cfg.token) headers['X-MA-Token'] = cfg.token;
  if (init.body) headers['Content-Type'] = 'text/plain;charset=UTF-8';
  try {
    const res = await withTimeout(
      f(`${cfg.baseUrl}${path}`, { ...init, headers, cache: 'no-store' }),
      timeoutMs,
    );
    let body: T;
    try {
      body = (await withTimeout(res.json(), timeoutMs)) as T;
    } catch (e) {
      if (e instanceof Timeout) throw e;
      return {
        ok: false,
        error: {
          kind: 'bad-response',
          message: MESSAGES.badResponse,
          detail: `HTTP ${res.status}`,
        },
      };
    }
    return { ok: true, value: { status: res.status, body } };
  } catch (e) {
    if (e instanceof Timeout)
      return { ok: false, error: { kind: 'timeout', message: MESSAGES.timeout } };
    return {
      ok: false,
      error: { kind: 'unreachable', message: MESSAGES.unreachable, detail: String(e) },
    };
  }
}

export async function getHealth(
  cfg: BridgeConfig,
  target: PrintTarget,
  timeoutMs = 4000,
): Promise<Result<Health>> {
  const q = `?ip=${encodeURIComponent(target.ip)}&port=${target.port}`;
  const r = await call<Health>(cfg, `/api/health${q}`, { method: 'GET' }, timeoutMs);
  if (!r.ok) return r;
  const h = r.value.body;
  if (!h || typeof h !== 'object' || !h.printer) {
    return { ok: false, error: { kind: 'bad-response', message: MESSAGES.badResponse } };
  }
  return { ok: true, value: h };
}

export interface PrintResponse {
  ok: boolean;
  bytes?: number;
  ms?: number;
  duplicate?: boolean;
  /** 'printer' (imprimante injoignable), 'token', 'bad-request', 'too-large'. */
  code?: string;
  error?: string;
}

/** Uint8Array → base64, par paquets (évite les débordements de pile). */
export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export async function sendPrint(
  cfg: BridgeConfig,
  bytes: Uint8Array,
  opts: { jobId: string; copies: number; target: PrintTarget; label?: string },
  timeoutMs = 9000,
): Promise<Result<PrintResponse>> {
  const body = JSON.stringify({
    data: toBase64(bytes),
    copies: opts.copies,
    jobId: opts.jobId,
    printer: opts.target,
    label: opts.label,
  });
  const r = await call<PrintResponse>(cfg, '/api/print', { method: 'POST', body }, timeoutMs);
  if (!r.ok) return r;
  const res = r.value.body;
  if (!res || typeof res.ok !== 'boolean') {
    return { ok: false, error: { kind: 'bad-response', message: MESSAGES.badResponse } };
  }
  if (!res.ok) {
    if (!res.code || res.code === 'printer') {
      return {
        ok: false,
        error: { kind: 'printer', message: MESSAGES.printer, detail: res.error },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'bad-response',
        message: `Passerelle : ${res.error ?? res.code}`,
        detail: res.code,
      },
    };
  }
  return { ok: true, value: res };
}
