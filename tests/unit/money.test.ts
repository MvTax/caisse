import { describe, expect, it } from 'vitest';
import {
  centsToInput,
  formatCents,
  formatDenomination,
  parseCentsInput,
} from '../../src/domain/money';

describe('formatCents', () => {
  it.each([
    [650, '6,50 €'],
    [0, '0,00 €'],
    [5, '0,05 €'],
    [2000, '20,00 €'],
    [123450, '1 234,50 €'],
    [-50, '-0,50 €'],
  ])('%i → %s', (c, s) => expect(formatCents(c)).toBe(s));

  it('refuse les flottants', () => expect(() => formatCents(6.5)).toThrow());
});

describe('parseCentsInput', () => {
  it.each([
    ['20', 2000],
    ['20,5', 2050],
    ['20.50', 2050],
    ['20,', 2000],
    [' 20,50 € ', 2050],
    ['0,05', 5],
    ['50', 5000],
  ])('"%s" → %i', (s, c) => expect(parseCentsInput(s)).toBe(c));

  it.each(['', '   ', 'abc', '20,555', '-5', '1,2,3', '20€50'])('"%s" → null', (s) =>
    expect(parseCentsInput(s)).toBeNull(),
  );

  it('évite les erreurs d’arrondi flottant (0,1 + 0,2)', () => {
    expect((parseCentsInput('0,10') ?? 0) + (parseCentsInput('0,20') ?? 0)).toBe(30);
  });
});

describe('affichage annexe', () => {
  it('coupures', () => {
    expect(formatDenomination(2000)).toBe('20 €');
    expect(formatDenomination(50)).toBe('50 c');
  });
  it('centsToInput', () => expect(centsToInput(1950)).toBe('19,50'));
});
