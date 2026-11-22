/**
 * Argent : TOUJOURS en centimes entiers. Formatage uniquement à l'affichage.
 * Leçon v1 : pas de "6,50€" + parseFloat.
 */
export type Cents = number;

/** 650 → "6,50 €" ; 123450 → "1 234,50 €" ; -50 → "-0,50 €". */
export function formatCents(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}${euros},${rest} €`;
}

/** Coupures courtes pour la décomposition du rendu : 2000 → "20 €", 50 → "50 c". */
export function formatDenomination(cents: Cents): string {
  return cents >= 100 ? `${cents / 100} €` : `${cents} c`;
}

/**
 * Saisie utilisateur → centimes. Accepte "20", "20,5", "20.50", " 20,50 € ".
 * Retourne null si vide ou invalide. Aucune arithmétique flottante.
 */
export function parseCentsInput(input: string): Cents | null {
  const s = input.replace(/\s/g, '').replace(/€$/, '');
  const m = /^(\d{1,6})(?:[.,](\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const euros = Number(m[1]);
  const cents = Number((m[2] ?? '').padEnd(2, '0'));
  return euros * 100 + cents;
}

/** Montant en centimes → texte de saisie "20,50" (pour pré-remplir un champ). */
export function centsToInput(cents: Cents): string {
  return formatCents(cents).replace(' €', '').replace(/ /g, '');
}

export function assertCents(value: number): void {
  if (!Number.isInteger(value))
    throw new Error(`Montant non entier (centimes attendus) : ${value}`);
}
