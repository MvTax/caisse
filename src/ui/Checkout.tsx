import { useEffect, useRef, useState } from 'preact/hooks';
import { data, menu, showToast, validateOrder } from '../app/state';
import { pop, resetTo } from '../app/nav';
import { cartTotal, lineLabel, lineTotal, sortForKitchen } from '../domain/cart';
import { breakdown, computeChange, QUICK_CASH_AMOUNTS } from '../domain/change';
import { formatCents, formatDenomination, parseCentsInput, centsToInput } from '../domain/money';
import {
  bipperInUse,
  busyBippers,
  nextBipper,
  OrderError,
  type PaymentMethod,
} from '../domain/order';
import { canPrint, printOrderWithPrompt } from '../printing/printService';
import { TopBar } from './TopBar';

export function Checkout() {
  const d = data.value;
  const total = cartTotal(d.cart);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cashText, setCashText] = useState('');
  const [bipper, setBipper] = useState('');
  const cashRef = useRef<HTMLInputElement>(null);
  const bipperRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (method === 'cash') cashRef.current?.focus();
    else if (method === 'card' && !data.value.settings.bippers.length) bipperRef.current?.focus();
  }, [method]);

  if (!d.cart.length) {
    return (
      <div class="screen">
        <TopBar title="Encaissement" onBack={pop} />
        <main class="content">
          <p class="empty">Le panier est vide.</p>
        </main>
      </div>
    );
  }

  const given = parseCentsInput(cashText);
  const cashInvalid = cashText.trim() !== '' && given === null;
  const change = method === 'cash' ? computeChange(total, given) : { status: 'none' as const };
  const bipperList = d.settings.bippers;
  const busy = busyBippers(d.orders);
  const suggestion = nextBipper(d.lastBipper);
  const inUse = bipperInUse(d.orders, bipper);

  const missing: string[] = [];
  if (!method) missing.push('le mode de paiement');
  if (!bipper.trim()) missing.push('le numéro de bipper');
  const blocked = missing.length > 0 || change.status === 'missing' || cashInvalid;

  const submit = () => {
    if (!method || blocked) return;
    try {
      const order = validateOrder({ method, cashGiven: method === 'cash' ? given : null, bipper });
      showToast(`Commande #${order.number} · Bipper ${order.bipper}`);
      resetTo();
      if (d.settings.autoPrint && canPrint()) {
        void printOrderWithPrompt(order.id).then((ok) => {
          if (ok) showToast(`🖨️ Commande #${order.number} imprimée · Bipper ${order.bipper}`);
        });
      }
    } catch (e) {
      showToast(e instanceof OrderError ? e.message : 'Erreur inattendue', 'error');
    }
  };

  return (
    <div class="screen checkout">
      <TopBar title="Encaissement" onBack={pop} backLabel="Panier" />
      <main class="content">
        <section class="card recap" aria-label="Récapitulatif">
          <ul>
            {sortForKitchen(menu, d.cart).map((l) => (
              <li key={l.lineId}>
                <span>
                  {l.quantity > 1 && <b>{l.quantity}× </b>}
                  {lineLabel(l)}
                </span>
                <span>{formatCents(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
          <div class="recap-total">
            <span>Total</span>
            <strong data-testid="checkout-total">{formatCents(total)}</strong>
          </div>
        </section>

        <h2 class="section-title">Paiement</h2>
        <div class="pay-methods" role="radiogroup" aria-label="Mode de paiement">
          {(
            [
              ['card', '💳', 'Carte'],
              ['cash', '💶', 'Espèces'],
            ] as const
          ).map(([m, icon, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              class={`pay-btn${method === m ? ' selected' : ''}`}
              onClick={() => setMethod(m)}
            >
              <span class="pay-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <section class="card cash">
            <label class="field-label" for="cash-input">
              Montant donné par le client
            </label>
            <div class="money-input">
              <input
                id="cash-input"
                ref={cashRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={cashText}
                onInput={(e) => setCashText(e.currentTarget.value)}
              />
              <span aria-hidden="true">€</span>
            </div>
            <div class="quick-cash">
              {QUICK_CASH_AMOUNTS.map((a) => (
                <button key={a} type="button" onClick={() => setCashText(centsToInput(a))}>
                  {formatDenomination(a)}
                </button>
              ))}
              <button type="button" class="exact" onClick={() => setCashText(centsToInput(total))}>
                Compte juste
              </button>
            </div>
            <div aria-live="polite">
              {cashInvalid && <p class="change-box missing">Montant non reconnu</p>}
              {change.status === 'change' && (
                <div class="change-box ok" data-testid="change">
                  <span>À rendre</span>
                  <strong>{formatCents(change.amount)}</strong>
                  <ul class="coins" aria-label="Décomposition du rendu">
                    {breakdown(change.amount).map((c) => (
                      <li key={c.value} class={c.kind === 'billet' ? 'bill' : 'coin'}>
                        {c.count} × {formatDenomination(c.value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {change.status === 'exact' && (
                <p class="change-box exact" data-testid="change">
                  Compte juste, rien à rendre
                </p>
              )}
              {change.status === 'missing' && (
                <div class="change-box missing" data-testid="change">
                  <span>Manque</span>
                  <strong>{formatCents(change.amount)}</strong>
                </div>
              )}
            </div>
          </section>
        )}

        <h2 class="section-title" id="bipper-title">
          Bipper
        </h2>
        {bipperList.length > 0 && (
          <div class="bipper-grid" role="radiogroup" aria-labelledby="bipper-title">
            {bipperList.map((b) => {
              const isBusy = busy.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={bipper === b}
                  aria-label={`Bipper ${b}${isBusy ? ' (déjà remis)' : ''}`}
                  class={`bipper-choice${bipper === b ? ' selected' : ''}${isBusy ? ' busy' : ''}`}
                  onClick={() => setBipper(b)}
                >
                  {b}
                </button>
              );
            })}
          </div>
        )}
        <div class="bipper-row">
          <label class="field-label" for="bipper-input">
            {bipperList.length ? 'Autre numéro' : 'Numéro de bipper'}
          </label>
          <input
            id="bipper-input"
            ref={bipperRef}
            class="bipper-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={4}
            placeholder="N°"
            value={bipper}
            onInput={(e) => setBipper(e.currentTarget.value.replace(/\D/g, ''))}
          />
          {bipperList.length === 0 && suggestion !== bipper && (
            <button type="button" class="btn btn-secondary" onClick={() => setBipper(suggestion)}>
              {d.lastBipper ? `Suivant : ${suggestion}` : `Bipper ${suggestion}`}
            </button>
          )}
        </div>
        {inUse && (
          <p class="warning" role="status">
            ⚠️ Le bipper {inUse.bipper} est déjà sur la commande #{inUse.number} (en cours).
          </p>
        )}
      </main>
      <div class="bottom-actions single">
        {missing.length > 0 && <p class="missing-hint">Il manque {missing.join(' et ')}.</p>}
        <button type="button" class="btn btn-success btn-block" disabled={blocked} onClick={submit}>
          ✅ Valider la commande
        </button>
      </div>
    </div>
  );
}
