import { useEffect } from 'preact/hooks';
import {
  clearCart,
  data,
  lastAddedLineId,
  menu,
  removeCartLine,
  setLineQuantity,
} from '../app/state';
import { push, resetTo } from '../app/nav';
import { cartCount, cartTotal, lineLabel, lineTotal, type OrderLine } from '../domain/cart';
import { formatCents } from '../domain/money';
import { Icon } from './Icon';
import { lineIcon, plural, SERVICE_ICON, SERVICE_LABEL } from './helpers';
import { TopBar } from './TopBar';

export function LineOptions({ l }: { l: OrderLine }) {
  return (
    <>
      {l.options.supplements?.length ? (
        <span class="line-opts">+ {l.options.supplements.join(', ')}</span>
      ) : null}
      {l.options.service && (
        <span class={`badge badge-${l.options.service}`}>
          {SERVICE_ICON[l.options.service]} {SERVICE_LABEL[l.options.service]}
        </span>
      )}
    </>
  );
}

function CartLine({ l }: { l: OrderLine }) {
  const flash = lastAddedLineId.value === l.lineId;
  return (
    <li class={`cart-line${flash ? ' flash' : ''}`}>
      <span class="cart-line-icon">
        <Icon icon={lineIcon(menu, l)} size={30} />
      </span>
      <div class="cart-line-main">
        <span class="cart-line-name">{lineLabel(l)}</span>
        <LineOptions l={l} />
        <span class="cart-line-unit">{formatCents(l.unitPrice)} l’unité</span>
      </div>
      <div class="cart-line-side">
        <span class="cart-line-price">{formatCents(lineTotal(l))}</span>
        <div class="stepper" role="group" aria-label={`Quantité de ${lineLabel(l)}`}>
          <button
            type="button"
            aria-label={l.quantity > 1 ? 'Retirer un' : `Supprimer ${lineLabel(l)}`}
            onClick={() => setLineQuantity(l.lineId, l.quantity - 1)}
          >
            {l.quantity > 1 ? '−' : '🗑'}
          </button>
          <span class="stepper-qty" aria-live="polite">
            {l.quantity}
          </span>
          <button
            type="button"
            aria-label="Ajouter un"
            onClick={() => setLineQuantity(l.lineId, l.quantity + 1)}
          >
            +
          </button>
        </div>
      </div>
      {l.quantity > 1 && (
        <button
          type="button"
          class="cart-line-remove"
          aria-label={`Supprimer ${lineLabel(l)}`}
          onClick={() => removeCartLine(l.lineId)}
        >
          ✕
        </button>
      )}
    </li>
  );
}

export function Cart() {
  const cart = data.value.cart;
  useEffect(() => {
    if (!lastAddedLineId.value) return;
    const t = setTimeout(() => (lastAddedLineId.value = null), 900);
    return () => clearTimeout(t);
  }, []);
  const n = cartCount(cart);
  return (
    <div class="screen">
      <TopBar
        title="Panier"
        onBack={() => resetTo()}
        backLabel="Accueil"
        right={
          cart.length ? (
            <button
              type="button"
              class="topbar-action danger"
              onClick={() => {
                if (confirm('Vider le panier ?')) clearCart();
              }}
            >
              Vider
            </button>
          ) : null
        }
      />
      <main class="content">
        {cart.length === 0 ? (
          <div class="empty">
            <p class="empty-emoji" aria-hidden="true">
              🛒
            </p>
            <p>Le panier est vide.</p>
            <button type="button" class="btn btn-primary" onClick={() => resetTo()}>
              Commencer une commande
            </button>
          </div>
        ) : (
          <>
            <ul class="cart-lines">
              {cart.map((l) => (
                <CartLine key={l.lineId} l={l} />
              ))}
            </ul>
            <div class="total-box">
              <span>Total</span>
              <strong data-testid="cart-total">{formatCents(cartTotal(cart))}</strong>
            </div>
          </>
        )}
      </main>
      {cart.length > 0 && (
        <div class="bottom-actions">
          <button type="button" class="btn btn-secondary" onClick={() => resetTo()}>
            ＋ Ajouter
          </button>
          <button type="button" class="btn btn-primary" onClick={() => push({ name: 'checkout' })}>
            Valider · {plural(n, 'article', 'articles')} ›
          </button>
        </div>
      )}
    </div>
  );
}
