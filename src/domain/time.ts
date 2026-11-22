/** Dates et heures de la boutique : toujours en Europe/Paris, quel que soit le réglage de l'iPhone. */
export const SHOP_TZ = 'Europe/Paris';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHOP_TZ,
  hour: '2-digit',
  hourCycle: 'h23',
});
const hmFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: SHOP_TZ,
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: SHOP_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Jour boutique au format "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  return dayFmt.format(date);
}

/** Heure boutique 0–23. */
export function shopHour(date: Date): number {
  return Number(hourFmt.format(date));
}

/** "14:32" */
export function formatTime(date: Date): string {
  return hmFmt.format(date);
}

/** "22/11/2026" */
export function formatDate(date: Date): string {
  return dateFmt.format(date);
}

/** Ajoute n jours à une clé "YYYY-MM-DD" (calcul calendaire, sans fuseau). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** "à l'instant", "il y a 4 min", "il y a 1 h 05". */
export function formatElapsed(fromIso: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h ${String(min % 60).padStart(2, '0')}`;
}

export function elapsedMinutes(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60000));
}
