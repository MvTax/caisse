import { defineConfig, devices } from '@playwright/test';

// Cible réelle : Safari iOS → WebKit, viewport iPhone 15.
// En local sans WebKit installé : PW_CHROMIUM=1 npm run e2e (viewport iPhone, moteur Chromium).
const useChromium = !!process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  projects: [
    useChromium
      ? {
          name: 'iphone-chromium',
          use: {
            ...devices['iPhone 15'],
            browserName: 'chromium',
            defaultBrowserType: 'chromium',
          },
        }
      : { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
