import { describe, expect, it } from 'vitest';
import { encodeCp858, printedLength, sanitize } from '../../src/printing/cp858';

const byte = (ch: string) => encodeCp858(ch)[0];

describe('encodeCp858', () => {
  it.each([
    ['Ç', 0x80],
    ['ü', 0x81],
    ['é', 0x82],
    ['â', 0x83],
    ['ä', 0x84],
    ['à', 0x85],
    ['å', 0x86],
    ['ç', 0x87],
    ['ê', 0x88],
    ['ë', 0x89],
    ['è', 0x8a],
    ['ï', 0x8b],
    ['î', 0x8c],
    ['É', 0x90],
    ['ô', 0x93],
    ['ö', 0x94],
    ['û', 0x96],
    ['ù', 0x97],
    ['°', 0xf8],
    ['€', 0xd5],
    ['«', 0xae],
    ['»', 0xaf],
    ['È', 0xd4],
    ['Ê', 0xd2],
    ['À', 0xb7],
  ])('%s → 0x%s', (ch, b) => expect(byte(ch)).toBe(b));

  it('ASCII inchangé', () => {
    expect([...encodeCp858("Bouteille d'eau 2,20")]).toEqual(
      [..."Bouteille d'eau 2,20"].map((c) => c.charCodeAt(0)),
    );
  });

  it('prix en euros', () => {
    expect([...encodeCp858('6,75 €')]).toEqual([0x36, 0x2c, 0x37, 0x35, 0x20, 0xd5]);
  });

  it('formes décomposées (NFD) normalisées', () => {
    expect(byte('é')).toBe(0x82);
  });
});

describe('translittération', () => {
  it('œ, apostrophe typographique, tirets, points de suspension', () => {
    expect(sanitize('Cœur d’œuf – voilà…')).toBe("Coeur d'oeuf - voilà...");
  });
  it('emojis supprimés', () => {
    expect(sanitize('🥤 Tahiti 🧋')).toBe(' Tahiti ');
    expect(sanitize('👍🏽 ok')).toBe(' ok');
  });
  it('espaces insécables → espace simple', () => {
    expect(sanitize('1 234,50 €')).toBe('1 234,50 €');
  });
  it('lettre accentuée absente → lettre de base ; inconnu → ?', () => {
    expect([...encodeCp858('ā')]).toEqual([0x61]);
    expect([...encodeCp858('漢')]).toEqual([0x3f]);
  });
  it('caractères de contrôle retirés', () => {
    expect(sanitize('a\u001bb\tc')).toBe('abc');
  });
  it('printedLength', () => expect(printedLength('Cœur 🥤')).toBe(6));
});
