import { describe, expect, it } from 'vitest';
import { EscPos, renderPreview, wrap } from '../../src/printing/escpos';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');

describe('commandes ESC/POS', () => {
  it('octets de base (§11.2)', () => {
    const b = new EscPos({ columns: 48 })
      .init()
      .codepage858()
      .align('center')
      .bold(true)
      .size(2, 2)
      .invert(true)
      .text('A')
      .newline()
      .feed(4)
      .cut()
      .openDrawer()
      .toBytes();
    expect(hex(b)).toBe(
      [
        '1b 40', // init
        '1b 74 13', // PC858
        '1b 61 01', // centre
        '1b 45 01', // gras
        '1d 21 11', // double largeur + hauteur
        '1d 42 01', // inversé
        '41 0a',
        '1b 64 04', // avance 4 lignes
        '1d 56 42 00', // coupe partielle
        '1b 70 00 19 fa', // tiroir
      ].join(' '),
    );
  });

  it('tailles : 0x00, 0x11, 0x22, 0x33', () => {
    const sizes = [1, 2, 3, 4].map((n) => new EscPos({ columns: 48 }).size(n, n).toBytes()[2]);
    expect(sizes).toEqual([0x00, 0x11, 0x22, 0x33]);
  });
});

describe('mise en page', () => {
  it.each([32, 42, 48])('row() aligne le prix à droite sur %i colonnes', (columns) => {
    const p = new EscPos({ columns }).row('Tahiti Moyen', '6,75 €');
    const [line] = renderPreview(p.toPreview(), columns);
    expect(line).toHaveLength(columns);
    expect(line?.startsWith('Tahiti Moyen')).toBe(true);
    expect(line?.endsWith('6,75 €')).toBe(true);
  });

  it('largeur double : la ligne tient sur la moitié des colonnes', () => {
    const p = new EscPos({ columns: 48 }).size(2, 1).row('TOTAL', '12,60 €');
    expect(p.toPreview()[0]?.text).toHaveLength(24);
    expect(renderPreview(p.toPreview(), 48)[0]).toHaveLength(48);
  });

  it('nom trop long : retour à la ligne, prix sur la dernière ligne', () => {
    const p = new EscPos({ columns: 32 }).row(
      '3x Gaufre Chocolat avec beaucoup de suppléments',
      '17,55 €',
    );
    const lines = renderPreview(p.toPreview(), 32);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(32);
    expect(lines.at(-1)?.endsWith('17,55 €')).toBe(true);
  });

  it('rule() remplit la largeur', () => {
    expect(new EscPos({ columns: 42 }).rule('=').toPreview()[0]?.text).toBe('='.repeat(42));
  });

  it('wrap coupe les mots trop longs', () => {
    expect(wrap('abcdefghij kl', 4)).toEqual(['abcd', 'efgh', 'ij', 'kl']);
    expect(wrap('', 10)).toEqual(['']);
  });
});
