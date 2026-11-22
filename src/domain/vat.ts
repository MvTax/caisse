/**
 * TVA du ticket client. Les prix de la carte sont TTC ; on en déduit HT et TVA par taux,
 * calculés sur le total de chaque taux (comme le ticket de caisse : 4,40 € à 5,5 % →
 * HT 4,17 €, TVA 0,23 €). Taux en points de base : 550 = 5,5 %.
 */
import type { Cents } from './money';

export type VatRate = number;

export const VAT_CHOICES: VatRate[] = [550, 1000, 2000];

export interface VatGroup {
  rate: VatRate;
  ttc: Cents;
  ht: Cents;
  vat: Cents;
}

export interface VatSummary {
  groups: VatGroup[];
  total: { ttc: Cents; ht: Cents; vat: Cents };
}

/** HT d'un montant TTC, arrondi au centime le plus proche. */
export function htFromTtc(ttc: Cents, rate: VatRate): Cents {
  return Math.round((ttc * 10000) / (10000 + rate));
}

export function vatSummary(items: { ttc: Cents; rate: VatRate }[]): VatSummary {
  const byRate = new Map<VatRate, Cents>();
  for (const i of items) byRate.set(i.rate, (byRate.get(i.rate) ?? 0) + i.ttc);
  const groups = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, ttc]) => {
      const ht = htFromTtc(ttc, rate);
      return { rate, ttc, ht, vat: ttc - ht };
    });
  const sum = (k: 'ttc' | 'ht' | 'vat') => groups.reduce((s, g) => s + g[k], 0);
  return { groups, total: { ttc: sum('ttc'), ht: sum('ht'), vat: sum('vat') } };
}

/** 550 → "5,5" ; 1000 → "10" ; 2000 → "20". */
export function formatRate(rate: VatRate): string {
  return (rate / 100).toString().replace('.', ',');
}

export const isVatRate = (v: unknown): v is VatRate =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000;
