/**
 * Mise en page des tickets (CLAUDE.md §11.4). Toute la logique est ici, côté app :
 * la passerelle ne fait que relayer les octets.
 */
import type { Menu } from '../data/menu';
import { getCategory } from '../data/menu';
import { lineLabel, lineTotal, sortForKitchen } from '../domain/cart';
import { formatCents } from '../domain/money';
import { itemCount, type Order } from '../domain/order';
import type { Stats } from '../domain/stats';
import { formatDate, formatTime } from '../domain/time';
import { DAY_LONG, type RotaDay } from '../domain/rota';
import { formatRate, vatSummary } from '../domain/vat';
import { sanitize } from './cp858';
import { EscPos, wrap } from './escpos';

export interface TicketOptions {
  columns: number;
  /** Ouvre le tiroir-caisse (paiement espèces), si activé dans les réglages. */
  openDrawer?: boolean;
}

export const NON_FISCAL = 'Ticket de préparation - non fiscal';

const SERVICE_TICKET = { emporter: 'À EMPORTER', surplace: 'SUR PLACE' } as const;

function header(p: EscPos): EscPos {
  return p
    .init()
    .codepage858()
    .align('center')
    .size(2, 2)
    .bold(true)
    .textLine('MA+')
    .size(1, 1)
    .bold(false)
    .textLine('Mangos Juice Bar');
}

function footer(p: EscPos, at: Date, text = NON_FISCAL): EscPos {
  return p
    .align('center')
    .size(1, 1)
    .bold(false)
    .textLine(`${formatTime(at)} · ${formatDate(at)}`)
    .textLine(text)
    .feed(4)
    .cut();
}

/** Ticket de préparation d'une commande. */
export function orderTicket(menu: Menu, order: Order, opts: TicketOptions): EscPos {
  const p = header(new EscPos({ columns: opts.columns }));
  p.rule('=')
    .bold(true)
    .textLine(`COMMANDE #${order.number}`)
    .bold(false)
    .textLine('BIPPER')
    .size(4, 4)
    .bold(true)
    .invert(true)
    .text(` ${order.bipper.padStart(2, '0')} `)
    .invert(false)
    .newline()
    .size(1, 1)
    .bold(false)
    .align('left')
    .rule('-');

  let lastCat = '';
  for (const l of sortForKitchen(menu, order.lines)) {
    if (l.categoryId !== lastCat) {
      if (lastCat) p.newline();
      lastCat = l.categoryId;
      const label = getCategory(menu, l.categoryId)?.label ?? l.categoryId;
      p.textLine(`-- ${label.toUpperCase()} --`);
    }
    const qty = l.quantity > 1 ? `${l.quantity}x ` : '';
    p.bold(true)
      .size(1, 2)
      .row(`${qty}${lineLabel(l)}`, formatCents(lineTotal(l)))
      .size(1, 1)
      .bold(false);
    if (l.quantity > 1) p.indentText(`(${formatCents(l.unitPrice)} l'unité)`);
    if (l.options.supplements?.length) p.indentText(`+ ${l.options.supplements.join(', ')}`);
    if (l.options.service) {
      p.bold(true).indentText(`>> ${SERVICE_TICKET[l.options.service]} <<`).bold(false);
    }
  }

  p.rule('-').bold(true).size(2, 1).row('TOTAL', formatCents(order.total)).size(1, 1).bold(false);
  p.rule('-');
  const pay = order.payment;
  if (pay.method === 'card') p.row('Paiement', 'CARTE');
  else if (pay.method === 'cash') {
    p.row('Paiement', 'ESPÈCES');
    if (pay.cashGiven !== undefined) {
      p.row('Reçu', formatCents(pay.cashGiven));
      p.bold(true)
        .size(1, 2)
        .row('RENDU', formatCents(pay.change ?? 0))
        .size(1, 1)
        .bold(false);
    }
  }
  p.rule('=');
  footer(p, new Date(order.createdAt));
  if (opts.openDrawer && pay.method === 'cash') p.openDrawer();
  return p;
}

/** Options des tickets destinés au client (en-tête de la boutique, TVA). */
export interface ReceiptOptions {
  columns: number;
  at: Date;
  /** Une ligne par ligne imprimée ; la 1re (nom de la boutique) en gras. */
  header: string;
  /** Taux de TVA par catégorie, en points de base (550 = 5,5 %). */
  vatRates: Partial<Record<string, number>>;
}

/** Taux d'une catégorie absente des réglages (anciennes données) : 10 %. */
const FALLBACK_VAT = 1000;

/** « 2,20 » : montant sans le symbole, pour les colonnes. */
const amount = (c: number) => formatCents(c).replace(/\s€$/, '');

const lineRate = (o: ReceiptOptions, categoryId: string) => o.vatRates[categoryId] ?? FALLBACK_VAT;

