import type { Menu } from '../data/menu';
import { getCategory } from '../data/menu';
import type { Cents } from './money';
import type { LineOptions, PricedItem, Selection } from './pricing';

export interface OrderLine {
  lineId: string;
  categoryId: string;
  productId: string;
  displayName: string;
  options: LineOptions;
  unitPrice: Cents;
  quantity: number;
  /** Choix d'origine (ids) : sert à fusionner deux articles identiques. Absent pour les données v1. */
  sel?: Selection;
}

export type Cart = OrderLine[];

const sameItem = (a: OrderLine, b: PricedItem): boolean =>
  !!a.sel &&
  a.categoryId === b.categoryId &&
  a.unitPrice === b.unitPrice &&
  JSON.stringify(a.sel) === JSON.stringify(b.sel);

/** Ajoute un article ; s'il est identique à une ligne existante, incrémente la quantité. */
export function addToCart(cart: Cart, item: PricedItem, newId: () => string, qty = 1): Cart {
  const existing = cart.find((l) => sameItem(l, item));
  if (existing) {
    return cart.map((l) => (l === existing ? { ...l, quantity: l.quantity + qty } : l));
  }
  return [...cart, { lineId: newId(), ...item, quantity: qty }];
}

export function setQuantity(cart: Cart, lineId: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, lineId);
  return cart.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.floor(quantity) } : l));
}

export function removeLine(cart: Cart, lineId: string): Cart {
  return cart.filter((l) => l.lineId !== lineId);
}

export const lineTotal = (l: OrderLine): Cents => l.unitPrice * l.quantity;

export function cartTotal(cart: Cart): Cents {
  return cart.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function cartCount(cart: Cart): number {
  return cart.reduce((sum, l) => sum + l.quantity, 0);
}

/** « Tahiti Moyen », « Glace Pot Grand », « Gaufre Chocolat ». */
export function lineLabel(l: Pick<OrderLine, 'displayName' | 'options'>): string {
  return l.options.size ? `${l.displayName} ${l.options.size}` : l.displayName;
}

/** Trie les lignes dans l'ordre de préparation (boissons d'abord). */
export function sortForKitchen(menu: Menu, lines: OrderLine[]): OrderLine[] {
  const rank = (l: OrderLine) => getCategory(menu, l.categoryId)?.ticketOrder ?? 99;
  return [...lines].sort((a, b) => rank(a) - rank(b));
}
