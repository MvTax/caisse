import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  isChangeDay,
  mondayOf,
  personFor,
  weekdayOf,
  weekPlan,
} from '../../src/domain/rota';
import { renderPreview } from '../../src/printing/escpos';
import { crepeRotaTicket } from '../../src/printing/ticket';

const rota = { anchor: '2026-11-23', weekdayName: 'Ouarda', weekendName: 'Kenza' };

describe('planning crêpes d’exposition', () => {
  it('jours de la semaine et lundi de la semaine', () => {
    expect(weekdayOf('2026-11-23')).toBe(0); // lundi
    expect(weekdayOf('2026-11-29')).toBe(6); // dimanche
    expect(mondayOf('2026-11-25')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(mondayOf('2026-11-30')).toBe('2026-11-30');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // changement d'année
  });

  it('un jour sur deux, sans s’arrêter d’une semaine à l’autre', () => {
    const w1 = weekPlan('2026-11-23', rota)
      .filter((d) => d.change)
      .map((d) => d.key);
    expect(w1).toEqual(['2026-11-23', '2026-11-25', '2026-11-27', '2026-11-29']);
    const w2 = weekPlan('2026-11-30', rota)
      .filter((d) => d.change)
      .map((d) => d.key);
    expect(w2).toEqual(['2026-12-01', '2026-12-03', '2026-12-05']);
  });

  it('jour de référence dans le futur ou le passé : même rythme', () => {
    expect(isChangeDay('2026-11-23', '2026-12-24')).toBe(false);
    expect(isChangeDay('2026-11-24', '2026-12-24')).toBe(true);
    expect(daysBetween('2026-11-23', '2026-11-21')).toBe(-2);
    expect(isChangeDay('2026-11-21', '2026-11-23')).toBe(true);
  });

  it('heure d’hiver / d’été sans décalage', () => {
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('Ouarda du lundi au vendredi, Kenza le week-end', () => {
    expect(personFor('2026-11-27', rota)).toBe('Ouarda'); // vendredi
    expect(personFor('2026-11-28', rota)).toBe('Kenza'); // samedi
    expect(personFor('2026-11-29', rota)).toBe('Kenza'); // dimanche
    const sunday = weekPlan('2026-11-23', rota)[6];
    expect(sunday).toMatchObject({ change: true, who: 'Kenza' });
    const saturdayNext = weekPlan('2026-11-30', rota)[5];
    expect(saturdayNext).toMatchObject({ change: true, who: 'Kenza' });
  });
});

describe('fiche PLANNING imprimée', () => {
  const ticket = (columns: number) =>
    crepeRotaTicket({ columns, days: weekPlan('2026-11-23', rota) });
  const lines = (columns = 48) =>
    renderPreview(ticket(columns).toPreview(), columns).map((l) => l.trim());

  it.each([32, 42, 48])('aucune ligne ne dépasse %i colonnes', (columns) => {
    for (const l of renderPreview(ticket(columns).toPreview(), columns)) {
      expect(l.length, l).toBeLessThanOrEqual(columns);
    }
  });

  it('titre, semaine, puis seulement les jours de changement avec le prénom en gros', () => {
    const t = ticket(48).toPreview();
    const title = t.find((l) => l.text === 'PLANNING');
    expect(title).toMatchObject({ width: 3, height: 3, bold: true });
    expect(t.some((l) => l.text === '23/11 au 29/11')).toBe(true);
    const days = t.filter((l) => /^[A-Z]+ \d\d\/\d\d$/.test(l.text)).map((l) => l.text);
    expect(days).toEqual(['LUNDI 23/11', 'MERCREDI 25/11', 'VENDREDI 27/11', 'DIMANCHE 29/11']);
    const names = t.filter((l) => l.invert).map((l) => l.text);
    expect(names).toEqual([' OUARDA ', ' OUARDA ', ' OUARDA ', ' KENZA ']);
    for (const n of t.filter((l) => l.invert)) expect(n).toMatchObject({ width: 2, height: 2 });
  });

  it('aucun détail en plus', () => {
    const all = lines().join('\n');
    for (const extra of [
      'MA+',
      'Mangos',
      'un jour sur deux',
      'Cocher',
      '[ ]',
      'Fiche',
      'MARDI',
      'Lundi ->',
    ]) {
      expect(all, extra).not.toContain(extra);
    }
  });

  it('coupe finale', () => {
    expect([...ticket(48).toBytes()].slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
});
