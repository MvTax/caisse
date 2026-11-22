/**
 * État global de l'app (signals) + actions. Toute mutation passe par `update()` et est
 * sauvegardée immédiatement dans localStorage.
 */
import { effect, signal } from '@preact/signals';
import { MENU } from '../data/menu';
import { addToCart, removeLine, setQuantity } from '../domain/cart';
import { createOrder, setDone, type Order, type PaymentMethod } from '../domain/order';
import type { PricedItem } from '../domain/pricing';
import type { Cents } from '../domain/money';
import { browserStorage, loadData, saveData, type AppData } from '../storage/store';

export const menu = MENU;

const storage = browserStorage();
const loaded = loadData(storage);

export const data = signal<AppData>(loaded.data);
export const storageError = signal<string | null>(loaded.error ?? null);
export const importedFromV1 = loaded.importedFromV1;

effect(() => {
  storageError.value = saveData(storage, data.value);
});

export function update(fn: (d: AppData) => AppData): void {
  data.value = fn(data.value);
}

/** Horloge partagée (rafraîchie toutes les 30 s) pour « il y a 4 min ». */
export const now = signal(new Date());
if (typeof window !== 'undefined') {
  setInterval(() => (now.value = new Date()), 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') now.value = new Date();
  });
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Dernière ligne ajoutée au panier (pour l'animation de confirmation). */
export const lastAddedLineId = signal<string | null>(null);

export function addItem(item: PricedItem): void {
  const before = new Set(data.value.cart.map((l) => `${l.lineId}:${l.quantity}`));
  update((d) => ({ ...d, cart: addToCart(d.cart, item, newId) }));
  const changed = data.value.cart.find((l) => !before.has(`${l.lineId}:${l.quantity}`));
  lastAddedLineId.value = changed?.lineId ?? null;
}

export function setLineQuantity(lineId: string, qty: number): void {
  update((d) => ({ ...d, cart: setQuantity(d.cart, lineId, qty) }));
}

export function removeCartLine(lineId: string): void {
  update((d) => ({ ...d, cart: removeLine(d.cart, lineId) }));
}

export function clearCart(): void {
  update((d) => ({ ...d, cart: [] }));
}

export function validateOrder(input: {
  method: PaymentMethod;
  cashGiven: Cents | null;
  bipper: string;
}): Order {
  const d = data.value;
  const { order, counters } = createOrder({
    ...input,
    cart: d.cart,
    now: new Date(),
    counters: d.counters,
    id: newId(),
  });
  update((x) => ({
    ...x,
    orders: [order, ...x.orders],
    counters,
    cart: [],
    lastBipper: order.bipper,
  }));
  return order;
}

export function setOrderDone(id: string, done: boolean): void {
  const at = new Date();
  update((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? setDone(o, done, at) : o)) }));
}

export function deleteOrder(id: string): void {
  update((d) => ({ ...d, orders: d.orders.filter((o) => o.id !== id) }));
}

export function deleteDoneOrders(): number {
  const count = data.value.orders.filter((o) => o.status === 'done').length;
  update((d) => ({ ...d, orders: d.orders.filter((o) => o.status !== 'done') }));
  return count;
}

export function deleteAllOrders(): void {
  update((d) => ({ ...d, orders: [], counters: { day: '', lastNumber: 0 } }));
}

/* ---------- Toasts ---------- */

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'info' | 'error';
}
export const toast = signal<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(message: string, kind: Toast['kind'] = 'success'): void {
  clearTimeout(toastTimer);
  toast.value = { id: Date.now(), message, kind };
  toastTimer = setTimeout(() => (toast.value = null), 2200);
}
