import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import { addToCart, type Cart } from '../../src/domain/cart';
import {
  bipperInUse,
  busyBippers,
  parseBipperList,
  createOrder,
  nextBipper,
  nextOrderNumber,
  OrderError,
  setDone,
} from '../../src/domain/order';
import { priceItem } from '../../src/domain/pricing';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;
let n = 0;
const nid = () => `x${++n}`;
const cart: Cart = addToCart(
  addToCart([], priceItem(MENU, cat('smoothies'), { productId: 'tahiti', sizeId: 'moyen' }), nid),
  priceItem(MENU, cat('crepes'), {
    formatId: 'gaufre',
    toppingId: 'chocolat',
    supplementIds: ['oreo', 'chantilly'],
    service: 'emporter',
  }),
  nid,
);
// 14:32 à Paris le 22/11/2026 (UTC+1).
const now = new Date('2026-11-22T13:32:00Z');

describe('numéro de commande du jour', () => {
  it('incrémente le même jour, repart à 1 le lendemain (heure de Paris)', () => {
    let r = nextOrderNumber({ day: '', lastNumber: 0 }, now);
    expect(r.number).toBe(1);
    r = nextOrderNumber(r.counters, now);
    expect(r.number).toBe(2);
    // 23h30 UTC le 22 = 00h30 le 23 à Paris → nouveau jour.
    expect(nextOrderNumber(r.counters, new Date('2026-11-22T23:30:00Z')).number).toBe(1);
  });
});

describe('createOrder', () => {
  const base = {
    cart,
    now,
    counters: { day: '2026-11-22', lastNumber: 11 },
    id: 'o1',
    bipper: ' 7 ',
  };

  it('espèces avec rendu', () => {
    const { order, counters } = createOrder({ ...base, method: 'cash', cashGiven: 2000 });
    expect(order.number).toBe(12);
    expect(counters.lastNumber).toBe(12);
    expect(order.bipper).toBe('7');
    expect(order.total).toBe(1260);
    expect(order.payment).toEqual({ method: 'cash', cashGiven: 2000, change: 740 });
    expect(order.status).toBe('pending');
  });

  it('carte', () => {
    expect(createOrder({ ...base, method: 'card', cashGiven: null }).order.payment).toEqual({
      method: 'card',
    });
  });

  it('espèces sans montant saisi : accepté, pas de rendu', () => {
    expect(createOrder({ ...base, method: 'cash', cashGiven: null }).order.payment).toEqual({
      method: 'cash',
    });
  });

  it('refuse : montant insuffisant, bipper vide, panier vide', () => {
    expect(() => createOrder({ ...base, method: 'cash', cashGiven: 1000 })).toThrow(OrderError);
    expect(() => createOrder({ ...base, bipper: ' ', method: 'card', cashGiven: null })).toThrow(
      OrderError,
    );
    expect(() => createOrder({ ...base, cart: [], method: 'card', cashGiven: null })).toThrow(
      OrderError,
    );
  });

  it('terminer / rouvrir', () => {
    const { order } = createOrder({ ...base, method: 'card', cashGiven: null });
    const done = setDone(order, true, now);
    expect(done.status).toBe('done');
    expect(done.doneAt).toBe(now.toISOString());
    const reopened = setDone(done, false, now);
    expect(reopened.status).toBe('pending');
    expect(reopened.doneAt).toBeUndefined();
  });
});

describe('bippers', () => {
  it('liste saisie librement → numéros uniques triés', () => {
    expect(parseBipperList('13/19/24/14/29/27/6/18/22/28/21')).toEqual([
      '6',
      '13',
      '14',
      '18',
      '19',
      '21',
      '22',
      '24',
      '27',
      '28',
      '29',
    ]);
    expect(parseBipperList(' 06, 6 ; 12 0 ')).toEqual(['6', '12']);
    expect(parseBipperList('')).toEqual([]);
  });

  it('suivant', () => {
    expect(nextBipper(undefined)).toBe('1');
    expect(nextBipper('7')).toBe('8');
    expect(nextBipper('abc')).toBe('1');
  });
  it('déjà utilisé par une commande en cours', () => {
    const { order } = createOrder({
      cart,
      now,
      counters: { day: '', lastNumber: 0 },
      id: 'a',
      bipper: '7',
      method: 'card',
      cashGiven: null,
    });
    expect(bipperInUse([order], '7')?.id).toBe('a');
    expect(bipperInUse([setDone(order, true, now)], '7')).toBeUndefined();
    expect(bipperInUse([order], '8')).toBeUndefined();
    expect([...busyBippers([order])]).toEqual(['7']);
    expect(busyBippers([setDone(order, true, now)]).size).toBe(0);
  });
});
