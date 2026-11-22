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
}

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
};
