import { useState } from 'preact/hooks';
import { data, showToast, update } from '../app/state';
import { DEFAULT_BRIDGE_URL, LAUNCH_COMMAND } from '../app/env';
import { renderPreview } from '../printing/escpos';
import {
  canPrint,
  checkHealth,
  printerStatus,
  printTestTicket,
  servingMode,
} from '../printing/printService';
import { testTicket } from '../printing/ticket';
import type { Settings } from '../storage/settings';
import { copyText } from './copy';

function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  update((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
}

export function Toggle(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      class="ios-row ios-toggle-row"
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="ios-row-text">
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <span class={`ios-switch${props.checked ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}

function Choice<T extends string | number>(props: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div class="ios-row">
      <span class="ios-row-text">{props.label}</span>
      <div class="mini-seg" role="radiogroup" aria-label={props.label}>
        {props.options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={props.value === v}
            onClick={() => props.onChange(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextRow(props: {
  label: string;
  value: string;
  onCommit: (v: string) => boolean;
  inputMode?: 'numeric' | 'decimal' | 'text';
  placeholder?: string;
}) {
  return (
    <label class="ios-row">
      <span class="ios-row-text">{props.label}</span>
      <input
        class="ios-input"
        type="text"
        inputMode={props.inputMode ?? 'decimal'}
        autoComplete="off"
        autoCapitalize="off"
        spellcheck={false}
        placeholder={props.placeholder}
        defaultValue={props.value}
        onChange={(e) => {
          const v = e.currentTarget.value.trim();
          if (!props.onCommit(v)) {
            e.currentTarget.value = props.value;
            showToast('Valeur invalide', 'error');
          }
        }}
      />
    </label>
  );
}

const isIp = (v: string) =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(v) &&
  v.split('.').every((n) => Number(n) <= 255);
const toPort = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
};

function StatusRows() {
  const s = printerStatus.value;
  const h = s.health;
  const bridgeOk = s.state === 'ok' || s.state === 'warn';
  return (
    <>
      <div class="ios-row" data-testid="bridge-status">
        <span class="ios-row-text">
          Passerelle (caisse)
          <small>
            {bridgeOk
              ? `Connectée${h ? ` · v${h.version}` : ''}`
              : s.state === 'checking'
                ? 'Vérification…'
                : s.state === 'https'
                  ? 'Non disponible depuis la version en ligne'
                  : 'Injoignable : la fenêtre MA+ Bridge est-elle ouverte sur la caisse ?'}
          </small>
        </span>
        <span aria-hidden="true">{bridgeOk ? '🟢' : '⚪️'}</span>
      </div>
      <div class="ios-row" data-testid="printer-status">
        <span class="ios-row-text">
          Imprimante
          <small>
            {s.state === 'ok'
              ? `OK${h?.printer.latencyMs != null ? ` · ${h.printer.latencyMs} ms` : ''}`
              : s.state === 'warn'
                ? 'Injoignable : allumée ? câble réseau ? papier ?'
                : '—'}
          </small>
        </span>
        <span aria-hidden="true">{s.state === 'ok' ? '🟢' : s.state === 'warn' ? '🟠' : '⚪️'}</span>
      </div>
    </>
  );
}

export function PrintSettings() {
  const st = data.value.settings;
  const [busy, setBusy] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const runTest = async (kind: 'test' | 'charset') => {
    setBusy(kind);
    const r = await printTestTicket(kind);
    setBusy(null);
    if (r.ok) showToast('🖨️ Ticket de test envoyé');
    else showToast(r.error.message, 'error');
  };

  return (
    <>
      <h2 class="ios-group-title">Impression</h2>
      {servingMode === 'https' && (
        <div class="ios-group">
          <div class="ios-row">
            <span class="ios-row-text">
              Version en ligne : impression impossible
              <small>
                Safari interdit à une page sécurisée (https) de parler à la caisse. En boutique,
                ouvre l’app depuis l’adresse affichée par la passerelle.
              </small>
            </span>
          </div>
          <a class="ios-row ios-button" href={DEFAULT_BRIDGE_URL}>
            Ouvrir {DEFAULT_BRIDGE_URL}
          </a>
        </div>
      )}
      {canPrint() && (
        <div class="ios-group">
          <StatusRows />
          <button
            type="button"
            class="ios-row ios-button"
            onClick={async () => {
              const s = await checkHealth();
              showToast(s.message, s.state === 'ok' ? 'success' : 'error');
            }}
          >
            Vérifier la connexion
          </button>
          <button
            type="button"
            class="ios-row ios-button"
            disabled={!!busy}
            onClick={() => void runTest('test')}
          >
            {busy === 'test' ? 'Envoi…' : '🖨️ Imprimer un ticket de test'}
          </button>
          <button
            type="button"
            class="ios-row ios-button"
            disabled={!!busy}
            onClick={() => void runTest('charset')}
          >
            {busy === 'charset' ? 'Envoi…' : 'Ticket test caractères spéciaux (é è à ç ù €)'}
          </button>
        </div>
      )}

      <div class="ios-group">
        <Toggle
          label="Impression automatique"
          hint="Le ticket sort dès que la commande est validée."
          checked={st.autoPrint}
          onChange={(v) => set('autoPrint', v)}
        />
        <Choice
          label="Colonnes (80 mm = 48)"
          value={st.columns}
          options={[
            [32, '32'],
            [42, '42'],
            [48, '48'],
          ]}
          onChange={(v) => set('columns', v)}
        />
        <Choice
          label="Exemplaires"
          value={st.copies}
          options={[
            [1, '1'],
            [2, '2'],
          ]}
          onChange={(v) => set('copies', v)}
        />
        <Toggle
          label="Ouvrir le tiroir-caisse (espèces)"
          hint="Désactivé par défaut : c’est normalement le rôle du logiciel de caisse."
          checked={st.drawerEnabled}
          onChange={(v) => set('drawerEnabled', v)}
        />
        <button
          type="button"
          class="ios-row ios-button"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? 'Masquer l’aperçu' : 'Voir l’aperçu d’un ticket de test'}
        </button>
        {showPreview && (
          <pre class="ticket-preview" aria-label="Aperçu du ticket">
            {renderPreview(
              testTicket({
                columns: st.columns,
                printerIp: st.printerIp,
                printerPort: st.printerPort,
                at: new Date(),
              }).toPreview(),
              st.columns,
            ).join('\n')}
          </pre>
        )}
      </div>

      <h2 class="ios-group-title">Adresses réseau</h2>
      <div class="ios-group">
        <TextRow
          label="IP de l’imprimante"
          value={st.printerIp}
          onCommit={(v) => isIp(v) && (set('printerIp', v), true)}
        />
        <TextRow
          label="Port de l’imprimante"
          inputMode="numeric"
          value={String(st.printerPort)}
          onCommit={(v) => {
            const p = toPort(v);
            return p !== null && (set('printerPort', p), true);
          }}
        />
        <TextRow
          label="IP de la caisse"
          value={st.bridgeHost}
          onCommit={(v) => isIp(v) && (set('bridgeHost', v), true)}
        />
        <TextRow
          label="Port de la passerelle"
          inputMode="numeric"
          value={String(st.bridgePort)}
          onCommit={(v) => {
            const p = toPort(v);
            return p !== null && (set('bridgePort', p), true);
          }}
        />
        <TextRow
          label="Jeton (optionnel)"
          inputMode="text"
          placeholder="aucun"
          value={st.token}
          onCommit={(v) => (set('token', v), true)}
        />
      </div>

      <h2 class="ios-group-title">Démarrer le service (chaque matin)</h2>
      <div class="ios-group">
        <ol class="ios-steps">
          <li>
            Sur la caisse : touche <b>Windows</b>, tape <code>cmd</code>, puis <b>clic droit</b> sur
            « Invite de commandes » → <b>Exécuter en tant qu’administrateur</b>.
          </li>
          <li>Colle la ligne ci-dessous, puis touche Entrée.</li>
          <li>
            La fenêtre affiche une adresse (ex. <code>http://192.168.1.122:8080</code>) : ouvre-la
            dans Safari sur l’iPhone. La 1ʳᵉ fois : Partager → <b>Sur l’écran d’accueil</b>.
          </li>
          <li>
            Le soir : <b>Ctrl+C</b> dans la fenêtre noire, puis la fermer.
          </li>
        </ol>
        <pre class="code-block" data-testid="launch-command">
          {LAUNCH_COMMAND}
        </pre>
        <button
          type="button"
          class="ios-row ios-button"
          onClick={async () =>
            showToast(
              (await copyText(LAUNCH_COMMAND))
                ? 'Commande copiée'
                : 'Copie impossible : sélectionne le texte',
              'info',
            )
          }
        >
          Copier la commande
        </button>
        <p class="ios-note">
          Astuce : sur la caisse, ouvre <b>mvtax.github.io/caisse</b> dans le navigateur → Réglages
          → Copier. Ou tape la ligne une fois dans <b>Windows + R</b> : Windows s’en souviendra ;
          les jours suivants, choisis-la dans la liste puis <b>Ctrl+Maj+Entrée</b> (administrateur).
        </p>
      </div>

      <h2 class="ios-group-title">Dépannage</h2>
      <div class="ios-group help">
        <details>
          <summary>L’app ne s’ouvre pas à l’adresse de la caisse</summary>
          <ul>
            <li>La fenêtre noire MA+ Bridge est-elle ouverte sur la caisse ?</li>
            <li>
              L’iPhone est-il sur le Wi-Fi de la boutique ? Réglages → Wi-Fi → (i) : l’adresse IP
              doit commencer par <code>192.168.1.</code> (pas le Wi-Fi invités du centre
              commercial).
            </li>
            <li>
              L’adresse de la caisse a pu changer : dans cmd, tape <code>ipconfig</code> et regarde
              « Adresse IPv4 ». La fenêtre MA+ Bridge l’affiche aussi.
            </li>
          </ul>
        </details>
        <details>
          <summary>Pastille orange : imprimante injoignable</summary>
          <ul>
            <li>
              Imprimante allumée ? Câble réseau branché derrière ? Capot fermé, papier présent ?
            </li>
            <li>
              Sur la caisse : <code>ping 192.168.1.200</code> doit répondre.
            </li>
            <li>
              Retrouver son adresse : <code>arp -a | findstr 00-13-62</code>, ou ticket d’autotest
              (éteindre, maintenir FEED, rallumer).
            </li>
            <li>
              Test du port :{' '}
              <code>powershell -c "Test-NetConnection 192.168.1.200 -Port 9100"</code>
            </li>
          </ul>
        </details>
        <details>
          <summary>Caractères bizarres sur le ticket</summary>
          <ul>
            <li>Imprime le « Ticket test caractères » et compare avec l’écran.</li>
            <li>L’imprimante doit être en code page PC858 (voir le ticket d’autotest).</li>
          </ul>
        </details>
        <details>
          <summary>Le ticket ne se coupe pas</summary>
          <ul>
            <li>Vérifie que « AUTO-CUTTER : Enable » figure sur le ticket d’autotest.</li>
          </ul>
        </details>
        <details>
          <summary>« Imprimé » mais rien ne sort</summary>
          <ul>
            <li>Papier épuisé ou capot mal fermé ; rouleau dans le bon sens (face thermique).</li>
            <li>Le logiciel de caisse imprimait peut-être au même moment : réimprime.</li>
          </ul>
        </details>
      </div>
    </>
  );
}
