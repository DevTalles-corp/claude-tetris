const { test, expect } = require('@playwright/test');
const { capturar, guardarVideo } = require('./helpers/evidencia');
const { jugar } = require('./helpers/bot-tetris');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: una prueba juega Tetris sola desde el inicio y llega al nivel 4
// (30 líneas) sin GAME OVER, con video de la partida como evidencia (issue #26).
// Juega solo con el teclado; page.evaluate únicamente lee el estado para elegir cada tecla.
// Con la semilla fija, las piezas salen siempre en el mismo orden (issue #31).
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=26 npm test

// Ventana ajustada al juego (unos 482×736 px), para que video y capturas no tengan márgenes vacíos.
const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA, video: { mode: 'on', size: VENTANA } });

const SEMILLA = 26;
const LINEAS_NIVEL_4 = 30;
const valor = (page, id) => page.locator(`#${id}`);

test('juega sola desde el inicio hasta el nivel 4 sin GAME OVER', async ({ page }) => {
  // La partida completa puede durar más de 30 segundos.
  test.setTimeout(10 * 60 * 1000);

  await fijarSemilla(page, SEMILLA);
  await page.goto('/');
  await expect(valor(page, 'level')).toHaveText('1');
  await expect(valor(page, 'lines')).toHaveText('0');
  await capturar(page, 'inicio-partida');

  const final = await jugar(page, (estado) => estado.lineas >= LINEAS_NIVEL_4);
  expect(final.gameOver, 'GAME OVER antes de llegar al nivel 4').toBe(false);

  await expect(valor(page, 'level')).toHaveText('4');
  expect(Number(await valor(page, 'lines').textContent())).toBeGreaterThanOrEqual(LINEAS_NIVEL_4);
  await expect(page.locator('#overlay')).toBeHidden();
  await capturar(page, 'nivel-4-sin-game-over');

  // Cerrar la página antes de guardar el video: Playwright lo termina de escribir al cerrarla.
  await page.close();
  await guardarVideo(page, 'partida-nivel-4.webm');
});
