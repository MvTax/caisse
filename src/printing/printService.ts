/**
 * Service d'impression côté app : construit les octets (ticket.ts), les envoie à
 * l'imprimante, journalise le résultat sur la commande et tient à jour la pastille d'état.
 * Une commande n'est JAMAIS perdue si l'impression échoue.
 *
 * Deux acheminements, selon le réglage « Imprimante » :
 *  - 'epson'  : Epson TM-m30II jointe directement par Safari en Wi-Fi (eposClient.ts),
 *               possible même depuis GitHub Pages ;
 *  - 'bridge' : passerelle sur la caisse (bridgeClient.ts) → CSI GIANT-100.
 */
import { signal } from '@preact/signals';
import { detectServingMode } from '../app/env';
import { data, menu, update } from '../app/state';
import type { Order, PrintAttempt } from '../domain/order';
import {
  bridgeBaseUrl,
  getHealth,
  sendPrint,
  type BridgeConfig,
  type BridgeError,
  type Health,
  type Result,
  type PrintResponse,
} from './bridgeClient';
import type { RotaDay } from '../domain/rota';
import type { EscPos } from './escpos';
import { eposPrint, eposStatus } from './eposClient';
import {
  charsetTicket,
  crepeRotaTicket,
  customerTicket,
  invoiceTicket,
  orderTicket,
  testTicket,
} from './ticket';

export const servingMode = detectServingMode(location);

export type PrinterState = 'unknown' | 'checking' | 'ok' | 'warn' | 'off' | 'https';

export interface PrinterStatus {
  state: PrinterState;
  message: string;
  health?: Health;
  checkedAt?: Date;
}

const usesEpson = () => data.value.settings.printerMode === 'epson';

/** Impression possible ? Toujours avec l'Epson ; la passerelle, elle, est bloquée en https. */
export const canPrint = () => usesEpson() || servingMode !== 'https';

function idleStatus(): PrinterStatus {
  return canPrint()
    ? { state: 'unknown', message: 'État de l’imprimante inconnu.' }
    : { state: 'https', message: 'Version démo : impression impossible depuis cette adresse.' };
}

export const printerStatus = signal<PrinterStatus>(idleStatus());

/** Échec d'impression à proposer de réessayer (feuille « Réessayer / Imprimer plus tard »). */
export const printFailure = signal<{ orderId: string; message: string } | null>(null);
export const printingIds = signal<ReadonlySet<string>>(new Set());

function config(): BridgeConfig {
  const s = data.value.settings;
  return {
    baseUrl: bridgeBaseUrl(servingMode, location.origin, s),
    token: s.token || undefined,
  };
}

const target = () => ({ ip: data.value.settings.printerIp, port: data.value.settings.printerPort });

function statusFromError(e: BridgeError): PrinterStatus {
  if (e.kind === 'https') return { state: 'https', message: e.message };
  if (e.kind === 'printer') return { state: 'warn', message: e.message, checkedAt: new Date() };
  return { state: 'off', message: e.message, checkedAt: new Date() };
}

async function checkEpson(): Promise<PrinterStatus> {
  const ip = data.value.settings.epsonIp;
  const r = await eposStatus(ip);
  printerStatus.value = r.ok
    ? r.value.problems.length
      ? {
          state: 'warn',
          message: `Imprimante Epson : ${r.value.problems.join(', ')}`,
          checkedAt: new Date(),
        }
      : { state: 'ok', message: `Imprimante Epson OK (${ip})`, checkedAt: new Date() }
    : r.error.kind === 'printer'
      ? { state: 'warn', message: r.error.message, checkedAt: new Date() }
      : { state: 'off', message: r.error.message, checkedAt: new Date() };
  return printerStatus.value;
}

export async function checkHealth(): Promise<PrinterStatus> {
  if (!canPrint()) return (printerStatus.value = idleStatus());
  if (printerStatus.value.state === 'unknown' || printerStatus.value.state === 'https') {
    printerStatus.value = { state: 'checking', message: 'Vérification…' };
  }
  if (usesEpson()) return checkEpson();
  const r = await getHealth(config(), target());
  printerStatus.value = r.ok
    ? r.value.printer.reachable
      ? {
          state: 'ok',
          message: `Imprimante OK (${r.value.printer.ip}:${r.value.printer.port})`,
          health: r.value,
          checkedAt: new Date(),
        }
      : {
          state: 'warn',
          message: `Passerelle OK, mais imprimante injoignable (${r.value.printer.ip}:${r.value.printer.port}) : est-elle allumée et branchée ?`,
          health: r.value,
          checkedAt: new Date(),
        }
    : statusFromError(r.error);
  return printerStatus.value;
}

let pollTimer: ReturnType<typeof setInterval> | undefined;
/** Interroge la passerelle toutes les 15 s quand l'app est au premier plan. */
export function startHealthPolling(): void {
  if (pollTimer) return;
  void checkHealth();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && canPrint()) void checkHealth();
  }, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && canPrint()) void checkHealth();
  });
}

/** À appeler quand le choix d'imprimante ou son adresse change dans les réglages. */
export function printerSettingsChanged(): void {
  printerStatus.value = idleStatus();
  if (canPrint()) void checkHealth();
}

