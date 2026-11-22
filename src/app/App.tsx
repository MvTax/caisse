import { detectServingMode, DEFAULT_BRIDGE_URL } from './env';

const MODE_LABEL = {
  bridge: 'Servie par la passerelle de la caisse : l’impression sera possible.',
  https: `Version en ligne (démo). Pour imprimer, ouvre l’app depuis ${DEFAULT_BRIDGE_URL}`,
  dev: 'Mode développement.',
} as const;

export function App() {
  const mode = detectServingMode(location);
  const built = new Date(__BUILD_DATE__).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  return (
    <main class="hello">
      <h1 class="logo">MA+ Commander</h1>
      <p class="tagline">Mangos Juice Bar · prise de commande</p>
      <p class="mode" data-testid="serving-mode" data-mode={mode}>
        {MODE_LABEL[mode]}
      </p>
      <p class="version">
        Version {__APP_VERSION__} · build du {built}
      </p>
    </main>
  );
}
