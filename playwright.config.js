// @ts-check
const { defineConfig } = require('@playwright/test');

// Una sola fecha y hora por ejecución, para que todas las capturas queden en la misma carpeta.
// Se calcula en el proceso principal; los workers heredan la variable.
if (!process.env.EVIDENCIA_STAMP) {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  process.env.EVIDENCIA_STAMP = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}-${pad(ahora.getSeconds())}`;
}

module.exports = defineConfig({
  testDir: './tests',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8000',
    viewport: { width: 1080, height: 1920 },
    // Partir siempre en tema oscuro: la página sigue la preferencia del sistema.
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
