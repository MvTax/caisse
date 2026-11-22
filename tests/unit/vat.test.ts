import { describe, expect, it } from 'vitest';
import { formatRate, htFromTtc, vatSummary } from '../../src/domain/vat';

describe('TVA', () => {
  it('ticket de caisse réel : 2 eaux à 2,20 € à 5,5 % → TVA 0,23 €, HT 4,17 €', () => {
    const s = vatSummary([
      { ttc: 220, rate: 550 },
      { ttc: 220, rate: 550 },
    ]);
    expect(s.groups).toEqual([{ rate: 550, ttc: 440, ht: 417, vat: 23 }]);
    expect(s.total).toEqual({ ttc: 440, ht: 417, vat: 23 });
  });

  it('plusieurs taux : groupes triés, HT + TVA = TTC au centime près', () => {
    const s = vatSummary([
      { ttc: 1360, rate: 1000 },
      { ttc: 675, rate: 550 },
      { ttc: 450, rate: 1000 },
    ]);
    expect(s.groups.map((g) => g.rate)).toEqual([550, 1000]);
    for (const g of s.groups) expect(g.ht + g.vat).toBe(g.ttc);
    expect(s.total.ttc).toBe(2485);
    expect(htFromTtc(1810, 1000)).toBe(1645); // 18,10 / 1,10 = 16,4545…
  });

  it('formatage du taux', () => {
    expect(formatRate(550)).toBe('5,5');
    expect(formatRate(1000)).toBe('10');
    expect(formatRate(2000)).toBe('20');
  });
});
