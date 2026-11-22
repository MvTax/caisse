import { useEffect } from 'preact/hooks';
import { deleteOrder, menu, setOrderDone, showToast } from '../app/state';
import { lineLabel, lineTotal, sortForKitchen } from '../domain/cart';
import { formatCents } from '../domain/money';
import type { Order } from '../domain/order';
import { formatDate, formatTime } from '../domain/time';
import { LineOptions } from './Cart';
import { Icon } from './Icon';
import { lineIcon } from './helpers';
import { canPrint, printingIds, printOrderWithPrompt } from '../printing/printService';

const METHOD_LABEL = { card: '💳 Carte', cash: '💶 Espèces', unknown: 'Non renseigné' } as const;

/** Fiche détail d'une commande, en panneau qui monte du bas (bottom-sheet). */
export function OrderSheet({ order: o, onClose }: { order: Order; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const created = new Date(o.createdAt);
  const done = o.status === 'done';
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Commande ${o.number}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-grabber" aria-hidden="true" />
        <div class="sheet-head">
          <div>
            <h2>Commande #{o.number}</h2>
            <p class="muted">
              {formatDate(created)} à {formatTime(created)}
              {done && o.doneAt && ` · servie à ${formatTime(new Date(o.doneAt))}`}
            </p>
          </div>
          <button type="button" class="round-btn light" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div class="sheet-bipper" aria-label={`Bipper ${o.bipper}`}>
          <span>Bipper</span>
          <strong>{o.bipper}</strong>
        </div>
        <ul class="sheet-lines">
          {sortForKitchen(menu, o.lines).map((l) => (
            <li key={l.lineId}>
              <Icon icon={lineIcon(menu, l)} size={26} />
              <div class="cart-line-main">
                <span class="cart-line-name">
                  {l.quantity > 1 && <b>{l.quantity}× </b>}
                  {lineLabel(l)}
                </span>
                <LineOptions l={l} />
              </div>
              <span>{formatCents(lineTotal(l))}</span>
            </li>
          ))}
        </ul>
        <div class="sheet-pay">
          <div class="row">
            <span>Total</span>
            <strong>{formatCents(o.total)}</strong>
          </div>
          <div class="row">
            <span>Paiement</span>
            <span>{METHOD_LABEL[o.payment.method]}</span>
          </div>
          {o.payment.cashGiven !== undefined && (
            <>
              <div class="row">
                <span>Reçu</span>
                <span>{formatCents(o.payment.cashGiven)}</span>
              </div>
              <div class="row">
                <span>Rendu</span>
                <strong>{formatCents(o.payment.change ?? 0)}</strong>
              </div>
            </>
          )}
        </div>
        {o.printLog.length > 0 && (
          <p class="muted print-log">
            {o.printLog.map((p, i) => (
              <span key={i}>
                {p.ok ? '🖨️ imprimé' : '⚠️ échec'} à {formatTime(new Date(p.at))}
                {i < o.printLog.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        )}
        {canPrint() && (
          <button
            type="button"
            class="btn btn-secondary btn-block"
            disabled={printingIds.value.has(o.id)}
            onClick={async () => {
              if (await printOrderWithPrompt(o.id)) showToast('🖨️ Ticket réimprimé');
            }}
          >
            {printingIds.value.has(o.id) ? 'Envoi…' : '🖨️ Réimprimer'}
          </button>
        )}
        <div class="sheet-actions">
          <button
            type="button"
            class={`btn ${done ? 'btn-secondary' : 'btn-success'}`}
            onClick={() => {
              setOrderDone(o.id, !done);
              onClose();
            }}
          >
            {done ? '↩︎ Rouvrir' : '✓ Terminer'}
          </button>
          <button
            type="button"
            class="btn btn-ghost danger"
            onClick={() => {
              if (confirm(`Supprimer la commande #${o.number} ?`)) {
                deleteOrder(o.id);
                showToast('Commande supprimée', 'info');
                onClose();
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
