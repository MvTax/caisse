import { data, menu } from '../app/state';
import { pop, push, replace } from '../app/nav';
import { getCategory, type Category, type StepKind } from '../data/menu';
import { cartCount, cartTotal } from '../domain/cart';
import {
  back,
  choose,
  confirmSupplements,
  currentStep,
  stepTitle,
  toggleSupplement,
  type FlowResult,
  type FlowState,
} from '../domain/flow';
import { formatCents } from '../domain/money';
import { availableSizes, priceItem } from '../domain/pricing';
import { Icon } from './Icon';
import { finishItem } from './openCategory';
import { plural } from './helpers';
import { TopBar } from './TopBar';

const STEP_SHORT: Record<StepKind, string> = {
  product: 'Choix',
  format: 'Format',
  size: 'Taille',
  topping: 'Nappage',
  supplements: 'Suppléments',
  service: 'Service',
};

function StepIndicator({ c, index }: { c: Category; index: number }) {
  if (c.steps.length < 2) return null;
  return (
    <ol class="steps" aria-label={`Étape ${index + 1} sur ${c.steps.length}`}>
      {c.steps.map((s, i) => (
        <li
          key={s}
          class={i === index ? 'current' : i < index ? 'done' : ''}
          aria-current={i === index ? 'step' : undefined}
        >
          {STEP_SHORT[s]}
        </li>
      ))}
    </ol>
  );
}

function MiniCart() {
  const cart = data.value.cart;
  if (!cart.length) return null;
  return (
    <button type="button" class="mini-cart" onClick={() => push({ name: 'cart' })}>
      <span aria-hidden="true">🛒</span> {plural(cartCount(cart), 'article', 'articles')} ·{' '}
      <strong>{formatCents(cartTotal(cart))}</strong>
      <span class="mini-cart-go">Panier ›</span>
    </button>
  );
}

function apply(c: Category, r: FlowResult) {
  if (r.kind === 'done') finishItem(c, r.sel);
  else replace({ name: 'flow', state: r.state });
}

export function Flow({ state }: { state: FlowState }) {
  const c = getCategory(menu, state.categoryId);
  if (!c) return null;
  const step = currentStep(c, state);
  if (!step) return null;
  const onBack = () => {
    const prev = back(state);
    if (prev) replace({ name: 'flow', state: prev }, 'back');
    else pop();
  };
  const pick = (value: string) => apply(c, choose(c, state, value));

  return (
    <div class="screen flow" style={{ '--accent': c.accent }}>
      <TopBar title={c.label} onBack={onBack} accent={c.accent} />
      <main class="content">
        <StepIndicator c={c} index={state.stepIndex} />
        <h2 class="step-title">{stepTitle(c, step)}</h2>
        {step === 'product' && (
          <ul class="choice-list">
            {c.products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  class={`choice-row${state.sel.productId === p.id ? ' selected' : ''}`}
                  onClick={() => pick(p.id)}
                >
                  {p.icon && <Icon icon={p.icon} size={30} />}
                  <span class="choice-text">
                    <span class="choice-name">{p.name}</span>
                    {p.description && <span class="choice-desc">{p.description}</span>}
                  </span>
                  {p.price !== undefined && (
                    <span class="choice-price">{formatCents(p.price)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {step === 'format' && (
          <div class="card-choices">
            {c.formats?.map((f) => {
              const sizes = f.sizes ?? [];
              const min = sizes.length ? Math.min(...sizes.map((s) => s.price)) : undefined;
              return (
                <button
                  key={f.id}
                  type="button"
                  class={`big-card${state.sel.formatId === f.id ? ' selected' : ''}`}
                  onClick={() => pick(f.id)}
                >
                  <Icon icon={f.icon} size={48} />
                  <span class="big-card-label">{f.label}</span>
                  {min !== undefined && <span class="big-card-price">dès {formatCents(min)}</span>}
                </button>
              );
            })}
          </div>
        )}
        {step === 'size' && (
          <div class="card-choices">
            {availableSizes(c, state.sel).map((s, i, all) => (
              <button
                key={s.id}
                type="button"
                class={`big-card size-card${state.sel.sizeId === s.id ? ' selected' : ''}`}
                style={{ '--scale': String(0.75 + (0.25 * (i + 1)) / all.length) }}
                onClick={() => pick(s.id)}
              >
                <span class="size-glyph" aria-hidden="true" />
                <span class="big-card-label">{s.label}</span>
                <span class="big-card-price">{formatCents(s.price)}</span>
              </button>
            ))}
          </div>
        )}
        {step === 'topping' && (
          <div class="grid-2">
            {c.toppings?.map((t) => (
              <button
                key={t.id}
                type="button"
                class={`pill-choice${state.sel.toppingId === t.id ? ' selected' : ''}`}
                onClick={() => pick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {step === 'supplements' && c.supplementGroup && <Supplements c={c} state={state} />}
        {step === 'service' && (
          <div class="card-choices">
            {menu.services.map((s) => (
              <button
                key={s.id}
                type="button"
                class={`big-card${state.sel.service === s.id ? ' selected' : ''}`}
                onClick={() => pick(s.id)}
              >
                <Icon icon={s.icon} size={48} />
                <span class="big-card-label">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      {step !== 'supplements' && <MiniCart />}
    </div>
  );
}

function Supplements({ c, state }: { c: Category; state: FlowState }) {
  const group = menu.supplementGroups[c.supplementGroup ?? 'crepes'];
  const selected = state.sel.supplementIds ?? [];
  // Prix en direct (sans le service, pas encore choisi).
  const live = priceItem(menu, { ...c, steps: c.steps.filter((s) => s !== 'service') }, state.sel);
  return (
    <>
      <p class="hint">{formatCents(group.unitPrice)} chacun · plusieurs choix possibles</p>
      <div class="grid-2">
        {group.items.map((it) => {
          const on = selected.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              class={`check-choice${on ? ' selected' : ''}`}
              onClick={() => replace({ name: 'flow', state: toggleSupplement(state, it.id) })}
            >
              <span class="check-box" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
      <div class="sticky-actions">
        <div class="live-total">
          <span>{live.displayName}</span>
          <strong>{formatCents(live.unitPrice)}</strong>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-block"
          onClick={() => apply(c, confirmSupplements(c, state))}
        >
          {selected.length
            ? `Continuer · ${plural(selected.length, 'supplément', 'suppléments')} ›`
            : 'Sans supplément ›'}
        </button>
      </div>
    </>
  );
}
