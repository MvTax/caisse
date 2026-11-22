/**
 * Mise en page des tickets (CLAUDE.md §11.4). Toute la logique est ici, côté app :
 * la passerelle ne fait que relayer les octets.
 */
import type { Menu } from '../data/menu';
import { getCategory } from '../data/menu';
import { lineLabel, lineTotal, sortForKitchen } from '../domain/cart';
import { formatCents } from '../domain/money';
import type { Order } from '../domain/order';
import type { Stats } from '../domain/stats';
import { formatDate, formatTime } from '../domain/time';
import { EscPos } from './escpos';

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
