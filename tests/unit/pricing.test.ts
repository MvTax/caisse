import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import { minPrice, priceItem, PricingError } from '../../src/domain/pricing';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;

describe('priceItem', () => {
  it.each(['smoothies', 'bubble', 'milkshake', 'jus'])('%s : 650 / 675 / 695', (id) => {
    const c = cat(id);
    const productId = c.products[0]!.id;
    expect(priceItem(MENU, c, { productId, sizeId: 'petit' }).unitPrice).toBe(650);
    expect(priceItem(MENU, c, { productId, sizeId: 'moyen' }).unitPrice).toBe(675);
    expect(priceItem(MENU, c, { productId, sizeId: 'grand' }).unitPrice).toBe(695);
  });

  it('smoothie : libellé et taille', () => {
    const p = priceItem(MENU, cat('smoothies'), { productId: 'tahiti', sizeId: 'moyen' });
    expect(p.displayName).toBe('Tahiti');
    expect(p.options.size).toBe('Moyen');
  });

  it('taille obligatoire pour les boissons préparées', () => {
    expect(() => priceItem(MENU, cat('smoothies'), { productId: 'tahiti' })).toThrow(PricingError);
  });

  it('sodas & eau', () => {
    expect(priceItem(MENU, cat('softs'), { productId: 'soft' }).unitPrice).toBe(250);
    const eau = priceItem(MENU, cat('softs'), { productId: 'eau' });
    expect(eau.unitPrice).toBe(220);
    expect(eau.displayName).toBe("Bouteille d'eau");
  });

  it('donuts, muffins, sandwich', () => {
    expect(priceItem(MENU, cat('donuts'), { productId: 'donut' }).unitPrice).toBe(395);
    expect(priceItem(MENU, cat('donuts'), { productId: 'muffin' }).unitPrice).toBe(395);
    expect(priceItem(MENU, cat('sandwich'), {}).unitPrice).toBe(695);
  });

  describe('crêpes & gaufres : 395 + 95 × suppléments', () => {
    const base = { formatId: 'gaufre', toppingId: 'chocolat', service: 'surplace' as const };
    it.each([
      [[], 395],
      [['oreo'], 490],
      [['oreo', 'chantilly', 'banane', 'fraise', 'framboise'], 870],
    ])('%j → %i', (supplementIds, price) => {
      expect(priceItem(MENU, cat('crepes'), { ...base, supplementIds }).unitPrice).toBe(price);
    });
    it('libellé « Gaufre Chocolat » + options', () => {
      const p = priceItem(MENU, cat('crepes'), { ...base, supplementIds: ['oreo', 'chantilly'] });
      expect(p.displayName).toBe('Gaufre Chocolat');
      expect(p.options).toMatchObject({
        format: 'Gaufre',
        topping: 'Chocolat',
        supplements: ['Oreo', 'Chantilly'],
        supplementPrice: 95,
        service: 'surplace',
      });
    });
    it('nappage et service obligatoires', () => {
      expect(() =>
        priceItem(MENU, cat('crepes'), { formatId: 'crepe', service: 'emporter' }),
      ).toThrow();
      expect(() =>
        priceItem(MENU, cat('crepes'), { formatId: 'crepe', toppingId: 'sucre' }),
      ).toThrow();
    });
  });

  describe('glaces', () => {
    it.each([
      ['cornet', 'petit', 350],
      ['cornet', 'moyen', 395],
      ['cornet', 'grand', 450],
      ['pot', 'moyen', 395],
      ['pot', 'grand', 450],
    ])('%s %s → %i', (formatId, sizeId, price) => {
      const p = priceItem(MENU, cat('glaces'), { formatId, sizeId });
      expect(p.unitPrice).toBe(price);
      expect(p.displayName).toBe(`Glace ${formatId === 'pot' ? 'Pot' : 'Cornet'}`);
    });
    it('pas de petit pot', () => {
      expect(() => priceItem(MENU, cat('glaces'), { formatId: 'pot', sizeId: 'petit' })).toThrow();
    });
  });
});

describe('minPrice (sous-titres des tuiles)', () => {
  it('dès …', () => {
    expect(minPrice(cat('smoothies'))).toBe(650);
    expect(minPrice(cat('softs'))).toBe(220);
    expect(minPrice(cat('glaces'))).toBe(350);
    expect(minPrice(cat('crepes'))).toBe(395);
  });
});
