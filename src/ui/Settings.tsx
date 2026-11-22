import {
  data,
  deleteAllOrders,
  importedFromV1,
  showToast,
  storageError,
  update,
} from '../app/state';
import { pop } from '../app/nav';
import { detectServingMode, DEFAULT_BRIDGE_URL } from '../app/env';
import type { Settings as S } from '../storage/settings';
import { parseBipperList } from '../domain/order';
import { plural } from './helpers';
import { TopBar } from './TopBar';

function setSetting<K extends keyof S>(key: K, value: S[K]) {
  update((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
}

function NumberRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  k: 'overdueMinutes';
  hint?: string;
}) {
  return (
    <label class="ios-row">
      <span class="ios-row-text">
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => {
          const n = Math.round(Number(e.currentTarget.value));
          if (Number.isFinite(n) && n >= props.min && n <= props.max) setSetting(props.k, n);
        }}
      />
    </label>
  );
}

export function Settings() {
  const st = data.value.settings;
  const mode = detectServingMode(location);
  return (
    <div class="screen settings ios">
      <TopBar title="Réglages" onBack={pop} backLabel="Accueil" />
      <main class="content">
        <h2 class="ios-group-title">Impression</h2>
        <div class="ios-group">
          <div class="ios-row">
            <span class="ios-row-text">
              Ticket de préparation
              <small>
                {mode === 'https'
                  ? `Version démo : pour imprimer, ouvre l’app depuis ${DEFAULT_BRIDGE_URL}.`
                  : 'L’impression arrive à la prochaine étape (passerelle sur la caisse).'}
              </small>
            </span>
          </div>
        </div>

        <h2 class="ios-group-title">Commandes</h2>
        <div class="ios-group">
          <label class="ios-row ios-row-stack">
            <span class="ios-row-text">
              Numéros des bippers ({st.bippers.length})
              <small>Séparés par des virgules ou des espaces. Vide = saisie libre du numéro.</small>
            </span>
            <input
              type="text"
              inputMode="numeric"
              class="ios-text"
              aria-label="Numéros des bippers"
              defaultValue={st.bippers.join(', ')}
              onChange={(e) => {
                const list = parseBipperList(e.currentTarget.value);
                setSetting('bippers', list);
                e.currentTarget.value = list.join(', ');
                showToast(plural(list.length, 'bipper enregistré', 'bippers enregistrés'), 'info');
              }}
            />
          </label>
          <NumberRow
            label="Alerte « en retard » après (min)"
            value={st.overdueMinutes}
            min={1}
            max={120}
            k="overdueMinutes"
          />
        </div>

        <h2 class="ios-group-title">Données</h2>
        <div class="ios-group">
          <div class="ios-row">
            <span class="ios-row-text">
              {plural(data.value.orders.length, 'commande enregistrée', 'commandes enregistrées')}{' '}
              sur cet iPhone
              <small>
                Les données restent dans ce navigateur, à cette adresse. Export/import : prochaine
                étape.
                {importedFromV1 > 0 &&
                  ` ${importedFromV1} commandes reprises de l’ancienne version.`}
              </small>
            </span>
          </div>
          {storageError.value && (
            <div class="ios-row warning" role="alert">
              ⚠️ {storageError.value}
            </div>
          )}
          <button
            type="button"
            class="ios-row ios-button danger"
            onClick={() => {
              if (!confirm('Effacer TOUTES les commandes de cet iPhone ?')) return;
              if (!confirm('Vraiment ? Cette action est définitive.')) return;
              deleteAllOrders();
              showToast('Commandes effacées', 'info');
            }}
          >
            Effacer toutes les commandes
          </button>
        </div>

        <h2 class="ios-group-title">À propos</h2>
        <div class="ios-group">
          <div class="ios-row">
            <span class="ios-row-text">MA+ Commander</span>
            <span class="ios-row-value">v{__APP_VERSION__}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-text">Build</span>
            <span class="ios-row-value">
              {new Date(__BUILD_DATE__).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            </span>
          </div>
        </div>
        <p class="footnote">
          Outil de prise de commande et de préparation. Ce n’est pas un logiciel de caisse : les
          tickets imprimés ne sont pas des tickets fiscaux.
        </p>
      </main>
    </div>
  );
}
