import { push } from '../app/nav';
import { printerStatus } from '../printing/printService';

const LABEL = {
  unknown: 'Imprimante',
  checking: 'Imprimante…',
  ok: 'Imprimante',
  warn: 'Imprimante ?',
  off: 'Hors ligne',
  https: 'Démo',
} as const;

const DOT = {
  unknown: 'off',
  checking: 'off',
  ok: 'ok',
  warn: 'warn',
  off: 'off',
  https: 'off',
} as const;

/** Pastille d'état : vert = tout OK, orange = passerelle OK mais imprimante KO, gris = pas de passerelle. */
export function PrinterPill() {
  const s = printerStatus.value;
  return (
    <button
      type="button"
      class="printer-pill"
      data-state={DOT[s.state]}
      data-testid="printer-pill"
      aria-label={`${s.message} Ouvrir les réglages d’impression.`}
      onClick={() => push({ name: 'settings' })}
    >
      <span class="dot" aria-hidden="true" />
      {LABEL[s.state]}
    </button>
  );
}
