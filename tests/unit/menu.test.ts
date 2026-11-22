import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;

describe('menu (CLAUDE.md §8)', () => {
  it('nombre de produits par catégorie', () => {
    expect(cat('smoothies').products).toHaveLength(14);
    expect(cat('bubble').products).toHaveLength(8);
    expect(cat('milkshake').products).toHaveLength(5);
    expect(cat('jus').products).toHaveLength(5);
    expect(cat('softs').products).toHaveLength(2);
    expect(cat('donuts').products).toHaveLength(2);
    expect(cat('sandwich').products).toHaveLength(1);
    expect(MENU.supplementGroups.crepes.items).toHaveLength(10);
    expect(cat('crepes').toppings).toHaveLength(5);
  });

  it('orthographe de la carte conservée', () => {
    const names = MENU.categories.flatMap((c) => c.products.map((p) => p.name));
    expect(names).toContain('Manatthan');
    expect(names).toContain("Bouteille d'eau");
    expect(names).toContain('Coco des Îles');
  });

  it('tous les prix sont des centimes entiers positifs', () => {
    const prices: number[] = [];
    for (const c of MENU.categories) {
      for (const p of c.products) if (p.price !== undefined) prices.push(p.price);
      for (const s of c.sizes ?? []) prices.push(s.price);
      for (const f of c.formats ?? []) for (const s of f.sizes ?? []) prices.push(s.price);
      if (c.basePrice !== undefined) prices.push(c.basePrice);
    }
    expect(prices.length).toBeGreaterThan(10);
    for (const p of prices) expect(Number.isInteger(p) && p > 0).toBe(true);
  });

  it('ids uniques par catégorie', () => {
    for (const c of MENU.categories) {
      const ids = c.products.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('chaque étape a un titre, jamais « boisson » hors boissons', () => {
    for (const c of MENU.categories) {
      for (const s of c.steps) expect(c.stepTitles[s]).toBeTruthy();
      if (c.group !== 'boissons') {
        for (const t of Object.values(c.stepTitles)) expect(t).not.toMatch(/boisson/i);
      }
    }
  });
});
