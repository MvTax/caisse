/**
 * Planning de changement des crêpes d'exposition : un jour sur deux, sans interruption
 * (le rythme continue d'une semaine à l'autre). Du lundi au vendredi c'est l'employée de
 * semaine qui le fait, le samedi et le dimanche l'employée du week-end.
 * Les jours sont des clés "YYYY-MM-DD" (jour boutique, Europe/Paris).
 */
import { addDays } from './time';

export interface CrepeRota {
  /** Un jour où le changement a lieu (sert de point de départ au « un jour sur deux »). */
  anchor: string;
  weekdayName: string;
  weekendName: string;
}

export interface RotaDay {
  key: string;
  /** 0 = lundi … 6 = dimanche */
  weekday: number;
  change: boolean;
  who: string;
}

export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const DAY_LONG = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

const utc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

export const isDayKey = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(utc(v));

/** Jour de la semaine, 0 = lundi … 6 = dimanche. */
export function weekdayOf(key: string): number {
  return (new Date(utc(key)).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine qui contient ce jour. */
export function mondayOf(key: string): string {
  return addDays(key, -weekdayOf(key));
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function isChangeDay(key: string, anchor: string): boolean {
  return daysBetween(anchor, key) % 2 === 0;
}

export function personFor(key: string, rota: CrepeRota): string {
  return weekdayOf(key) >= 5 ? rota.weekendName : rota.weekdayName;
}

/** Les 7 jours (lundi → dimanche) de la semaine commençant à `monday`. */
export function weekPlan(monday: string, rota: CrepeRota): RotaDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i);
    return {
      key,
      weekday: i,
      change: isChangeDay(key, rota.anchor),
      who: personFor(key, rota),
    };
  });
}

/** "23/11" */
export function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}
