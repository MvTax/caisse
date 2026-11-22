import { useState } from 'preact/hooks';
import { data, deleteDoneOrders, deleteOrder, now, setOrderDone, showToast } from '../app/state';
import { formatCents } from '../domain/money';
import type { Order } from '../domain/order';
import { dayKey, elapsedMinutes, formatElapsed, formatTime } from '../domain/time';
import { orderSummary, plural } from './helpers';
import { OrderSheet } from './OrderSheet';
import { TopBar } from './TopBar';

function OrderRow({ o, onOpen }: { o: Order; onOpen: () => void }) {
  const d = data.value;
  const done = o.status === 'done';
  const mins = elapsedMinutes(o.createdAt, now.value);
  const overdue = d.settings.overdueMinutes;
  const level = done ? '' : mins >= overdue ? 'late' : mins >= overdue / 2 ? 'warn' : '';
  return (
    <li class={`order-row ${done ? 'done' : ''} ${level}`} data-testid="order-row">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Rouvrir la commande ${o.number}` : `Commande ${o.number} servie`}
        class="order-check"
        onClick={() => setOrderDone(o.id, !done)}
      >
        {done ? '✓' : ''}
      </button>
      <button type="button" class="order-main" onClick={onOpen}>
        <span class="bipper-badge" aria-label={`Bipper ${o.bipper}`}>
          {o.bipper}
        </span>
        <span class="order-text">
          <span class="order-summary">{orderSummary(o.lines)}</span>
          <span class="order-meta">
            #{o.number} · {formatTime(new Date(o.createdAt))}
            {!done && <span class="elapsed"> · {formatElapsed(o.createdAt, now.value)}</span>}
          </span>
        </span>
        <span class="order-total">{formatCents(o.total)}</span>
      </button>
      <button
        type="button"
        class="order-delete"
        aria-label={`Supprimer la commande ${o.number}`}
        onClick={() => {
          if (confirm(`Supprimer la commande #${o.number} (bipper ${o.bipper}) ?`)) {
            deleteOrder(o.id);
            showToast('Commande supprimée', 'info');
          }
        }}
      >
        ✕
      </button>
    </li>
  );
}

export function Orders() {
  const d = data.value;
  const [openId, setOpenId] = useState<string | null>(null);
  const today = dayKey(now.value);
  const pending = d.orders.filter((o) => o.status === 'pending');
  const doneToday = d.orders.filter(
    (o) => o.status === 'done' && dayKey(new Date(o.createdAt)) === today,
  );
  const todays = d.orders.filter((o) => dayKey(new Date(o.createdAt)) === today);
  const revenue = todays.reduce((s, o) => s + o.total, 0);
  const open = openId ? d.orders.find((o) => o.id === openId) : undefined;

  return (
    <div class="screen orders">
      <TopBar title="Commandes" />
      <main class="content">
        <div class="day-summary">
          <div>
            <span class="kpi-label">CA du jour</span>
            <strong>{formatCents(revenue)}</strong>
          </div>
          <div>
            <span class="kpi-label">Commandes</span>
            <strong>{todays.length}</strong>
          </div>
          <div>
            <span class="kpi-label">En cours</span>
            <strong>{pending.length}</strong>
          </div>
        </div>

        <h2 class="section-title">En cours ({pending.length})</h2>
        {pending.length ? (
          <ul class="order-list">
            {pending.map((o) => (
              <OrderRow key={o.id} o={o} onOpen={() => setOpenId(o.id)} />
            ))}
          </ul>
        ) : (
          <p class="muted">Aucune commande en cours.</p>
        )}

        <h2 class="section-title">Terminées aujourd’hui ({doneToday.length})</h2>
        {doneToday.length ? (
          <>
            <ul class="order-list">
              {doneToday.map((o) => (
                <OrderRow key={o.id} o={o} onOpen={() => setOpenId(o.id)} />
              ))}
            </ul>
            <button
              type="button"
              class="btn btn-ghost danger btn-block"
              onClick={() => {
                if (
                  confirm(
                    `Supprimer ${plural(doneToday.length, 'commande terminée', 'commandes terminées')} ?`,
                  )
                ) {
                  const n = deleteDoneOrders();
                  showToast(`${plural(n, 'commande supprimée', 'commandes supprimées')}`, 'info');
                }
              }}
            >
              Supprimer les terminées
            </button>
          </>
        ) : (
          <p class="muted">Aucune pour l’instant.</p>
        )}
        <p class="footnote">
          Les commandes des jours précédents restent comptées dans les statistiques.
        </p>
      </main>
      {open && <OrderSheet order={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
