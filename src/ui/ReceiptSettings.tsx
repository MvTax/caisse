import { data, menu, showToast, update } from '../app/state';
import type { CategoryId } from '../data/menu';
import { formatRate, VAT_CHOICES } from '../domain/vat';
import { DEFAULT_RECEIPT_HEADER } from '../storage/settings';
import { Choice } from './PrintSettings';

/** Réglages du ticket client : en-tête de la boutique et taux de TVA par catégorie. */
export function ReceiptSettings() {
  const st = data.value.settings;
  const setRate = (id: CategoryId, rate: number) =>
    update((d) => ({
      ...d,
      settings: { ...d.settings, vatRates: { ...d.settings.vatRates, [id]: rate } },
    }));

  return (
    <>
      <h2 class="ios-group-title">Ticket client</h2>
      <div class="ios-group">
        <label class="ios-row ios-row-stack">
          <span class="ios-row-text">
            En-tête du ticket
            <small>Une ligne par ligne imprimée : nom, adresse, NAF, TVA, SIRET.</small>
          </span>
          <textarea
            class="ios-text"
            rows={7}
            aria-label="En-tête du ticket client"
            autoCapitalize="off"
            spellcheck={false}
            defaultValue={st.receiptHeader}
            onChange={(e) => {
              const v = e.currentTarget.value.replace(/\r/g, '');
              update((d) => ({ ...d, settings: { ...d.settings, receiptHeader: v } }));
              showToast('En-tête enregistré', 'info');
            }}
          />
        </label>
        <button
          type="button"
          class="ios-row ios-button"
          onClick={() => {
            if (!confirm('Remettre l’en-tête d’origine (Mangos Créteil Soleil) ?')) return;
            update((d) => ({
              ...d,
              settings: { ...d.settings, receiptHeader: DEFAULT_RECEIPT_HEADER },
            }));
            showToast('En-tête d’origine remis', 'info');
            // Le champ garde sa valeur tant qu'on ne quitte pas l'écran : on recharge la vue.
            const ta = document.querySelector<HTMLTextAreaElement>(
              'textarea[aria-label="En-tête du ticket client"]',
            );
            if (ta) ta.value = DEFAULT_RECEIPT_HEADER;
          }}
        >
          Remettre l’en-tête d’origine
        </button>
      </div>

      <div class="ios-group" data-testid="vat-rates">
        {menu.categories.map((c) => (
          <Choice
            key={c.id}
            label={`TVA ${c.label}`}
            value={st.vatRates[c.id]}
            options={VAT_CHOICES.map((r) => [r, `${formatRate(r)} %`] as [number, string])}
            onChange={(v) => setRate(c.id, v)}
          />
        ))}
        <p class="ios-note">
          ⚠️ Seul le taux de l’eau (5,5 %) est confirmé par le ticket de la caisse. Vérifie les
          autres sur un ticket de la caisse pour chaque type de produit, ou demande au responsable.
        </p>
      </div>
    </>
  );
}
