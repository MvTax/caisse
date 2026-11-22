import type { Cents } from './money';

export type ChangeResult =
  | { status: 'none' }
  | { status: 'exact' }
  | { status: 'change'; amount: Cents }
  | { status: 'missing'; amount: Cents };

/** Monnaie à rendre. `given` null = rien saisi. */
export function computeChange(total: Cents, given: Cents | null): ChangeResult {
  if (given === null) return { status: 'none' };
  const diff = given - total;
  if (diff === 0) return { status: 'exact' };
  if (diff > 0) return { status: 'change', amount: diff };
  return { status: 'missing', amount: -diff };
}

/** Coupures euro, de la plus grande à la plus petite (billets ≥ 5 €). */
export const DENOMINATIONS: Cents[] = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export const QUICK_CASH_AMOUNTS: Cents[] = [500, 1000, 2000, 5000];

export interface Coin {
  value: Cents;
  count: number;
  kind: 'billet' | 'pièce';
}

/** Décomposition gloutonne du rendu en billets/pièces. */
export function breakdown(amount: Cents): Coin[] {
  const out: Coin[] = [];
  let rest = amount;
  for (const value of DENOMINATIONS) {
    const count = Math.floor(rest / value);
    if (count > 0) {
      out.push({ value, count, kind: value >= 500 ? 'billet' : 'pièce' });
      rest -= count * value;
    }
  }
  return out;
}
