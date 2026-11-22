import type { Cart, OrderLine } from './cart';
import { cartTotal } from './cart';
import { computeChange } from './change';
import type { Cents } from './money';
import { dayKey } from './time';

export type PaymentMethod = 'card' | 'cash';

export interface Payment {
  /** 'unknown' : commandes importées de la v1 sans mode de paiement. */
  method: PaymentMethod | 'unknown';
  cashGiven?: Cents;
  change?: Cents;
}

export interface PrintAttempt {
  at: string;
  ok: boolean;
  error?: string;
}

export interface Order {
  id: string;
  /** Numéro séquentiel du jour (remis à 1 chaque jour, heure de Paris). */
  number: number;
  bipper: string;
  createdAt: string;
  lines: OrderLine[];
  total: Cents;
  payment: Payment;
  status: 'pending' | 'done';
  doneAt?: string;
  printLog: PrintAttempt[];
  /** Importée depuis l'ancienne version. */
  legacy?: boolean;
}

export interface Counters {
  day: string;
  lastNumber: number;
}

export function nextOrderNumber(
  counters: Counters,
  now: Date,
): { number: number; counters: Counters } {
  const day = dayKey(now);
  const number = counters.day === day ? counters.lastNumber + 1 : 1;
  return { number, counters: { day, lastNumber: number } };
}

export class OrderError extends Error {}

export interface NewOrderInput {
  cart: Cart;
  method: PaymentMethod;
  cashGiven: Cents | null;
  bipper: string;
  now: Date;
  counters: Counters;
  id: string;
}

/** Valide le panier et crée la commande. Lève OrderError si la commande est incomplète. */
export function createOrder(input: NewOrderInput): { order: Order; counters: Counters } {
  const bipper = input.bipper.trim();
  if (!input.cart.length) throw new OrderError('Panier vide');
  if (!bipper) throw new OrderError('Numéro de bipper manquant');
  const total = cartTotal(input.cart);
  const payment: Payment = { method: input.method };
  if (input.method === 'cash' && input.cashGiven !== null) {
    const ch = computeChange(total, input.cashGiven);
    if (ch.status === 'missing') throw new OrderError('Montant reçu insuffisant');
    payment.cashGiven = input.cashGiven;
    payment.change = ch.status === 'change' ? ch.amount : 0;
  }
  const { number, counters } = nextOrderNumber(input.counters, input.now);
  return {
    counters,
    order: {
      id: input.id,
      number,
      bipper,
      createdAt: input.now.toISOString(),
      lines: input.cart.map((l) => ({ ...l, options: { ...l.options } })),
      total,
      payment,
      status: 'pending',
      printLog: [],
    },
  };
}

export function setDone(order: Order, done: boolean, now: Date): Order {
  if (done) return { ...order, status: 'done', doneAt: now.toISOString() };
  const { doneAt: _ignored, ...rest } = order;
  void _ignored;
  return { ...rest, status: 'pending' };
}

/** Bipper déjà utilisé par une commande non terminée ? (avertissement, non bloquant) */
export function bipperInUse(orders: Order[], bipper: string): Order | undefined {
  const b = bipper.trim();
  return b ? orders.find((o) => o.status === 'pending' && o.bipper === b) : undefined;
}

/** Bipper suivant : dernier + 1 (utilisé seulement si aucune liste de bippers n'est réglée). */
export function nextBipper(last: string | undefined): string {
  const n = Number(last);
  if (!last || !Number.isInteger(n) || n < 1) return '1';
  return String(n + 1);
}

/**
 * Liste de bippers saisie librement (« 13/19, 24 14 ») → numéros uniques triés : ['13', '14', …].
 * Les zéros en tête sont retirés (« 06 » = « 6 »).
 */
export function parseBipperList(text: string): string[] {
  const nums = (text.match(/\d+/g) ?? []).map((n) => String(Number(n))).filter((n) => n !== '0');
  return [...new Set(nums)].sort((a, b) => Number(a) - Number(b));
}

/** Bippers actuellement remis à un client (commandes non terminées). */
export function busyBippers(orders: Order[]): Set<string> {
  return new Set(orders.filter((o) => o.status === 'pending').map((o) => o.bipper));
}

export function itemCount(order: Pick<Order, 'lines'>): number {
  return order.lines.reduce((s, l) => s + l.quantity, 0);
}
