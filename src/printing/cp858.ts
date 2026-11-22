/**
 * Encodeur Unicode → code page PC858 (CP850 + « € » en 0xD5), celle réglée sur la CSI GIANT-100.
 * Table 0x80–0xFF vérifiée contre le codec Python `cp858`.
 */
const HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

const TABLE = new Map<string, number>();
for (let i = 0; i < HIGH.length; i++) TABLE.set(HIGH.charAt(i), 0x80 + i);

/** Caractères absents de PC858 → équivalent lisible. */
const TRANSLIT: Record<string, string> = {
  œ: 'oe',
  Œ: 'OE',
  '‘': "'",
  '’': "'",
  '‚': ',',
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  '•': '·',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '№': 'No',
  '→': '->',
  '×': 'x',
  '✕': 'x',
  '✓': 'v',
  '✔': 'v',
  '＋': '+',
};

/** Pictogrammes (emojis, symboles) : supprimés. */
const PICTO = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}|[\u{1F3FB}-\u{1F3FF}]/gu;

/** Texte prêt à imprimer : translittéré, sans emoji, sans caractère de contrôle. */
export function sanitize(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC').replace(PICTO, '')) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else out += ch;
  }
  // eslint-disable-next-line no-control-regex -- on retire justement les caractères de contrôle
  return out.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '');
}

/** Encode un caractère ; inconnu → lettre sans accent si possible, sinon « ? ». */
function encodeChar(ch: string, out: number[]): void {
  const code = ch.codePointAt(0) ?? 0x3f;
  if (code < 0x80) {
    out.push(code);
    return;
  }
  const b = TABLE.get(ch);
  if (b !== undefined && b !== 0xff) {
    out.push(b);
    return;
  }
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (base && base !== ch && [...base].every((c) => (c.codePointAt(0) ?? 0x80) < 0x80)) {
    for (const c of base) out.push(c.codePointAt(0) ?? 0x3f);
    return;
  }
  out.push(0x3f);
}

export function encodeCp858(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of sanitize(text)) encodeChar(ch, out);
  return Uint8Array.from(out);
}

/** Nombre de colonnes occupées une fois imprimé (après translittération). */
export function printedLength(text: string): number {
  return [...sanitize(text)].length;
}
