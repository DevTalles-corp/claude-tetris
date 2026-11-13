const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');

// Requerimiento: mostrar el título "TETRIS" en la página (issue #2).
// La evidencia se guarda con capturar(), en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=2 npm test

test('el título TETRIS es visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1.title')).toHaveText('TETRIS');
  await expect(page.locator('h1.title')).toBeVisible();
  await capturar(page, 'titulo-visible');
});

test('el título está fuera de .wrapper para que el overlay no lo cubra', async ({ page }) => {
  await page.goto('/');
  const titulo = page.locator('h1.title');
  await expect(titulo).toBeVisible();

  // El overlay de GAME OVER vive dentro de .wrapper y usa position: absolute; inset: 0.
  // Si el título estuviera dentro, quedaría cubierto por ese overlay.
  const dentroDeWrapper = await titulo.evaluate((el) => el.closest('.wrapper') !== null);
  expect(dentroDeWrapper).toBe(false);
  await expect(page.locator('.wrapper h1')).toHaveCount(0);
  await capturar(page, 'titulo-fuera-wrapper');
});

test('el tablero sigue visible debajo del título', async ({ page }) => {
  await page.goto('/');
  const titulo = page.locator('h1.title');
  const tablero = page.locator('#board');
  await expect(titulo).toBeVisible();
  await expect(tablero).toBeVisible();

  const cajaTitulo = await titulo.boundingBox();
  const cajaTablero = await tablero.boundingBox();
  expect(cajaTitulo).not.toBeNull();
  expect(cajaTablero).not.toBeNull();
  // El tablero empieza en o después del borde inferior del título.
  expect(cajaTablero.y).toBeGreaterThanOrEqual(cajaTitulo.y + cajaTitulo.height);
  await capturar(page, 'tablero-debajo-titulo');
});