async function send(
  ticket: EscPos,
  jobId: string,
  label: string,
  copies: number,
): Promise<Result<PrintResponse>> {
  const r = usesEpson()
    ? await eposPrint(
        data.value.settings.epsonIp,
        { bytes: ticket.toBytes(), preview: ticket.toPreview() },
        copies,
        { format: data.value.settings.epsonFormat },
      )
    : await sendPrint(config(), ticket.toBytes(), { jobId, copies, target: target(), label });
  if (r.ok) {
    const prev = printerStatus.value;
    printerStatus.value = {
      state: 'ok',
      message: 'Imprimante OK',
      health: prev.health,
      checkedAt: new Date(),
    };
  } else {
    printerStatus.value = statusFromError(r.error);
  }
  return r;
}

export function lastPrint(o: Order): PrintAttempt | undefined {
  return o.printLog[o.printLog.length - 1];
}

/** Commande dont le dernier essai d'impression a échoué. */
export const printFailed = (o: Order): boolean => lastPrint(o)?.ok === false;

function logAttempt(orderId: string, attempt: PrintAttempt): void {
  update((d) => ({
    ...d,
    orders: d.orders.map((o) =>
      o.id === orderId ? { ...o, printLog: [...o.printLog, attempt] } : o,
    ),
  }));
}

/** Imprime (ou réimprime) le ticket d'une commande et journalise le résultat. */
export async function printOrder(orderId: string): Promise<Result<PrintResponse>> {
  const order = data.value.orders.find((o) => o.id === orderId);
  if (!order) {
    return { ok: false, error: { kind: 'bad-response', message: 'Commande introuvable' } };
  }
  const s = data.value.settings;
  // Même jobId tant qu'aucun essai n'a réussi : si la réponse s'est perdue alors que le
  // ticket est sorti, la passerelle ignore le doublon.
  const successes = order.printLog.filter((p) => p.ok).length;
  const jobId = `${order.id}:${successes}`;
  const ticket = orderTicket(menu, order, { columns: s.columns, openDrawer: s.drawerEnabled });
  printingIds.value = new Set([...printingIds.value, orderId]);
  const r = await send(ticket, jobId, `Commande #${order.number} bipper ${order.bipper}`, s.copies);
  const rest = new Set(printingIds.value);
  rest.delete(orderId);
  printingIds.value = rest;
  logAttempt(
    orderId,
    r.ok
      ? { at: new Date().toISOString(), ok: true }
      : { at: new Date().toISOString(), ok: false, error: r.error.message },
  );
  return r;
}

/** Imprime une commande et, en cas d'échec, ouvre la feuille « Réessayer / Plus tard ». */
export async function printOrderWithPrompt(orderId: string): Promise<boolean> {
  const r = await printOrder(orderId);
  if (r.ok) {
    if (printFailure.value?.orderId === orderId) printFailure.value = null;
    return true;
  }
  printFailure.value = { orderId, message: r.error.message };
  return false;
}

/** Imprime, dans l'ordre, les tickets en échec (à la demande, jamais en silence). */
export async function printPending(): Promise<{ ok: number; failed: number }> {
  const pending = [...data.value.orders].reverse().filter(printFailed);
  let ok = 0;
  let failed = 0;
  for (const o of pending) {
    const r = await printOrder(o.id);
    if (r.ok) ok++;
    else {
      failed++;
      if (r.error.kind !== 'printer') break; // passerelle absente : inutile d'insister
    }
  }
  return { ok, failed };
}

export async function printTestTicket(kind: 'test' | 'charset'): Promise<Result<PrintResponse>> {
  const s = data.value.settings;
  const at = new Date();
  const epson = s.printerMode === 'epson';
  const ticket =
    kind === 'test'
      ? testTicket({
          columns: s.columns,
          printerIp: epson ? s.epsonIp : s.printerIp,
          printerPort: epson ? 443 : s.printerPort,
          at,
        })
      : charsetTicket({ columns: s.columns, at });
  return send(
    ticket,
    `${kind}-${at.getTime()}`,
    kind === 'test' ? 'Ticket de test' : 'Ticket caracteres',
    1,
  );
}

/** Envoi d'octets déjà construits (récap de journée…). */
export async function printRaw(ticket: EscPos, label: string): Promise<Result<PrintResponse>> {
  return send(ticket, `raw-${Date.now()}`, label, 1);
}

/**
 * Ticket client (détaillé, sur le modèle du ticket de caisse) ou note sans détail (total
 * seul) pour une commande. N'entre pas dans le journal d'impression de la commande.
 */
export async function printCustomerReceipt(
  orderId: string,
  kind: 'detailed' | 'total-only',
): Promise<Result<PrintResponse>> {
  const order = data.value.orders.find((o) => o.id === orderId);
  if (!order) {
    return { ok: false, error: { kind: 'bad-response', message: 'Commande introuvable' } };
  }
  const s = data.value.settings;
  const opts = {
    columns: s.columns,
    at: new Date(),
    header: s.receiptHeader,
    vatRates: s.vatRates,
  };
  const ticket =
    kind === 'detailed' ? customerTicket(menu, order, opts) : invoiceTicket(order, opts);
  const label = kind === 'detailed' ? 'Ticket client' : 'Note sans detail';
  return send(ticket, `receipt-${order.id}-${Date.now()}`, `${label} #${order.number}`, 1);
}

/** Fiche « changement des crêpes d'exposition » pour une semaine. */
export async function printCrepeRota(days: RotaDay[]): Promise<Result<PrintResponse>> {
  const s = data.value.settings;
  const ticket = crepeRotaTicket({
    columns: s.columns,
    days,
    weekdayName: s.crepeRota.weekdayName,
    weekendName: s.crepeRota.weekendName,
    at: new Date(),
  });
  return send(ticket, `rota-${days[0]?.key ?? ''}-${Date.now()}`, 'Planning crepes', 1);
}
