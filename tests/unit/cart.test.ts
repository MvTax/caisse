import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import {
  addToCart,
  cartCount,
  cartTotal,
  lineLabel,
  removeLine,
  setQuantity,
  sortForKitchen,
  type Cart,
} from '../../src/domain/cart';
import { priceItem } from '../../src/domain/pricing';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;
let n = 0;
const id = () => `l${++n}`;

describe('panier', () => {
  const tahiti = priceItem(MENU, cat('smoothies'), { productId: 'tahiti', sizeId: 'moyen' });
  const gaufre = priceItem(MENU, cat('crepes'), {
    formatId: 'gaufre',
    toppingId: 'chocolat',
    supplementIds: ['chantilly', 'oreo'],
    service: 'emporter',
  });

  it('ajout, fusion des articles identiques, totaux', () => {
    let cart: Cart = [];
    cart = addToCart(cart, gaufre, id);
    cart = addToCart(cart, tahiti, id);
    cart = addToCart(cart, tahiti, id);
    expect(cart).toHaveLength(2);
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart)).toBe(585 + 675 * 2);
  });

  it('suppléments dans un ordre différent = même article', () => {
    const g2 = priceItem(MENU, cat('crepes'), {
      formatId: 'gaufre',
      toppingId: 'chocolat',
      supplementIds: ['oreo', 'chantilly'],
      service: 'emporter',
    });
    const cart = addToCart(addToCart([], gaufre, id), g2, id);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.quantity).toBe(2);
  });

  it('quantité et suppression', () => {
    let cart = addToCart([], tahiti, id);
    const lid = cart[0]!.lineId;
    cart = setQuantity(cart, lid, 3);
    expect(cartTotal(cart)).toBe(2025);
    cart = setQuantity(cart, lid, 0);
    expect(cart).toHaveLength(0);
    cart = addToCart([], tahiti, id);
    expect(removeLine(cart, cart[0]!.lineId)).toHaveLength(0);
  });

  it('libellés et ordre de préparation (boissons d’abord)', () => {
    let cart: Cart = [];
    cart = addToCart(cart, gaufre, id);
    cart = addToCart(
      cart,
      priceItem(MENU, cat('glaces'), { formatId: 'pot', sizeId: 'grand' }),
      id,
    );
    cart = addToCart(cart, tahiti, id);
    expect(sortForKitchen(MENU, cart).map(lineLabel)).toEqual([
      'Tahiti Moyen',
      'Gaufre Chocolat',
      'Glace Pot Grand',
    ]);
  });
});