function receiptHeader(p: EscPos, header: string): EscPos {
  p.init().codepage858().align('center');
  const lines = header
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  lines.forEach((l, i) => {
    if (i === 0) p.bold(true).textLine(l).bold(false);
    else p.textLine(l);
  });
  return p.newline().align('left');
}

/** Ligne de texte déjà mise en colonnes (les espaces comptent : pas de retour à la ligne). */
const raw = (p: EscPos, s: string) => p.text(s.slice(0, p.width)).newline();

/** Tableau de TVA : taux, montant de TVA, HT, TTC, puis les totaux. */
function vatTable(p: EscPos, order: Order, o: ReceiptOptions): EscPos {
  const sum = vatSummary(
    order.lines.map((l) => ({ ttc: lineTotal(l), rate: lineRate(o, l.categoryId) })),
  );
  const L = Math.max(5, p.width - 27);
  const cells = (label: string, a: string, b: string, c: string) =>
    label.padEnd(L) + a.padStart(9) + b.padStart(9) + c.padStart(9);
  p.bold(true).textLine('TAXES :').bold(false);
  raw(p, cells('TVA', 'MT TVA', 'MT HT', 'MT TTC'));
  for (const g of sum.groups) {
    raw(p, cells(`${formatRate(g.rate)}%`, amount(g.vat), amount(g.ht), amount(g.ttc)));
  }
  p.bold(true);
  raw(p, cells('Total', amount(sum.total.vat), amount(sum.total.ht), amount(sum.total.ttc)));
  return p.bold(false);
}

const RECEIPT_FOOTER = 'Ticket client - non fiscal';

/**
 * Ticket client, sur le modèle du ticket de caisse de la boutique : en-tête et mentions,
 * articles (Qté, PU TTC, Prix TTC, taux de TVA), total, règlement, tableau de TVA.
 * Sans les détails de préparation (suppléments, sur place / à emporter, bipper).
 * Ce n'est PAS le ticket de caisse officiel (NF525) : celui-ci reste délivré par le
 * logiciel de caisse (CLAUDE.md §2.3). Aucune mention NF525 ni signature n'est imitée.
 */
export function customerTicket(menu: Menu, order: Order, o: ReceiptOptions): EscPos {
  const p = receiptHeader(new EscPos({ columns: o.columns }), o.header);
  const W = p.width;
  const created = new Date(order.createdAt);
  p.bold(true)
    .row(`TICKET N°${order.number}`, `le ${formatDate(created)} ${formatTime(created)}`)
    .bold(false)
    .newline();

  // Colonnes à droite : Qté (4) · PU TTC (8) · Prix TTC (9) · TVA (5) = 26.
  const nums = (q: string, pu: string, prix: string, tva: string) =>
    q.padStart(4) + pu.padStart(8) + prix.padStart(9) + tva.padStart(5);
  const wide = W >= 42;
  const nameW = W - 26;
  raw(
    p,
    (wide ? ' '.repeat(nameW) : ' '.repeat(W - 26)) + nums('Qté', 'PU TTC', 'Prix TTC', 'TVA'),
  );
  for (const l of sortForKitchen(menu, order.lines)) {
    const cols = nums(
      String(l.quantity),
      amount(l.unitPrice),
      amount(lineTotal(l)),
      formatRate(lineRate(o, l.categoryId)),
    );
    if (wide) {
      const [first = '', ...rest] = wrap(sanitize(lineLabel(l)), nameW - 1);
      raw(p, first.padEnd(nameW) + cols);
      for (const r of rest) raw(p, r);
    } else {
      p.textLine(lineLabel(l));
      raw(p, cols.padStart(W));
    }
  }
  p.textLine(`Nombre total d'articles : ${itemCount(order)} / ${order.lines.length} ligne(s)`)
    .rule('-')
    .bold(true)
    .size(1, 2)
    .row('TOTAL TTC :', formatCents(order.total))
    .size(1, 1)
    .bold(false)
    .rule('-');

  const pay = order.payment;
  if (pay.method === 'card') p.row('REGLEMENT : Carte bancaire', formatCents(order.total));
  else if (pay.method === 'cash') {
    p.row('REGLEMENT : Espèces', formatCents(pay.cashGiven ?? order.total));
    if (pay.change) p.row('Rendu', formatCents(pay.change));
  }
  p.newline();
  vatTable(p, order, o).rule('-');
  return footer(p, o.at, RECEIPT_FOOTER);
}

/**
 * Note client « sans détail » : en-tête de la boutique, total et TVA, sans les articles de
 * la carte ni le mode de paiement (usage type note de frais). Pas de bipper, pas de tiroir.
 */
export function invoiceTicket(order: Order, o: ReceiptOptions): EscPos {
  const created = new Date(order.createdAt);
  const p = receiptHeader(new EscPos({ columns: o.columns }), o.header);
  p.align('center')
    .bold(true)
    .textLine('NOTE')
    .bold(false)
    .textLine('sans détail')
    .align('left')
    .rule('=')
    .row('Commande', `N°${order.number}`)
    .row('Date', `${formatDate(created)} ${formatTime(created)}`)
    .rule('-')
    .row('Consommations', formatCents(order.total))
    .rule('-')
    .bold(true)
    .size(1, 2)
    .row('TOTAL TTC', formatCents(order.total))
    .size(1, 1)
    .bold(false)
    .newline();
  vatTable(p, order, o).rule('-');
  return footer(p, o.at, RECEIPT_FOOTER);
}

