const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: Nivel inicial con botones − y + en lugar del selector (issue #66).
// + sube y − baja el nivel inicial, sin salir de 1..10; solo cambia la interfaz.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=66 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

const nivel = (page) => ({
  overlay: page.locator('#overlay'),
  reiniciar: page.locator('#restart-btn'),
  valor: page.locator('#start-level'),
  bajar: page.locator('#start-level-down'),
  subir: page.locator('#start-level-up'),
});

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 66);
  // localStorage vacío al empezar; sessionStorage evita borrarlo al recargar en la misma prueba.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('qa-66')) {
      localStorage.clear();
      sessionStorage.setItem('qa-66', '1');
    }
  });
  await page.goto('/');
});

test('el menú de pausa muestra − , el nivel y + en lugar del selector', async ({ page }) => {
  const n = nivel(page);
  await page.keyboard.press('KeyP');
  await expect(n.bajar).toBeVisible();
  await expect(n.subir).toBeVisible();
  await expect(n.bajar).toHaveText('−');
  await expect(n.subir).toHaveText('+');
  await expect(n.valor).toHaveText('1');
  await expect(page.locator('#pause-menu select')).toHaveCount(0);
  await capturar(page, 'botones-menos-y-mas');
});

test('+ sube el nivel inicial y − lo baja, de uno en uno', async ({ page }) => {
  const n = nivel(page);
  await page.keyboard.press('KeyP');
  await n.subir.click();
  await n.subir.click();
  await n.subir.click();
  await expect(n.valor).toHaveText('4');
  await capturar(page, 'mas-sube-a-4');
  await n.bajar.click();
  await expect(n.valor).toHaveText('3');
  expect(await page.evaluate(() => localStorage.getItem('startLevel'))).toBe('3');
  await capturar(page, 'menos-baja-a-3');
});

test('los botones respetan los límites 1 y 10 con mouse y teclado', async ({ page }) => {
  const n = nivel(page);
  await page.keyboard.press('KeyP');
  await expect(n.bajar).toBeDisabled();
  await n.bajar.click({ force: true }); // pulsar − en 1 no hace nada
  await expect(n.valor).toHaveText('1');
  await capturar(page, 'limite-1-menos-desactivado');

  // Enter repetido sobre + no pasa de 10 y el foco se queda en +.
  await n.subir.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
  await expect(n.valor).toHaveText('10');
  await expect(n.subir).toBeDisabled();
  await expect(n.subir).toBeFocused();
  await expect(n.bajar).toBeEnabled();
  await n.subir.click({ force: true });
  await expect(n.valor).toHaveText('10');
  expect(await page.evaluate(() => localStorage.getItem('startLevel'))).toBe('10');
  await capturar(page, 'limite-10-mas-desactivado');

  // Bajar de más tampoco sale del rango.
  await n.bajar.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
  await expect(n.valor).toHaveText('1');
  await expect(n.bajar).toBeDisabled();
  await expect(n.bajar).toBeFocused();
});

test('solo cambia la interfaz: se aplica en la próxima partida y se recuerda al recargar', async ({ page }) => {
  const n = nivel(page);
  await page.keyboard.press('KeyP');
  for (let i = 0; i < 4; i++) await n.subir.click();
  await expect(n.valor).toHaveText('5');
  // La partida en curso no cambia.
  expect(await page.evaluate(() => ({ level, dropInterval }))).toEqual({ level: 1, dropInterval: 1000 });

  await n.reiniciar.click();
  const r = await page.evaluate(() => ({ level, startLevel, dropInterval, hud: document.getElementById('level').textContent }));
  expect(r).toEqual({ level: 5, startLevel: 5, dropInterval: 640, hud: '5' });
  await capturar(page, 'proxima-partida-en-nivel-5');

  await page.reload();
  expect(await page.evaluate(() => ({ level, guardado: localStorage.getItem('startLevel') }))).toEqual({ level: 5, guardado: '5' });
  await page.keyboard.press('KeyP');
  await expect(n.valor).toHaveText('5');
  await expect(n.bajar).toBeEnabled();
  await expect(n.subir).toBeEnabled();
  await capturar(page, 'nivel-recordado-tras-recargar');
});

test('P y Escape cierran la pausa con un botón del nivel enfocado', async ({ page }) => {
  const n = nivel(page);
  await page.keyboard.press('KeyP');
  await n.subir.focus();
  await page.keyboard.press('KeyP');
  await expect(n.overlay).toBeHidden();
  expect(await page.evaluate(() => paused)).toBe(false);

  await page.keyboard.press('Escape');
  await n.bajar.focus();
  await page.keyboard.press('Escape');
  await expect(n.overlay).toBeHidden();
  expect(await page.evaluate(() => paused)).toBe(false);
  await capturar(page, 'pausa-cerrada-desde-los-botones');
});
