import { describe, expect, it } from 'vitest';
import { breakdown, computeChange } from '../../src/domain/change';

describe('computeChange', () => {
  it('rien saisi', () => expect(computeChange(1260, null)).toEqual({ status: 'none' }));
  it('à rendre', () =>
    expect(computeChange(1260, 2000)).toEqual({ status: 'change', amount: 740 }));
  it('compte juste', () => expect(computeChange(1260, 1260)).toEqual({ status: 'exact' }));
  it('manque', () => expect(computeChange(1260, 1000)).toEqual({ status: 'missing', amount: 260 }));
});

describe('breakdown (glouton)', () => {
  it('3,50 € → 2 € + 1 € + 50 c', () => {
    expect(breakdown(350)).toEqual([
      { value: 200, count: 1, kind: 'pièce' },
      { value: 100, count: 1, kind: 'pièce' },
      { value: 50, count: 1, kind: 'pièce' },
    ]);
  });
  it('7,40 € → 5 € + 2 € + 20 c + 20 c', () => {
    expect(breakdown(740)).toEqual([
      { value: 500, count: 1, kind: 'billet' },
      { value: 200, count: 1, kind: 'pièce' },
      { value: 20, count: 2, kind: 'pièce' },
    ]);
  });
  it('la somme reconstitue toujours le montant', () => {
    for (let a = 0; a <= 10000; a += 7) {
      expect(breakdown(a).reduce((s, c) => s + c.value * c.count, 0)).toBe(a);
    }
  });
  it('0 → rien', () => expect(breakdown(0)).toEqual([]));
});
