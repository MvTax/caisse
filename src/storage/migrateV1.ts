/**
 * Import des données de l'ancienne version (fichier unique MA_Commander_v1.html).
 * Format v1 (clé `ma_commander_v2`) :
 *   { orders: [{ id: Date.now(), items: [{ cat, catLabel, item, size, price: "6,50€", supplements?, service? }],
 *                bipper, done, time: "14:32", payment: 'cash'|'card'|null, cashGiven: 20 (euros, nombre),
 *                change: 13.5 }], autoPrint, bridgeIp, printerIp, printerPort }
 */
import { MENU, type ServiceId } from '../data/menu';
import type { OrderLine } from '../domain/cart';
import { parseCentsInput, type Cents } from '../domain/money';
import type { Counters, Order, Payment } from '../domain/order';
import { dayKey } from '../domain/time';
import type { Settings } from './settings';

export const V1_KEY = 'ma_commander_v2';

interface V1Item {
  cat?: string;
  catLabel?: string;
  item?: string;
  size?: string;
  price?: string | number;
  supplements?: string[];
  service?: string | null;
}
interface V1Order {
  id?: number;
  items?: V1Item[];
  bipper?: string | number;
  done?: boolean;
  time?: string;
  payment?: string | null;
  cashGiven?: number | string | null;
  change?: number | string | null;
}
interface V1Data {
  orders?: V1Order[];
  autoPrint?: boolean;
  printerIp?: string;
  printerPort?: number | string;
  bridgeIp?: string;
}

/** "6,50€", "6.50", 6.5 → 650 centimes, sans parseFloat. */
export function v1MoneyToCents(v: unknown): Cents | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    // toFixed(2) produit une chaîne exacte au centime, ensuite parsée sans flottant.
    return parseCentsInput(Math.abs(v).toFixed(2));
  }
  return parseCentsInput(String(v));
}

const SERVICE_MAP: Record<string, ServiceId> = {
  'À emporter': 'emporter',
  'Sur place': 'surplace',
};

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function convertItem(it: V1Item, index: number, orderId: string): OrderLine {
  const categoryId = it.cat ?? 'inconnu';
  const name = it.item ?? '?';
  const cat = MENU.categories.find((c) => c.id === categoryId);
  const product = cat?.products.find((p) => p.name === name);
  const options: OrderLine['options'] = {};
  let displayName = name;

  if (it.supplements?.length) {
    options.supplements = [...it.supplements];
    options.supplementPrice = 95;
  }
  const service = it.service ? SERVICE_MAP[it.service] : undefined;
  if (service) options.service = service;

  if (categoryId === 'crepes') {
    // v1 : size = suppléments joints ou "Nature" ; item = "Gaufre Chocolat".
    const fmt = /^(Crêpe|Gaufre)\b/.exec(name);
    if (fmt) options.format = fmt[1];
  } else if (categoryId === 'glaces') {
    // v1 : item = "Glace Cornet Grand", size = "Grand".
    const m = /^Glace (Cornet|Pot)(?: (.+))?$/.exec(name);
    if (m) {
      options.format = m[1];
      displayName = `Glace ${m[1]}`;
      if (m[2] ?? it.size) options.size = m[2] ?? it.size;
    }
  } else if (it.size && it.size !== '–' && it.size !== '-') {
    options.size = it.size;
  }

  return {
    lineId: `${orderId}-${index}`,
    categoryId,
    productId: product?.id ?? slug(name),
    displayName,
    options,
    unitPrice: v1MoneyToCents(it.price) ?? 0,
    quantity: 1,
  };
}

export function migrateV1(data: V1Data): {
  orders: Order[];
  counters: Counters;
  settings: Partial<Settings>;
} {
  const src = Array.isArray(data.orders) ? data.orders : [];
  const converted = src
    .filter((o) => typeof o.id === 'number')
    .map((o) => {
      const id = `v1-${o.id}`;
      const lines = (o.items ?? []).map((it, i) => convertItem(it, i, id));
      const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      const payment: Payment = {
        method: o.payment === 'cash' || o.payment === 'card' ? o.payment : 'unknown',
      };
      const given = v1MoneyToCents(o.cashGiven);
      if (payment.method === 'cash' && given !== null && given > 0) {
        payment.cashGiven = given;
        payment.change = Math.max(0, given - total);
      }
      const createdAt = new Date(o.id as number).toISOString();
      const order: Order = {
        id,
        number: 0,
        bipper: String(o.bipper ?? ''),
        createdAt,
        lines,
        total,
        payment,
        status: o.done ? 'done' : 'pending',
        printLog: [],
        legacy: true,
      };
      if (o.done) order.doneAt = createdAt;
      return order;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Renumérotation par jour (heure de Paris).
  let counters: Counters = { day: '', lastNumber: 0 };
  for (const o of converted) {
    const day = dayKey(new Date(o.createdAt));
    counters = { day, lastNumber: counters.day === day ? counters.lastNumber + 1 : 1 };
    o.number = counters.lastNumber;
  }

  const settings: Partial<Settings> = {};
  if (typeof data.autoPrint === 'boolean') settings.autoPrint = data.autoPrint;
  if (data.printerIp) settings.printerIp = data.printerIp;
  if (data.printerPort && Number.isInteger(Number(data.printerPort)))
    settings.printerPort = Number(data.printerPort);
  if (data.bridgeIp) settings.bridgeHost = data.bridgeIp;

  // Plus récentes d'abord, comme dans l'app.
  return { orders: converted.reverse(), counters, settings };
}
