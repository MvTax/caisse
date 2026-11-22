import type { CategoryId } from '../data/menu';

export type PrinterMode = 'epson' | 'bridge';

export interface Settings {
  /**
   * 'epson'  : Epson TM-m30II jointe directement par Safari en Wi-Fi (ePOS-Print, HTTPS).
   * 'bridge' : passerelle ma-bridge.ps1 sur la caisse, qui relaie vers la CSI GIANT-100.
   */
  printerMode: PrinterMode;
  /** IP de l'Epson TM-m30II (page d'état de l'imprimante). */
  epsonIp: string;
  /** Envoi à l'Epson : octets ESC/POS (par défaut) ou texte simple (secours). */
  epsonFormat: 'escpos' | 'text';
  /** Adresse de la passerelle sur la caisse (utilisée hors passerelle, en dev). */
  bridgeHost: string;
  bridgePort: number;
  printerIp: string;
  printerPort: number;
  /** Largeur du ticket en colonnes (80 mm = 48). */
  columns: 32 | 42 | 48;
  copies: 1 | 2;
  autoPrint: boolean;
  /** Ouverture du tiroir-caisse depuis l'app : désactivée par défaut. */
  drawerEnabled: boolean;
  /** Une commande en cours devient « en retard » après N minutes. */
  overdueMinutes: number;
  /** Numéros des bippers de la boutique (vide = saisie libre). */
  bippers: string[];
  /** Jeton partagé optionnel avec la passerelle. */
  token: string;
  /** En-tête du ticket client : une ligne par ligne imprimée (nom, adresse, mentions). */
  receiptHeader: string;
  /** Taux de TVA par catégorie, en points de base (550 = 5,5 %). Prix de la carte = TTC. */
  vatRates: Record<CategoryId, number>;
}

/**
 * En-tête relevé sur un ticket de la caisse de la boutique (22/11/2026). Modifiable dans
 * Réglages → Ticket client.
 */
export const DEFAULT_RECEIPT_HEADER = [
  'Mangos Creteil Soleil',
  'Centre Commercial Créteil Soleil',
  'Avenue de La France Libre',
  '94000 CRÉTEIL - France',
  'NAF:5610C - TVA:FR 67 839932977',
  'SIRET:839 932 977 00029',
].join('\n');

/**
 * Seul le taux de l'eau (5,5 %) est confirmé par le ticket de caisse ; les autres sont des
 * valeurs de départ À VÉRIFIER par l'utilisateur sur un ticket de caisse de chaque produit.
 */
export const DEFAULT_VAT_RATES: Record<CategoryId, number> = {
  smoothies: 550,
  bubble: 550,
  milkshake: 550,
  jus: 550,
  softs: 550,
  crepes: 1000,
  glaces: 1000,
  donuts: 1000,
  sandwich: 1000,
};

export const DEFAULT_SETTINGS: Settings = {
  printerMode: 'epson',
  epsonIp: '192.168.1.103',
  epsonFormat: 'escpos',
  bridgeHost: '192.168.1.122',
  bridgePort: 8080,
  printerIp: '192.168.1.200',
  printerPort: 9100,
  columns: 48,
  copies: 1,
  autoPrint: true,
  drawerEnabled: false,
  overdueMinutes: 10,
  // Les 11 bippers de la boutique (numéros non consécutifs, fournis par l'utilisateur).
  bippers: ['6', '13', '14', '18', '19', '21', '22', '24', '27', '28', '29'],
  token: '',
  receiptHeader: DEFAULT_RECEIPT_HEADER,
  vatRates: { ...DEFAULT_VAT_RATES },
};
