import { data, menu } from '../app/state';
import { push } from '../app/nav';
import { cartCount, cartTotal } from '../domain/cart';
import { formatCents } from '../domain/money';
import type { Category } from '../data/menu';
import { Icon } from './Icon';
import { plural, tileSubtitle } from './helpers';
import { openCategory } from './openCategory';
import { PrinterPill } from './PrinterPill';

export function Header() {
  return (
    <header class="brand">
      <div class="brand-row">
        <p class="logo" aria-label="MA+ Commander">
          MA+ <span class="logo-sub">Commander</span>
        </p>
        <div class="brand-actions">
          <PrinterPill />
          <button
            type="button"
            class="round-btn"
            aria-label="Statistiques"
            onClick={() => push({ name: 'stats' })}
          >
            📊
          </button>
          <button
            type="button"
            class="round-btn"
            aria-label="Réglages"
            onClick={() => push({ name: 'settings' })}
          >
            ⚙️
          </button>
        </div>
      </div>
    </header>
  );
}

export function CategoryTile({ c, wide }: { c: Category; wide?: boolean }) {
  return (
    <button
      type="button"
      class={`tile${wide ? ' tile-wide' : ''}`}
      style={{ '--accent': c.accent }}
      onClick={() => openCategory(c)}
    >
      <span class="tile-icon">
        <Icon icon={c.icon} size={wide ? 34 : 40} />
      </span>
      <span class="tile-text">
        <span class="tile-title">{c.label}</span>
        <span class="tile-sub">{tileSubtitle(c)}</span>
      </span>
    </button>
  );
}

export function CartBanner() {
  const cart = data.value.cart;
  if (!cart.length) return null;
  return (
    <button type="button" class="cart-banner" onClick={() => push({ name: 'cart' })}>
      <span aria-hidden="true">🛒</span>
      <span class="cart-banner-text">
        Panier en cours : {plural(cartCount(cart), 'article', 'articles')} ·{' '}
        <strong>{formatCents(cartTotal(cart))}</strong>
      </span>
      <span class="cart-banner-go">Voir ›</span>
    </button>
  );
}

export function Home() {
  const drinks = menu.categories.filter((c) => c.group === 'boissons');
  const others = menu.categories.filter((c) => c.group !== 'boissons');
  const drinkCount = drinks.reduce((n, c) => n + c.products.length, 0);
  return (
    <div class="screen home">
      <Header />
      <main class="content">
        <CartBanner />
        <button
          type="button"
          class="tile tile-hero"
          style={{ '--accent': '#00b4a6' }}
          onClick={() => push({ name: 'drinks' })}
        >
          <span class="tile-icon tile-hero-icons" aria-hidden="true">
            <span>🥤</span>
            <span>🧋</span>
            <span>🍦</span>
          </span>
          <span class="tile-text">
            <span class="tile-title">Boissons</span>
            <span class="tile-sub">
              Smoothies, Bubble Tea, Milkshakes, Jus, Sodas · {drinkCount} boissons
            </span>
          </span>
          <span class="tile-chevron" aria-hidden="true">
            ›
          </span>
        </button>
        <div class="tile-grid">
          {others.map((c) => (
            <CategoryTile key={c.id} c={c} />
          ))}
        </div>
      </main>
    </div>
  );
}
