/**
 * Générateur de commandes ESC/POS (Epson), testé octet par octet.
 * Il produit aussi un « aperçu » texte du ticket (pour les tests et l'écran de l'app).
 */
import { encodeCp858, sanitize } from './cp858';

export type Align = 'left' | 'center' | 'right';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export interface PreviewLine {
  text: string;
  align: Align;
  width: number;
  height: number;
  bold: boolean;
  invert: boolean;
}

export class EscPos {
  readonly columns: number;
  private bytes: number[] = [];
  private state = { align: 'left' as Align, width: 1, height: 1, bold: false, invert: false };
  private line = '';
  private lineStyle: Omit<PreviewLine, 'text'> | null = null;
  private preview: PreviewLine[] = [];

  constructor(opts: { columns: number }) {
    this.columns = opts.columns;
  }

  /** Colonnes disponibles avec la largeur de caractère courante. */
  get width(): number {
    return Math.floor(this.columns / this.state.width);
  }

  private raw(...b: number[]): this {
    this.bytes.push(...b);
    return this;
  }

  init(): this {
    this.state = { align: 'left', width: 1, height: 1, bold: false, invert: false };
    return this.raw(ESC, 0x40);
  }

  /** ESC t 19 : code page PC858 (€ en 0xD5). */
  codepage858(): this {
    return this.raw(ESC, 0x74, 19);
  }

  align(a: Align): this {
    this.state.align = a;
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }

  bold(on: boolean): this {
    this.state.bold = on;
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** Taille des caractères : largeur et hauteur de 1 à 8 (GS ! n). */
  size(width: number, height: number): this {
    const w = Math.min(8, Math.max(1, Math.round(width)));
    const h = Math.min(8, Math.max(1, Math.round(height)));
    this.state.width = w;
    this.state.height = h;
    return this.raw(GS, 0x21, ((w - 1) << 4) | (h - 1));
  }

  /** Impression blanc sur noir (GS B n). */
  invert(on: boolean): this {
    this.state.invert = on;
    return this.raw(GS, 0x42, on ? 1 : 0);
  }

  text(s: string): this {
    const clean = sanitize(s).replace(/\n/g, ' ');
    if (!this.lineStyle) this.lineStyle = { ...this.state };
    this.line += clean;
    this.bytes.push(...encodeCp858(clean));
    return this;
  }

  newline(): this {
    this.preview.push({ text: this.line, ...(this.lineStyle ?? this.state) });
    this.line = '';
    this.lineStyle = null;
    return this.raw(LF);
  }

  /** Texte + saut de ligne, avec retour à la ligne propre si trop long. */
  textLine(s: string): this {
    for (const part of wrap(sanitize(s), this.width)) this.text(part).newline();
    return this;
  }

  /** Ligne de séparation sur toute la largeur. */
  rule(ch = '-'): this {
    return this.text(ch.repeat(this.width)).newline();
  }

  /**
   * Texte à gauche, montant aligné à droite. Si trop long, le texte passe sur plusieurs
   * lignes et le montant reste sur la dernière, aligné à droite.
   */
  row(left: string, right: string): this {
    const w = this.width;
    const r = sanitize(right);
    const lines = wrap(sanitize(left), Math.max(1, w - r.length - 1));
    lines.forEach((l, i) => {
      if (i < lines.length - 1) this.text(l).newline();
      else this.text(l + ' '.repeat(Math.max(1, w - l.length - r.length)) + r).newline();
    });
    return this;
  }

  /** Ligne secondaire indentée (options, suppléments). */
  indentText(s: string, indent = 2): this {
    const pad = ' '.repeat(indent);
    for (const part of wrap(sanitize(s), this.width - indent)) this.text(pad + part).newline();
    return this;
  }

  /** Avance de n lignes (ESC d n). */
  feed(n: number): this {
    for (let i = 0; i < n; i++) this.preview.push({ text: '', ...this.state });
    return this.raw(ESC, 0x64, Math.min(255, Math.max(0, n)));
  }

  /** Coupe partielle après avance (GS V 66 n). */
  cut(feed = 0): this {
    return this.raw(GS, 0x56, 66, Math.min(255, Math.max(0, feed)));
  }

  /** Ouverture du tiroir-caisse (ESC p 0 25 250). */
  openDrawer(): this {
    return this.raw(ESC, 0x70, 0, 25, 250);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  /** Aperçu texte : chaque ligne mise en page sur `columns` cellules. */
  toPreview(): PreviewLine[] {
    return this.line
      ? [...this.preview, { text: this.line, ...(this.lineStyle ?? this.state) }]
      : [...this.preview];
  }
}

/** Coupe un texte en lignes de `width` caractères maximum, sur les espaces si possible. */
export function wrap(text: string, width: number): string[] {
  const words = text.split(/ +/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (let w of words) {
    while (w.length > width) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Rendu texte d'un aperçu (une ligne = `columns` cellules, police double = caractères doublés). */
export function renderPreview(lines: PreviewLine[], columns: number): string[] {
  return lines.map((l) => {
    const cells = [...l.text].map((c) => c.repeat(l.width)).join('');
    const free = Math.max(0, columns - [...cells].length);
    const left = l.align === 'center' ? Math.floor(free / 2) : l.align === 'right' ? free : 0;
    return (' '.repeat(left) + cells).replace(/\s+$/, '');
  });
}
