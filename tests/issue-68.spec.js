const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: el panel de controles usa los mismos textos que el menú de pausa (issue #68).
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=68 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

// Teclas de cada fila, en orden, como texto: [['←', '→'], ['↑', 'X'], ...]
const teclas = (lista) => lista.locator('li').evaluateAll(filas =>
  filas.map(li => [...li.querySelectorAll('kbd')].map(k => k.textContent.trim())));

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 68);
  await page.goto('/');
});

test('el panel muestra ↑ X para rotar y Espacio para la caída', async ({ page }) => {
  const panel = page.locator('.panel-section.controls');
  await expect(panel.locator('li', { hasText: 'rotar' }).locator('kbd')).toHaveText(['↑', 'X']);
  await expect(panel.locator('li', { hasText: 'caída' }).locator('kbd')).toHaveText(['Espacio']);
  await expect(panel).not.toContainText('Space');
  await capturar(page, 'panel-controles');
});

test('las teclas del panel coinciden con las del menú de pausa', async ({ page }) => {
  await page.keyboard.press('KeyP');
  await page.locator('#controls-btn').click();
  await expect(page.locator('#pause-controls')).toBeVisible();
  const panel = await teclas(page.locator('.panel-section.controls ul'));
  const menu = await teclas(page.locator('#pause-controls'));
  expect(panel).toEqual(menu);
  expect(panel).toEqual([['←', '→'], ['↑', 'X'], ['↓'], ['Espacio'], ['P', 'Esc']]);
  await capturar(page, 'panel-y-menu-iguales');
});

test('solo cambia el texto: X sigue rotando y Espacio sigue dejando caer la pieza', async ({ page }) => {
  const r = await page.evaluate(() => {
    cancelAnimationFrame(animId); // sin gravedad entre las teclas y la lectura
    current = { type: 1, shape: PIECES[1].map(f => f.slice()), x: 3, y: 0, rot: 0 };
    return { forma: JSON.stringify(current.shape) };
  });
  await page.keyboard.press('KeyX');
  const rotada = await page.evaluate(() => JSON.stringify(current.shape));
  expect(rotada).not.toBe(r.forma);

  const antes = await page.evaluate(() => pieces);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => pieces)).toBe(antes + 1);
  await page.evaluate(() => draw());
  await capturar(page, 'x-rota-y-espacio-cae');
});
