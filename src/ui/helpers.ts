import type { Category, Menu } from '../data/menu';
import { getCategory } from '../data/menu';
import type { OrderLine } from '../domain/cart';
import { formatCents } from '../domain/money';
import { minPrice } from '../domain/pricing';

/** Sous-titre utile d'une tuile : « 14 recettes · dès 6,50 € ». */
export function tileSubtitle(c: Category): string {
  const min = formatCents(minPrice(c));
  if (c.formats?.length) {
    const f = c.formats.map((x) => x.label);
    return `${f.join(' ou ')} · dès ${min}`;
  }
  if (c.countLabel) {
    const n = c.products.length;
    return `${n} ${n > 1 ? c.countLabel[1] : c.countLabel[0]} · dès ${min}`;
  }
  if (c.products.length > 1) {
    const prices = new Set(c.products.map((p) => p.price));
    return `${c.products.map((p) => p.name).join(' ou ')} · ${prices.size === 1 ? min : `dès ${min}`}`;
  }
  return min;
}

/** Icône d'une ligne de panier/commande. */
export function lineIcon(
  menu: Menu,
  l: Pick<OrderLine, 'categoryId' | 'productId' | 'options'>,
): string {
  const c = getCategory(menu, l.categoryId);
  if (!c) return '🧾';
  const p = c.products.find((x) => x.id === l.productId);
  if (p?.icon) return p.icon;
  const f = c.formats?.find((x) => x.label === l.options.format);
  return f?.icon ?? c.icon;
}

export const SERVICE_LABEL = { emporter: 'À emporter', surplace: 'Sur place' } as const;
export const SERVICE_ICON = { emporter: '🥡', surplace: '🍽️' } as const;

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Résumé court d'une commande : « 2× Tahiti M, Gaufre Chocolat ». */
export function orderSummary(lines: OrderLine[]): string {
  return lines
    .map((l) => {
      const size = l.options.size ? ` ${l.options.size.charAt(0)}` : '';
      return `${l.quantity > 1 ? `${l.quantity}× ` : ''}${l.displayName}${size}`;
    })
    .join(', ');
}
