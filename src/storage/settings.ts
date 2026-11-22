export interface Settings {
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
  /** Nombre de bippers (0 = pas de maximum). */
  bipperMax: number;
  /** Jeton partagé optionnel avec la passerelle. */
  token: string;
}

export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: '192.168.1.122',
  bridgePort: 8080,
  printerIp: '192.168.1.200',
  printerPort: 9100,
  columns: 48,
  copies: 1,
  autoPrint: true,
  drawerEnabled: false,
  overdueMinutes: 10,
  bipperMax: 0,
  token: '',
};
