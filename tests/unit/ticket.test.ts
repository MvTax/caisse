import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import { addToCart, type Cart } from '../../src/domain/cart';
import { createOrder } from '../../src/domain/order';
import { priceItem, type Selection } from '../../src/domain/pricing';
import { computeStats } from '../../src/domain/stats';
import { formatCents } from '../../src/domain/money';
import { DEFAULT_RECEIPT_HEADER, DEFAULT_VAT_RATES } from '../../src/storage/settings';
import { renderPreview } from '../../src/printing/escpos';
import {
  charsetTicket,
  dayRecapTicket,
  customerTicket,
  invoiceTicket,
  orderTicket,
  testTicket,
} from '../../src/printing/ticket';

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

const receipt = (columns: number) => ({
  columns,
  at: new Date('2026-11-22T15:00:00Z'),
  header: DEFAULT_RECEIPT_HEADER,
  vatRates: DEFAULT_VAT_RATES,
});
const show = (p: { toPreview(): Parameters<typeof renderPreview>[0] }, columns = 48) =>
  text(renderPreview(p.toPreview(), columns));

describe('ticket client (modèle ticket de caisse)', () => {
  it.each([32, 42, 48])('aucune ligne ne dépasse %i colonnes', (columns) => {
    for (const p of [
      customerTicket(MENU, order, receipt(columns)),
      invoiceTicket(order, receipt(columns)),
    ]) {
      for (const l of renderPreview(p.toPreview(), columns)) {
        expect(l.length, l).toBeLessThanOrEqual(columns);
      }
    }
  });

  it('en-tête de la boutique, articles en colonnes, total, règlement, TVA', () => {
    const t = show(customerTicket(MENU, order, receipt(48)));
    expect(t).toContain('Mangos Creteil Soleil');
    expect(t).toContain('94000 CRÉTEIL - France');
    expect(t).toContain('SIRET:839 932 977 00029');
    expect(t).toMatch(/TICKET N°12 +le 22\/11\/2026 14:32/);
    expect(t).toMatch(/Qté +PU TTC +Prix TTC +TVA/);
    expect(t).toMatch(/Bouteille d'eau +1 +2,20 +2,20 +5,5/);
    expect(t).toMatch(/Gaufre Chocolat +2 +6,80 +13,60 +10/);
    expect(t).toContain("Nombre total d'articles : 5 / 4 ligne(s)");
    expect(t).toMatch(/TOTAL TTC :/);
    expect(t).toMatch(/REGLEMENT : Espèces +50,00 €/);
    expect(t).toMatch(/Rendu +\S+ €/);
    expect(t).toMatch(/TVA +MT TVA +MT HT +MT TTC/);
    expect(t).toMatch(/^5,5% /m);
    expect(t).toMatch(/^10% /m);
    expect(t).toContain('Ticket client - non fiscal');
    // Sans les détails de préparation, sans imitation du ticket certifié.
    for (const hidden of ['Oreo', 'EMPORTER', 'BIPPER', 'NF525', 'COMMANDE #']) {
      expect(t, hidden).not.toContain(hidden);
    }
  });

  it('paiement carte', () => {
    const card = { ...order, payment: { method: 'card' as const } };
    expect(show(customerTicket(MENU, card, receipt(48)))).toMatch(
      new RegExp(`REGLEMENT : Carte bancaire +${formatCents(order.total).replace(/\s/g, '\\s')}`),
    );
  });

  it('32 colonnes : nom sur sa ligne, chiffres en dessous', () => {
    const t = show(customerTicket(MENU, order, receipt(32)), 32);
    expect(t).toMatch(/Bouteille d'eau\n +1 +2,20 +2,20 +5,5/);
  });

  it('pas d’ouverture du tiroir, coupe finale', () => {
    for (const p of [customerTicket(MENU, order, receipt(48)), invoiceTicket(order, receipt(48))]) {
      const bytes = [...p.toBytes()];
      expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
      expect(bytes.some((b, i) => b === 0x1b && bytes[i + 1] === 0x70)).toBe(false);
    }
  });
});

describe('note sans détail', () => {
  it('total et TVA seulement : ni articles, ni paiement, ni bipper', () => {
    const t = show(invoiceTicket(order, receipt(48)));
    expect(t).toContain('Mangos Creteil Soleil');
    expect(t).toContain('NOTE');
    expect(t).toContain('sans détail');
    expect(t).toContain('N°12');
    expect(t).toContain('22/11/2026 14:32');
    expect(t).toMatch(/Consommations +\S+ €/);
    expect(t).toMatch(/TVA +MT TVA +MT HT +MT TTC/);
    expect(t).toContain('non fiscal');
    for (const hidden of [
      'Gaufre',
      'Passion',
      'Oreo',
      'Glace',
      'Bouteille',
      'Espèces',
      'Carte',
      'Rendu',
      'BIPPER',
      'EMPORTER',
    ]) {
      expect(t, hidden).not.toContain(hidden);
    }
  });
});
