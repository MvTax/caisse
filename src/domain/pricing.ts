import type { Category, Menu, ServiceId, SizeOption } from '../data/menu';
import type { Cents } from './money';

/** Ce que l'employé a choisi pendant le parcours d'un article. */
export interface Selection {
  productId?: string;
  formatId?: string;
  sizeId?: string;
  toppingId?: string;
  supplementIds?: string[];
  service?: ServiceId;
}

/** Instantané lisible des options (stocké dans la commande, indépendant des futures modifs du menu). */
export interface LineOptions {
  size?: string;
  format?: string;
  topping?: string;
  supplements?: string[];
  /** Prix unitaire d'un supplément au moment de la vente. */
  supplementPrice?: Cents;
  service?: ServiceId;
  /** Parfum (glaces) : prévu pour plus tard, non utilisé pour l'instant. */
  flavor?: string;
}

export interface PricedItem {
  categoryId: string;
  productId: string;
  /** Nom sans la taille : « Tahiti », « Gaufre Chocolat », « Glace Cornet ». */
  displayName: string;
  options: LineOptions;
  unitPrice: Cents;
  sel: Selection;
}

export class PricingError extends Error {}

/** Tailles disponibles pour la sélection en cours (selon le format pour les glaces). */
export function availableSizes(category: Category, sel: Selection): SizeOption[] {
  if (category.formats && sel.formatId) {
    const f = category.formats.find((x) => x.id === sel.formatId);
    if (f?.sizes) return f.sizes;
  }
  return category.sizes ?? [];
}

/**
 * Calcule le prix et le libellé d'un article à partir des choix.
 * Lève PricingError si une étape obligatoire manque.
 */
export function priceItem(menu: Menu, category: Category, sel: Selection): PricedItem {
  const product =
    category.products.length === 1
      ? category.products[0]
      : category.products.find((p) => p.id === sel.productId);
  if (!product) throw new PricingError('Produit manquant');

  const options: LineOptions = {};
  let unitPrice: Cents;
  let displayName = product.name;

  const format = category.formats?.find((f) => f.id === sel.formatId);
  if (category.steps.includes('format')) {
    if (!format) throw new PricingError('Format manquant');
    options.format = format.label;
  }

  if (category.steps.includes('size')) {
    const size = availableSizes(category, sel).find((s) => s.id === sel.sizeId);
    if (!size) throw new PricingError('Taille manquante');
    options.size = size.label;
    unitPrice = size.price;
  } else if (product.price !== undefined) {
    unitPrice = product.price;
  } else if (category.basePrice !== undefined) {
    unitPrice = category.basePrice;
  } else {
    throw new PricingError(`Pas de prix pour ${product.name}`);
  }

  if (category.steps.includes('topping')) {
    const topping = category.toppings?.find((t) => t.id === sel.toppingId);
    if (!topping) throw new PricingError('Nappage manquant');
    options.topping = topping.label;
  }

  if (category.supplementGroup) {
    const group = menu.supplementGroups[category.supplementGroup];
    const ids = sel.supplementIds ?? [];
    const labels = ids.map((id) => {
      const item = group.items.find((i) => i.id === id);
      if (!item) throw new PricingError(`Supplément inconnu : ${id}`);
      return item.label;
    });
    if (labels.length) {
      options.supplements = labels;
      options.supplementPrice = group.unitPrice;
    }
    unitPrice += group.unitPrice * labels.length;
  }

  if (category.steps.includes('service')) {
    if (!sel.service) throw new PricingError('Service manquant');
    options.service = sel.service;
  }

  // Libellés : « Gaufre Chocolat », « Glace Cornet ».
  if (category.id === 'crepes' && format && options.topping) {
    displayName = `${format.label} ${options.topping}`;
  } else if (format) {
    displayName = `${product.name} ${format.label}`;
  }

  return {
    categoryId: category.id,
    productId: product.id,
    displayName,
    options,
    unitPrice,
    sel: normalizeSelection(sel),
  };
}

/** Sélection canonique (suppléments triés) pour pouvoir comparer deux articles. */
export function normalizeSelection(sel: Selection): Selection {
  const out: Selection = {};
  if (sel.productId) out.productId = sel.productId;
  if (sel.formatId) out.formatId = sel.formatId;
  if (sel.sizeId) out.sizeId = sel.sizeId;
  if (sel.toppingId) out.toppingId = sel.toppingId;
  if (sel.supplementIds?.length) out.supplementIds = [...sel.supplementIds].sort();
  if (sel.service) out.service = sel.service;
  return out;
}

/** Prix « dès » d'une catégorie, pour le sous-titre des tuiles. */
export function minPrice(category: Category): Cents {
  const prices: Cents[] = [];
  for (const p of category.products) if (p.price !== undefined) prices.push(p.price);
  for (const s of category.sizes ?? []) prices.push(s.price);
  for (const f of category.formats ?? []) for (const s of f.sizes ?? []) prices.push(s.price);
  if (category.basePrice !== undefined) prices.push(category.basePrice);
  return prices.length ? Math.min(...prices) : 0;
}
