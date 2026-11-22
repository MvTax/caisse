import { addItem, menu, showToast } from '../app/state';
import { push, resetTo } from '../app/nav';
import type { Category } from '../data/menu';
import { lineLabel } from '../domain/cart';
import { startFlow } from '../domain/flow';
import { priceItem, type Selection } from '../domain/pricing';

/** Termine le parcours : ajoute l'article et ouvre le panier. */
export function finishItem(c: Category, sel: Selection): void {
  const item = priceItem(menu, c, sel);
  addItem(item);
  resetTo({ name: 'cart' });
  showToast(`${lineLabel(item)} ajouté`);
}

export function openCategory(c: Category): void {
  const r = startFlow(c);
  if (r.kind === 'done') finishItem(c, r.sel);
  else push({ name: 'flow', state: r.state });
}
