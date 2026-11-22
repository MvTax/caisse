import { useState } from 'preact/hooks';
import { data, showToast } from '../app/state';
import { printFailure, printOrderWithPrompt } from '../printing/printService';

/** « Ticket non imprimé » : Réessayer ou Imprimer plus tard. La commande, elle, est enregistrée. */
export function PrintFailSheet() {
  const f = printFailure.value;
  const [busy, setBusy] = useState(false);
  if (!f) return null;
  const order = data.value.orders.find((o) => o.id === f.orderId);
  const close = () => (printFailure.value = null);
  return (
    <div class="sheet-backdrop" onClick={close}>
      <div
        class="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="print-fail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-grabber" aria-hidden="true" />
        <h2 id="print-fail-title" class="fail-title">
          🖨️ Ticket non imprimé
        </h2>
        {order && (
          <p class="muted">
            Commande #{order.number} · Bipper {order.bipper} — la commande est bien enregistrée.
          </p>
        )}
        <p class="warning" data-testid="print-fail-message">
          {f.message}
        </p>
        <div class="sheet-actions">
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await printOrderWithPrompt(f.orderId);
              setBusy(false);
              if (ok) showToast('🖨️ Ticket imprimé');
            }}
          >
            {busy ? 'Envoi…' : 'Réessayer'}
          </button>
          <button type="button" class="btn btn-secondary" onClick={close}>
            Imprimer plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
