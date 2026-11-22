import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import { addToCart, type Cart } from '../../src/domain/cart';
import { createOrder } from '../../src/domain/order';
import { priceItem, type Selection } from '../../src/domain/pricing';
import { computeStats } from '../../src/domain/stats';
import { renderPreview } from '../../src/printing/escpos';
import { charsetTicket, dayRecapTicket, orderTicket, testTicket } from '../../src/printing/ticket';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;
let n = 0;
const nid = () => `t${++n}`;
const add = (cart: Cart, c: string, sel: Selection, q = 1) =>
  addToCart(cart, priceItem(MENU, cat(c), sel), nid, q);

let cart: Cart = [];
cart = add(
  cart,
  'crepes',
  {
    formatId: 'gaufre',
    toppingId: 'chocolat',
    supplementIds: ['oreo', 'chantilly', 'kinder-bueno'],
    service: 'emporter',
  },
  2,
);
cart = add(cart, 'glaces', { formatId: 'pot', sizeId: 'grand' });
cart = add(cart, 'smoothies', { productId: 'passion-caraibe', sizeId: 'moyen' });
cart = add(cart, 'softs', { productId: 'eau' });
const at = new Date('2026-11-22T13:32:00Z'); // 14:32 à Paris
const order = createOrder({
  cart,
  method: 'cash',
  cashGiven: 5000,
  bipper: '7',
  now: at,
  counters: { day: '2026-11-22', lastNumber: 11 },
  id: 'o-12',
}).order;

const text = (lines: string[]) => lines.join('\n');

describe('ticket de préparation', () => {
  it.each([32, 42, 48])('aucune ligne ne dépasse %i colonnes', (columns) => {
    const p = orderTicket(MENU, order, { columns });
    for (const l of renderPreview(p.toPreview(), columns)) {
      expect(l.length, l).toBeLessThanOrEqual(columns);
    }
  });

  it('contenu : n°, bipper, boissons d’abord, options, total, rendu, mention non fiscale', () => {
    const t = text(renderPreview(orderTicket(MENU, order, { columns: 48 }).toPreview(), 48));
    expect(t).toContain('COMMANDE #12');
    expect(t).toContain('0077'); // « 07 » en quadruple largeur
    expect(t.indexOf('Passion Caraïbe')).toBeLessThan(t.indexOf('Gaufre'));
    expect(t.indexOf("Bouteille d'eau")).toBeLessThan(t.indexOf('Gaufre'));
    expect(t).toContain('2x Gaufre Chocolat');
    expect(t).toContain('+ Oreo, Chantilly, Kinder Bueno/White');
    expect(t).toContain('>> À EMPORTER <<');
    expect(t).toContain('Glace Pot Grand');
    expect(t).toContain('ESPÈCES');
    expect(t).toContain('50,00 €');
    expect(t).toContain('Ticket de préparation - non fiscal');
    expect(t).toContain('14:32 · 22/11/2026');
  });

  it('snapshot des octets (48 colonnes)', () => {
    const bytes = orderTicket(MENU, order, { columns: 48 }).toBytes();
    expect(Buffer.from(bytes).toString('base64')).toMatchSnapshot();
    expect(bytes[0]).toBe(0x1b);
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('aperçu lisible (48 colonnes)', () => {
    expect(
      text(renderPreview(orderTicket(MENU, order, { columns: 48 }).toPreview(), 48)),
    ).toMatchSnapshot();
  });

  it('tiroir-caisse uniquement si activé et payé en espèces', () => {
    const tail = (b: Uint8Array) => [...b.slice(-5)];
    expect(tail(orderTicket(MENU, order, { columns: 48, openDrawer: true }).toBytes())).toEqual([
      0x1b, 0x70, 0x00, 0x19, 0xfa,
    ]);
    expect(tail(orderTicket(MENU, order, { columns: 48 }).toBytes())).not.toEqual([
      0x1b, 0x70, 0x00, 0x19, 0xfa,
    ]);
  });
});

describe('tickets de test', () => {
  it.each([32, 42, 48])('ticket de test %i colonnes : règle de largeur exacte', (columns) => {
    const lines = renderPreview(
      testTicket({ columns, printerIp: '192.168.1.200', printerPort: 9100, at }).toPreview(),
      columns,
    );
    expect(lines).toContain('1234567890'.repeat(5).slice(0, columns));
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(columns);
    expect(text(lines)).toContain('192.168.1.200:9100');
  });

  it('snapshot octets du ticket de test', () => {
    const b = testTicket({
      columns: 48,
      printerIp: '192.168.1.200',
      printerPort: 9100,
      at,
    }).toBytes();
    expect(Buffer.from(b).toString('base64')).toMatchSnapshot();
  });

  it('ticket caractères : € encodé 0xD5, pas d’emoji', () => {
    const b = charsetTicket({ columns: 48, at }).toBytes();
    expect(b.includes(0xd5)).toBe(true);
    expect(text(renderPreview(charsetTicket({ columns: 48, at }).toPreview(), 48))).not.toMatch(
      /\p{Extended_Pictographic}/u,
    );
  });

  it('récap journée', () => {
    const t = text(
      renderPreview(
        dayRecapTicket({
          columns: 42,
          title: 'Dimanche 22/11/2026',
          stats: computeStats(MENU, [order]),
          at,
        }).toPreview(),
        42,
      ),
    );
    expect(t).toContain('RÉCAPITULATIF');
    expect(t).toContain('Récapitulatif - non fiscal');
    expect(t).toMatch(/Espèces \(1\) +\d/);
  });
});
