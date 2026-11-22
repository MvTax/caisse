import type { Menu } from '../data/menu';
import { getCategory } from '../data/menu';
import { lineTotal } from './cart';
import type { Cents } from './money';
import type { Order } from './order';
import { addDays, dayKey, shopHour } from './time';

export type Period = 'today' | 'yesterday' | '7days' | 'all';

/** Plage de jours inclusive ("YYYY-MM-DD"), heure de Paris. Bornes absentes = illimité. */
export interface DayRange {
  from?: string;
  to?: string;
}

export function periodRange(period: Period, now: Date): DayRange {
  const today = dayKey(now);
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case '7days':
      return { from: addDays(today, -6), to: today };
    case 'all':
      return {};
  }
}

export function filterOrders(orders: Order[], range: DayRange): Order[] {
  return orders.filter((o) => {
    const d = dayKey(new Date(o.createdAt));
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  });
}

export interface Stats {
  revenue: Cents;
  orderCount: number;
  doneCount: number;
  itemCount: number;
  avgBasket: Cents;
  /** Articles par commande × 10 (une décimale, sans flottant stocké). */
  itemsPerOrderX10: number;
  payment: Record<'card' | 'cash' | 'unknown', { count: number; revenue: Cents }>;
  cashCollected: Cents;
  byCategory: {
    categoryId: string;
    label: string;
    qty: number;
    revenue: Cents;
    sharePct: number;
  }[];
  byProduct: {
    key: string;
    categoryId: string;
    name: string;
    qty: number;
    revenue: Cents;
    bySize: Record<string, number>;
  }[];
  supplements: { label: string; qty: number }[];
  supplementRevenue: Cents;
  service: { emporter: number; surplace: number };
  /** Glaces : format → taille → quantité. */
  glaces: Record<string, Record<string, number>>;
  byHour: number[];
  peakHour: number | null;
}

export function computeStats(menu: Menu, orders: Order[]): Stats {
  const s: Stats = {
    revenue: 0,
    orderCount: orders.length,
    doneCount: 0,
    itemCount: 0,
    avgBasket: 0,
    itemsPerOrderX10: 0,
    payment: {
      card: { count: 0, revenue: 0 },
      cash: { count: 0, revenue: 0 },
      unknown: { count: 0, revenue: 0 },
    },
    cashCollected: 0,
    byCategory: [],
    byProduct: [],
    supplements: [],
    supplementRevenue: 0,
    service: { emporter: 0, surplace: 0 },
    glaces: {},
    byHour: Array.from({ length: 24 }, () => 0),
    peakHour: null,
  };
  const cats = new Map<string, { qty: number; revenue: Cents }>();
  const prods = new Map<string, Stats['byProduct'][number]>();
  const supps = new Map<string, number>();

  for (const o of orders) {
    s.revenue += o.total;
    if (o.status === 'done') s.doneCount++;
    const pm = s.payment[o.payment.method];
    pm.count++;
    pm.revenue += o.total;
    if (o.payment.method === 'cash') s.cashCollected += o.total;
    const h = shopHour(new Date(o.createdAt));
    s.byHour[h] = (s.byHour[h] ?? 0) + 1;

    for (const l of o.lines) {
      const rev = lineTotal(l);
      s.itemCount += l.quantity;
      const c = cats.get(l.categoryId) ?? { qty: 0, revenue: 0 };
      c.qty += l.quantity;
      c.revenue += rev;
      cats.set(l.categoryId, c);

      const key = `${l.categoryId}|${l.displayName}`;
      const p = prods.get(key) ?? {
        key,
        categoryId: l.categoryId,
        name: l.displayName,
        qty: 0,
        revenue: 0,
        bySize: {},
      };
      p.qty += l.quantity;
      p.revenue += rev;
      if (l.options.size) p.bySize[l.options.size] = (p.bySize[l.options.size] ?? 0) + l.quantity;
      prods.set(key, p);

      for (const sup of l.options.supplements ?? []) {
        supps.set(sup, (supps.get(sup) ?? 0) + l.quantity);
        s.supplementRevenue += (l.options.supplementPrice ?? 0) * l.quantity;
      }
      if (l.options.service) s.service[l.options.service] += l.quantity;
      if (l.categoryId === 'glaces' && l.options.format && l.options.size) {
        const f = (s.glaces[l.options.format] ??= {});
        f[l.options.size] = (f[l.options.size] ?? 0) + l.quantity;
      }
    }
  }

  if (s.orderCount) {
    s.avgBasket = Math.round(s.revenue / s.orderCount);
    s.itemsPerOrderX10 = Math.round((s.itemCount * 10) / s.orderCount);
  }
  s.byCategory = [...cats.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      label: getCategory(menu, categoryId)?.label ?? categoryId,
      ...v,
      sharePct: s.revenue ? Math.round((v.revenue * 100) / s.revenue) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  s.byProduct = [...prods.values()].sort(
    (a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name, 'fr'),
  );
  s.supplements = [...supps.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, 'fr'));
  const max = Math.max(...s.byHour);
  s.peakHour = max > 0 ? s.byHour.indexOf(max) : null;
  return s;
}