/**
 * Fiche « PLANNING » des crêpes d'exposition, comme la liste à l'écran (demande de
 * l'utilisateur) : les 7 jours en gros, le nom du jour seul (pas de date), le prénom ou « -- »,
 * de l'espace entre les lignes, aucun trait ni autre détail.
 */
export function crepeRotaTicket(opts: { columns: number; days: RotaDay[] }): EscPos {
  const p = new EscPos({ columns: opts.columns }).init().codepage858();
  p.align('center').bold(true).size(3, 3).textLine('PLANNING').align('left');
  for (const d of opts.days) {
    p.newline()
      .size(2, 2)
      .bold(d.change)
      .row(DAY_LONG[d.weekday] ?? '', d.change ? d.who : '--');
  }
  return p.size(1, 1).bold(false).feed(4).cut();
}

/** Ticket de test : vérifie la liaison, la largeur et les accents. */
export function testTicket(opts: {
  columns: number;
  printerIp: string;
  printerPort: number;
  at: Date;
}): EscPos {
  const p = header(new EscPos({ columns: opts.columns }));
  p.rule('=')
    .size(2, 2)
    .bold(true)
    .textLine('TEST')
    .textLine('IMPRESSION OK')
    .size(1, 1)
    .bold(false)
    .rule('=')
    .align('left')
    .row('Imprimante', `${opts.printerIp}:${opts.printerPort}`)
    .row('Largeur', `${opts.columns} colonnes`)
    .row('Prix', formatCents(675))
    .textLine('Accents : é è à ç ù â ê î ô û ë ï ü É €')
    .textLine('Règle de largeur :');
  const ruler = Array.from({ length: opts.columns }, (_, i) => String((i + 1) % 10)).join('');
  p.textLine(ruler).rule('=');
  return footer(p, opts.at, 'Ticket de test - non fiscal');
}

/** Ticket « caractères spéciaux » : à comparer visuellement avec l'écran. */
export const CHARSET_LINES = [
  'Minuscules : é è ê ë à â ä ç ù û ü î ï ô ö',
  'Majuscules : É È Ê À Â Ç Ù Û Î Ô',
  'Symboles : € £ ° « » ± ½ ¼ µ § ²',
  "Apostrophe : Bouteille d'eau",
  "Translittérés : œ → oe, ’ → ', … → ...",
  'Emoji supprimés : 🥤🧋 (rien ne doit sortir)',
];

export function charsetTicket(opts: { columns: number; at: Date }): EscPos {
  const p = header(new EscPos({ columns: opts.columns }));
  p.rule('=').bold(true).textLine('TEST CARACTÈRES').bold(false).rule('=').align('left');
  for (const l of CHARSET_LINES) p.textLine(l);
  p.rule('=');
  return footer(p, opts.at, 'Ticket de test - non fiscal');
}

/** Récapitulatif de la journée (synthèse, non fiscal). */
export function dayRecapTicket(opts: {
  columns: number;
  title: string;
  stats: Stats;
  at: Date;
  topN?: number;
}): EscPos {
  const s = opts.stats;
  const p = header(new EscPos({ columns: opts.columns }));
  p.rule('=')
    .bold(true)
    .textLine('RÉCAPITULATIF')
    .bold(false)
    .textLine(opts.title)
    .rule('=')
    .align('left')
    .bold(true)
    .size(1, 2)
    .row("Chiffre d'affaires", formatCents(s.revenue))
    .size(1, 1)
    .bold(false)
    .row('Commandes', String(s.orderCount))
    .row('Articles', String(s.itemCount))
    .row('Panier moyen', formatCents(s.avgBasket))
    .rule('-')
    .row(`Carte (${s.payment.card.count})`, formatCents(s.payment.card.revenue))
    .row(`Espèces (${s.payment.cash.count})`, formatCents(s.payment.cash.revenue));
  if (s.payment.unknown.count) {
    p.row(`Non renseigné (${s.payment.unknown.count})`, formatCents(s.payment.unknown.revenue));
  }
  p.rule('-').bold(true).textLine('Produits').bold(false);
  for (const prod of s.byProduct.slice(0, opts.topN ?? 50)) {
    p.row(`${prod.qty}x ${prod.name}`, formatCents(prod.revenue));
  }
  if (s.supplements.length) {
    p.rule('-').bold(true).textLine('Suppléments').bold(false);
    for (const sup of s.supplements) p.row(sup.label, String(sup.qty));
  }
  p.rule('=');
  return footer(p, opts.at, 'Récapitulatif - non fiscal');
}
