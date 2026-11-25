import { useState } from 'preact/hooks';
import { data, now, showToast, update } from '../app/state';
import { pop } from '../app/nav';
import { DAY_LONG, isDayKey, mondayOf, shortDate, weekPlan, type CrepeRota } from '../domain/rota';
import { addDays, dayKey } from '../domain/time';
import { canPrint, printCrepeRota } from '../printing/printService';
import { TopBar } from './TopBar';

function setRota(patch: Partial<CrepeRota>) {
  update((d) => ({
    ...d,
    settings: { ...d.settings, crepeRota: { ...d.settings.crepeRota, ...patch } },
  }));
}

/** Planning du changement des crêpes d'exposition (un jour sur deux) + fiche à imprimer. */
export function CrepeRotaScreen() {
  const [week, setWeek] = useState<0 | 1>(0);
  const [printing, setPrinting] = useState(false);
  const rota = data.value.settings.crepeRota;
  const today = dayKey(now.value);
  // Tant qu'aucun jour n'est réglé, on part du lundi de cette semaine (à vérifier).
  const anchor = rota.anchor || mondayOf(today);
  const monday = addDays(mondayOf(today), week * 7);
  const days = weekPlan(monday, { ...rota, anchor });
  const sunday = addDays(monday, 6);

  const print = async () => {
    setPrinting(true);
    const r = await printCrepeRota(days);
    setPrinting(false);
    if (r.ok) showToast('🖨️ Fiche crêpes imprimée');
    else showToast(r.error.message, 'error');
  };

  return (
    <div class="screen crepes">
      <TopBar title="Crêpes d’exposition" onBack={pop} backLabel="Accueil" />
      <main class="content">
        <div class="segmented" role="tablist" aria-label="Semaine">
          {(
            [
              [0, 'Cette semaine'],
              [1, 'Semaine prochaine'],
            ] as const
          ).map(([w, label]) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={week === w}
              onClick={() => setWeek(w)}
            >
              {label}
            </button>
          ))}
        </div>

        {!rota.anchor && (
          <p class="card warning" role="alert">
            ⚠️ Indique plus bas un jour où les crêpes ont été (ou seront) changées : le planning en
            dépend. Pour l’instant, il part du lundi {shortDate(mondayOf(today))}.
          </p>
        )}

        <section class="card" data-testid="rota-week">
          <h2 class="card-title">
            Semaine du {shortDate(monday)} au {shortDate(sunday)}
          </h2>
          {days.map((d) => (
            <div
              key={d.key}
              class={`row rota-day${d.change ? ' change' : ''}${d.key === today ? ' today' : ''}`}
              data-testid="rota-day"
              data-change={d.change}
            >
              <span>
                {DAY_LONG[d.weekday]} {shortDate(d.key)}
                {d.key === today && <small> · aujourd’hui</small>}
              </span>
              <span>{d.change ? `🔄 ${d.who}` : '—'}</span>
            </div>
          ))}
          <p class="muted">
            Changement un jour sur deux. Lundi → vendredi : {rota.weekdayName} · samedi, dimanche :{' '}
            {rota.weekendName}.
          </p>
        </section>

        {canPrint() && (
          <button
            type="button"
            class="btn btn-primary btn-block"
            disabled={printing}
            onClick={() => void print()}
          >
            {printing ? 'Envoi…' : '🖨️ Imprimer la fiche de la semaine'}
          </button>
        )}

        <section class="card">
          <h2 class="card-title">Réglages</h2>
          <label class="field">
            <span>Un jour de changement</span>
            <input
              type="date"
              value={anchor}
              aria-label="Un jour de changement"
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (isDayKey(v)) {
                  setRota({ anchor: v });
                  showToast('Planning mis à jour', 'info');
                }
              }}
            />
            <small class="muted">
              N’importe quel jour où les crêpes ont été changées (ou le seront) : le reste suit un
              jour sur deux.
            </small>
          </label>
          <label class="field">
            <span>Lundi → vendredi</span>
            <input
              type="text"
              defaultValue={rota.weekdayName}
              aria-label="Employée du lundi au vendredi"
              onChange={(e) => {
                const v = e.currentTarget.value.trim();
                if (v) setRota({ weekdayName: v });
              }}
            />
          </label>
          <label class="field">
            <span>Samedi, dimanche</span>
            <input
              type="text"
              defaultValue={rota.weekendName}
              aria-label="Employée du week-end"
              onChange={(e) => {
                const v = e.currentTarget.value.trim();
                if (v) setRota({ weekendName: v });
              }}
            />
          </label>
        </section>
      </main>
    </div>
  );
}
