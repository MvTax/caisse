/**
 * D'où l'app est-elle servie ? Détermine si l'impression est possible.
 *
 * - 'bridge' : servie en HTTP par la passerelle de la caisse → impression possible (même origine).
 * - 'https'  : GitHub Pages → Safari bloque tout appel HTTP vers la caisse (mixed content).
 * - 'dev'    : localhost (développement).
 */
export type ServingMode = 'bridge' | 'https' | 'dev';

export function detectServingMode(loc: { protocol: string; hostname: string }): ServingMode {
  if (loc.protocol === 'https:') return 'https';
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return 'dev';
  return 'bridge';
}

export const DEFAULT_BRIDGE_URL = 'http://192.168.1.122:8080';

export const PAGES_URL = 'https://mvtax.github.io/caisse/';

/** Ligne à coller dans cmd (administrateur) sur la caisse, chaque matin (CLAUDE.md §12). */
export const LAUNCH_COMMAND =
  "powershell -NoProfile -ExecutionPolicy Bypass -Command \"[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://mvtax.github.io/caisse/bridge.ps1'))\"";
