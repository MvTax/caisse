import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import { addToCart, type Cart } from '../../src/domain/cart';
import { createOrder, setDone, type Order } from '../../src/domain/order';
import { priceItem, type Selection } from '../../src/domain/pricing';
import { computeStats, filterOrders, periodRange } from '../../src/domain/stats';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;
let n = 0;
const nid = () => `i${++n}`;
const item = (c: string, sel: Selection) => priceItem(MENU, cat(c), sel);

function order(
  iso: string,
  lines: [string, Selection, number][],
  method: 'card' | 'cash',
  done = false,
): Order {
  let cart: Cart = [];
  for (const [c, sel, q] of lines) cart = addToCart(cart, item(c, sel), nid, q);
  const o = createOrder({
    cart,
    method,
    cashGiven: null,
    bipper: '1',
    now: new Date(iso),
    counters: { day: '', lastNumber: 0 },
    id: nid(),
  }).order;
  return done ? setDone(o, true, new Date(iso)) : o;
}

// Fixture : 3 commandes le 22/11 (Paris), 1 le 21/11.
const orders: Order[] = [
  // 22/11 10:15 Paris (09:15 UTC) — 2 Tahiti M + 1 Tahiti G, carte. 675*2 + 695 = 2045
  order(
    '2026-11-22T09:15:00Z',
    [
      ['smoothies', { productId: 'tahiti', sizeId: 'moyen' }, 2],
      ['smoothies', { productId: 'tahiti', sizeId: 'grand' }, 1],
    ],
    'card',
    true,
  ),
  // 22/11 14:05 Paris — Gaufre Chocolat + Oreo + Chantilly sur place, glace pot grand, eau. 585 + 450 + 220 = 1255
  order(
    '2026-11-22T13:05:00Z',
    [
      [
        'crepes',
        {
          formatId: 'gaufre',
          toppingId: 'chocolat',
          supplementIds: ['oreo', 'chantilly'],
          service: 'surplace',
        },
        1,
      ],
      ['glaces', { formatId: 'pot', sizeId: 'grand' }, 1],
      ['softs', { productId: 'eau' }, 1],
    ],
    'cash',
  ),
  // 22/11 14:40 Paris — 2 crêpes sucre à emporter avec Oreo. (395+95)*2 = 980
  order(
    '2026-11-22T13:40:00Z',
    [
      [
        'crepes',
        { formatId: 'crepe', toppingId: 'sucre', supplementIds: ['oreo'], service: 'emporter' },
        2,
      ],
    ],
    'cash',
  ),
  // 21/11 23:30 Paris (22:30 UTC) — cornet petit. 350
  order('2026-11-21T22:30:00Z', [['glaces', { formatId: 'cornet', sizeId: 'petit' }, 1]], 'card'),
];

const now = new Date('2026-11-22T17:00:00Z');

describe('périodes (Europe/Paris)', () => {
  it('aujourd’hui / hier / 7 jours / tout', () => {
    expect(filterOrders(orders, periodRange('today', now))).toHaveLength(3);
    expect(filterOrders(orders, periodRange('yesterday', now))).toHaveLength(1);
    expect(filterOrders(orders, periodRange('7days', now))).toHaveLength(4);
    expect(filterOrders(orders, periodRange('all', now))).toHaveLength(4);
  });
  it('une commande à 00h30 heure de Paris compte pour le nouveau jour', () => {
    const late = order('2026-11-22T23:30:00Z', [['softs', { productId: 'soft' }, 1]], 'card');
    expect(filterOrders([late], periodRange('today', now))).toHaveLength(0);
    expect(filterOrders([late], { from: '2026-11-23', to: '2026-11-23' })).toHaveLength(1);
  });
});

describe('computeStats sur la journée du 22/11', () => {
  const s = computeStats(MENU, filterOrders(orders, periodRange('today', now)));

  it('KPI', () => {
    expect(s.revenue).toBe(2045 + 1255 + 980);
    expect(s.orderCount).toBe(3);
    expect(s.doneCount).toBe(1);
    expect(s.itemCount).toBe(3 + 3 + 2);
    expect(s.avgBasket).toBe(1427); // 4280 / 3 = 1426,67 → 1427
    expect(s.itemsPerOrderX10).toBe(27); // 8/3 = 2,7
  });

  it('paiement', () => {
    expect(s.payment.card).toEqual({ count: 1, revenue: 2045 });
    expect(s.payment.cash).toEqual({ count: 2, revenue: 2235 });
    expect(s.cashCollected).toBe(2235);
  });

  it('par produit avec détail par taille', () => {
    const tahiti = s.byProduct.find((p) => p.name === 'Tahiti')!;
    expect(tahiti.qty).toBe(3);
    expect(tahiti.revenue).toBe(2045);
    expect(tahiti.bySize).toEqual({ Moyen: 2, Grand: 1 });
    expect(s.byProduct[0]!.name).toBe('Tahiti');
    expect(s.byProduct.map((p) => p.name)).toContain('Crêpe Sucre');
  });

  it('par catégorie', () => {
    const crepes = s.byCategory.find((c) => c.categoryId === 'crepes')!;
    expect(crepes).toMatchObject({ qty: 3, revenue: 585 + 980, label: 'Crêpes & Gaufres' });
    expect(s.byCategory[0]!.categoryId).toBe('smoothies');
    expect(s.byCategory.reduce((a, c) => a + c.revenue, 0)).toBe(s.revenue);
  });

  it('suppléments, service, glaces', () => {
    expect(s.supplements).toEqual([
      { label: 'Oreo', qty: 3 },
      { label: 'Chantilly', qty: 1 },
    ]);
    expect(s.supplementRevenue).toBe(95 * 4);
    expect(s.service).toEqual({ emporter: 2, surplace: 1 });
    expect(s.glaces).toEqual({ Pot: { Grand: 1 } });
  });

  it('affluence par heure (heure de Paris)', () => {
    expect(s.byHour[10]).toBe(1);
    expect(s.byHour[14]).toBe(2);
    expect(s.peakHour).toBe(14);
  });

  it('période vide', () => {
    const e = computeStats(MENU, []);
    expect(e.revenue).toBe(0);
    expect(e.avgBasket).toBe(0);
    expect(e.peakHour).toBeNull();
  });
});
