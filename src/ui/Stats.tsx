import { useState } from 'preact/hooks';
import { data, menu, now } from '../app/state';
import { pop } from '../app/nav';
import { getCategory } from '../data/menu';
import { formatCents } from '../domain/money';
import { computeStats, filterOrders, periodRange, type Period } from '../domain/stats';
import { TopBar } from './TopBar';

const PERIODS: [Period, string][] = [
  ['today', 'Aujourd’hui'],
  ['yesterday', 'Hier'],
  ['7days', '7 jours'],
  ['all', 'Tout'],
];

const SIZE_ORDER = ['Petit', 'Moyen', 'Grand'];
const sizeDetail = (bySize: Record<string, number>) =>
  Object.entries(bySize)
    .sort((a, b) => SIZE_ORDER.indexOf(a[0]) - SIZE_ORDER.indexOf(b[0]))
    .map(([s, n]) => `${n} ${s.charAt(0)}`)
    .join(' / ');

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <span class="bar" aria-hidden="true">
      <span style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </span>
  );
}

export function Stats() {
  const [period, setPeriod] = useState<Period>('today');
  const orders = filterOrders(data.value.orders, periodRange(period, now.value));
  const s = computeStats(menu, orders);
  const maxHour = Math.max(1, ...s.byHour);
  // Toujours au moins la plage d'ouverture (10h–20h) pour donner du contexte.
  const used = s.byHour.flatMap((n, h) => (n > 0 ? [h] : []));
  const firstHour = Math.min(10, ...used);
  const lastHour = Math.max(20, ...used);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const maxProduct = Math.max(1, ...s.byProduct.map((p) => p.qty));

  return (
    <div class="screen stats">
      <TopBar title="Statistiques" onBack={pop} backLabel="Accueil" />
      <main class="content">
        <div class="segmented" role="tablist" aria-label="Période">
          {PERIODS.map(([p, label]) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
            >
              {label}
            </button>
          ))}
        </div>

        <div class="kpis">
          <div class="kpi kpi-main">
            <span class="kpi-label">Chiffre d’affaires</span>
            <strong data-testid="kpi-revenue">{formatCents(s.revenue)}</strong>
          </div>
          <div class="kpi">
            <span class="kpi-label">Commandes</span>
            <strong>{s.orderCount}</strong>
            <span class="kpi-sub">{s.doneCount} servies</span>
          </div>
          <div class="kpi">
            <span class="kpi-label">Panier moyen</span>
            <strong>{formatCents(s.avgBasket)}</strong>
          </div>
          <div class="kpi">
            <span class="kpi-label">Articles</span>
            <strong>{s.itemCount}</strong>
            <span class="kpi-sub">
              {(s.itemsPerOrderX10 / 10).toLocaleString('fr-FR')} / commande
            </span>
          </div>
          <div class="kpi">
            <span class="kpi-label">Heure de pointe</span>
            <strong>{s.peakHour === null ? '—' : `${s.peakHour}h`}</strong>
          </div>
        </div>

        {s.orderCount === 0 ? (
          <p class="empty">Aucune commande sur cette période.</p>
        ) : (
          <>
            <section class="card">
              <h2 class="card-title">Paiement</h2>
              <div class="row">
                <span>💳 Carte</span>
                <span>
                  {s.payment.card.count} · <b>{formatCents(s.payment.card.revenue)}</b>
                </span>
              </div>
              <div class="row">
                <span>💶 Espèces</span>
                <span>
                  {s.payment.cash.count} · <b>{formatCents(s.payment.cash.revenue)}</b>
                </span>
              </div>
              {s.payment.unknown.count > 0 && (
                <div class="row muted">
                  <span>Non renseigné (v1)</span>
                  <span>
                    {s.payment.unknown.count} · {formatCents(s.payment.unknown.revenue)}
                  </span>
                </div>
              )}
              <div class="row highlight">
                <span>Espèces encaissées (tiroir)</span>
                <strong>{formatCents(s.cashCollected)}</strong>
              </div>
            </section>

            <section class="card">
              <h2 class="card-title">Par catégorie</h2>
              {s.byCategory.map((c) => (
                <div class="bar-row" key={c.categoryId}>
                  <span class="bar-label">{c.label}</span>
                  <Bar pct={c.sharePct} color={getCategory(menu, c.categoryId)?.accent} />
                  <span class="bar-value">
                    {c.qty} · {formatCents(c.revenue)} · {c.sharePct} %
                  </span>
                </div>
              ))}
            </section>

            <section class="card">
              <h2 class="card-title">Par produit</h2>
              <ol class="product-rank">
                {s.byProduct.map((p) => (
                  <li key={p.key}>
                    <span class="bar-label">
                      {p.name}
                      {Object.keys(p.bySize).length > 0 && (
                        <span class="muted"> · {sizeDetail(p.bySize)}</span>
                      )}
                    </span>
                    <Bar
                      pct={(p.qty * 100) / maxProduct}
                      color={getCategory(menu, p.categoryId)?.accent}
                    />
                    <span class="bar-value">
                      {p.qty} · {formatCents(p.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {s.supplements.length > 0 && (
              <section class="card">
                <h2 class="card-title">
                  Suppléments <span class="muted">· {formatCents(s.supplementRevenue)}</span>
                </h2>
                {s.supplements.map((x) => (
                  <div class="row" key={x.label}>
                    <span>{x.label}</span>
                    <b>{x.qty}</b>
                  </div>
                ))}
              </section>
            )}

            {s.service.emporter + s.service.surplace > 0 && (
              <section class="card">
                <h2 class="card-title">Service (crêpes & gaufres)</h2>
                <div class="row">
                  <span>🥡 À emporter</span>
                  <b>{s.service.emporter}</b>
                </div>
                <div class="row">
                  <span>🍽️ Sur place</span>
                  <b>{s.service.surplace}</b>
                </div>
              </section>
            )}

            {Object.keys(s.glaces).length > 0 && (
              <section class="card">
                <h2 class="card-title">Glaces</h2>
                {Object.entries(s.glaces).map(([f, sizes]) => (
                  <div class="row" key={f}>
                    <span>{f}</span>
                    <span>{sizeDetail(sizes)}</span>
                  </div>
                ))}
              </section>
            )}

            <section class="card">
              <h2 class="card-title">Affluence par heure</h2>
              <div class="hour-chart" role="img" aria-label="Nombre de commandes par heure">
                {hours.map((h) => (
                  <div class="hour-col" key={h}>
                    <span class="hour-n">{s.byHour[h] || ''}</span>
                    <span
                      class={`hour-bar${h === s.peakHour ? ' peak' : ''}`}
                      style={{ height: `${((s.byHour[h] ?? 0) * 100) / maxHour}%` }}
                    />
                    <span class="hour-label">{h}h</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        <p class="footnote">Exports CSV/JSON et ticket récapitulatif : prochaines étapes.</p>
      </main>
    </div>
  );
}
