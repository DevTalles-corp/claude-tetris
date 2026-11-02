const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: el bucle del juego se detiene tras un GAME OVER por gravedad (issue #39).
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=39 npm test

const SEMILLA = 34;
// Tope para que la gravedad termine la partida (cada pieza tarda unos segundos en caer).
const TOPE_MS = 240 * 1000;

// Llega a GAME OVER por gravedad, no por tecla:
// 1) apila con Espacio mientras la pieza tenga espacio de sobra;
// 2) cuando la pila queda cerca del techo, deja de pulsar y espera a que la gravedad fije la partida.
async function llegarAGameOverPorGravedad(page) {
  for (;;) {
    const { gameOver, libre } = await page.evaluate(() => ({ gameOver, libre: ghostY() - current.y }));
    if (gameOver) throw new Error('El GAME OVER llegó con una tecla, no por gravedad');
    if (libre <= 3) break;
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => gameOver, null, { timeout: TOPE_MS, polling: 200 });
}

test('tras un GAME OVER por gravedad, animId y el tablero no cambian', async ({ page }) => {
  test.setTimeout(TOPE_MS + 60 * 1000);
  await fijarSemilla(page, SEMILLA);
  await page.goto('/');
  await llegarAGameOverPorGravedad(page);
  await capturar(page, 'game-over-por-gravedad');

  const antes = await page.evaluate(() => ({ animId, pieces, board: JSON.stringify(board) }));
  await page.waitForTimeout(3000);
  const despues = await page.evaluate(() => ({ animId, pieces, board: JSON.stringify(board) }));
  await capturar(page, 'tras-3-s-sin-cambios');

  expect(despues.animId).toBe(antes.animId);
  expect(despues.pieces).toBe(antes.pieces);
  expect(despues.board).toBe(antes.board);
});

test('Reiniciar tras un GAME OVER por gravedad vuelve a correr el bucle', async ({ page }) => {
  test.setTimeout(TOPE_MS + 60 * 1000);
  await fijarSemilla(page, SEMILLA);
  await page.goto('/');
  await llegarAGameOverPorGravedad(page);

  await page.click('#restart-btn');
  const alReiniciar = await page.evaluate(() => ({ gameOver, pieces, y: current.y }));
  expect(alReiniciar.gameOver).toBe(false);
  expect(alReiniciar.pieces).toBe(0);

  // La pieza nueva debe caer sola, sin pulsar nada.
  await page.waitForFunction((y) => current.y > y, alReiniciar.y, { timeout: 5000 });
  await capturar(page, 'reiniciar-vuelve-a-caer');
});

test('la pausa con P sigue pausando y reanudando', async ({ page }) => {
  await fijarSemilla(page, SEMILLA);
  await page.goto('/');

  await page.keyboard.press('KeyP');
  const enPausa = await page.evaluate(() => ({ animId, y: current.y }));
  await page.waitForTimeout(2000);
  const sigueEnPausa = await page.evaluate(() => ({ animId, y: current.y }));
  expect(sigueEnPausa).toEqual(enPausa);
  await capturar(page, 'pausa');

  await page.keyboard.press('KeyP');
  await page.waitForFunction((y) => current.y > y, enPausa.y, { timeout: 5000 });
});
