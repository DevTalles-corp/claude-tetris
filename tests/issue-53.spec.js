const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: menú de pausa completo (issue #53).
// P o Escape abren y cierran el menú; Reanudar, Reiniciar, Ver controles y Nivel inicial;
// las teclas del juego no actúan con el menú abierto ni dejan movimientos al volver.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=53 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

const menu = (page) => ({
  overlay: page.locator('#overlay'),
  titulo: page.locator('#overlay-title'),
  reanudar: page.locator('#resume-btn'),
  reiniciar: page.locator('#restart-btn'),
  verControles: page.locator('#controls-btn'),
  controles: page.locator('#pause-controls'),
  nivel: page.locator('#start-level'),
  bajarNivel: page.locator('#start-level-down'),
  subirNivel: page.locator('#start-level-up'),
  bloque: page.locator('#pause-menu'),
});

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 53);
  // Estado conocido: localStorage vacío al empezar cada prueba. sessionStorage evita
  // borrarlo otra vez al recargar dentro de la misma prueba (el nivel debe recordarse).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('qa-53')) {
      localStorage.clear();
      sessionStorage.setItem('qa-53', '1');
    }
  });
  await page.goto('/');
});

test('P abre y cierra el menú de pausa', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await expect(m.overlay).toBeVisible();
  await expect(m.titulo).toHaveText('PAUSA');
  await expect(m.reanudar).toBeVisible();
  await expect(m.reiniciar).toBeVisible();
  await expect(m.verControles).toBeVisible();
  await expect(m.nivel).toBeVisible();

  // El bucle está detenido: ni animId ni la pieza cambian.
  const enPausa = await page.evaluate(() => ({ paused, animId, y: current.y }));
  expect(enPausa.paused).toBe(true);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => ({ paused, animId, y: current.y }))).toEqual(enPausa);
  await capturar(page, 'menu-pausa-con-p');

  await page.keyboard.press('KeyP');
  await expect(m.overlay).toBeHidden();
  expect(await page.evaluate(() => paused)).toBe(false);
  await page.waitForFunction((y) => current.y > y, enPausa.y, { timeout: 5000 });
  await capturar(page, 'p-cierra-el-menu');
});

test('Escape abre y cierra el menú de pausa', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('Escape');
  await expect(m.overlay).toBeVisible();
  await expect(m.titulo).toHaveText('PAUSA');
  await expect(m.bloque).toBeVisible();
  const y = await page.evaluate(() => current.y);
  expect(await page.evaluate(() => paused)).toBe(true);
  await capturar(page, 'menu-pausa-con-escape');

  await page.keyboard.press('Escape');
  await expect(m.overlay).toBeHidden();
  await page.waitForFunction((y0) => current.y > y0, y, { timeout: 5000 });
  await capturar(page, 'escape-cierra-el-menu');
});

test('Reanudar vuelve al juego y suelta el foco del botón', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await expect(m.reanudar).toBeFocused(); // la navegación con teclado empieza en Reanudar
  const y = await page.evaluate(() => current.y);
  await m.reanudar.click();
  await expect(m.overlay).toBeHidden();
  const r = await page.evaluate(() => ({ paused, gameOver, foco: document.activeElement === document.body }));
  expect(r).toEqual({ paused: false, gameOver: false, foco: true });
  await page.waitForFunction((y0) => current.y > y0, y, { timeout: 5000 });
  await capturar(page, 'reanudar-vuelve-al-juego');
});

test('Reiniciar empieza una partida nueva sin recargar la página', async ({ page }) => {
  const m = menu(page);
  // Marca en la página: si se recargara, desaparecería.
  await page.evaluate(() => { window.sinRecargar = true; });
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(page.locator('#pieces')).toHaveText('2');

  await page.keyboard.press('KeyP');
  await m.reiniciar.click();
  await expect(m.overlay).toBeHidden();
  const r = await page.evaluate(() => ({ sinRecargar: window.sinRecargar, pieces, score, lines, paused, gameOver,
    vacio: board.every((f) => f.every((v) => v === 0)) }));
  expect(r).toEqual({ sinRecargar: true, pieces: 0, score: 0, lines: 0, paused: false, gameOver: false, vacio: true });
  await expect(page.locator('#pieces')).toHaveText('0');
  await capturar(page, 'reiniciar-sin-recargar');
});

test('Ver controles muestra la lista de teclas dentro del menú y se pliega al volver', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await expect(m.controles).toBeHidden();
  await expect(m.verControles).toHaveAttribute('aria-expanded', 'false');

  await m.verControles.click();
  await expect(m.controles).toBeVisible();
  await expect(m.verControles).toHaveAttribute('aria-expanded', 'true');
  // La lista está dentro del menú (el overlay), con todas las teclas del juego.
  expect(await page.evaluate(() => document.getElementById('overlay').contains(document.getElementById('pause-controls')))).toBe(true);
  const teclas = await m.controles.locator('kbd').allTextContents();
  expect(teclas).toEqual(['←', '→', '↑', 'X', '↓', 'Espacio', 'P', 'Esc']);
  await expect(m.controles).toContainText('mover');
  await expect(m.controles).toContainText('rotar');
  await expect(m.controles).toContainText('pausa');
  await capturar(page, 'ver-controles');

  // Al reanudar se pliega: la próxima pausa vuelve a mostrar el menú compacto.
  await page.keyboard.press('KeyP');
  await page.keyboard.press('KeyP');
  await expect(m.controles).toBeHidden();
  await expect(m.verControles).toHaveText('Ver controles');
  await capturar(page, 'controles-plegados-al-volver');
});

test('Nivel inicial se aplica en la próxima partida, no en la actual', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await expect(m.nivel).toHaveText('1');

  for (let i = 0; i < 4; i++) await m.subirNivel.click();
  await expect(m.nivel).toHaveText('5');
  expect(await page.evaluate(() => localStorage.getItem('startLevel'))).toBe('5');
  // La partida en curso no cambia de nivel.
  expect(await page.evaluate(() => ({ level, dropInterval }))).toEqual({ level: 1, dropInterval: 1000 });
  await capturar(page, 'nivel-inicial-elegido');

  await m.reiniciar.click();
  const r = await page.evaluate(() => ({ level, startLevel, dropInterval, hud: document.getElementById('level').textContent }));
  expect(r).toEqual({ level: 5, startLevel: 5, dropInterval: 640, hud: '5' }); // max(100, 1000 - 4 × 90)
  await capturar(page, 'partida-nueva-en-nivel-5');
});

test('Nivel inicial: + sube, − baja y los botones respetan los límites 1 y 10', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await expect(m.nivel).toHaveText('1');
  await expect(m.bajarNivel).toBeDisabled();
  await expect(m.subirNivel).toBeEnabled();
  await capturar(page, 'nivel-minimo-menos-desactivado');

  await m.subirNivel.click();
  await expect(m.nivel).toHaveText('2');
  await expect(m.bajarNivel).toBeEnabled();
  await m.bajarNivel.click();
  await expect(m.nivel).toHaveText('1');
  await expect(m.bajarNivel).toBeDisabled();

  // Con el teclado: Enter repetido sobre + no pasa de 10 y el foco se queda en +.
  await m.subirNivel.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
  await expect(m.nivel).toHaveText('10');
  await expect(m.subirNivel).toBeDisabled();
  await expect(m.subirNivel).toBeFocused();
  await expect(m.bajarNivel).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('startLevel'))).toBe('10');
  await capturar(page, 'nivel-maximo-mas-desactivado');

  // Bajar de más tampoco sale del límite.
  await m.bajarNivel.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
  await expect(m.nivel).toHaveText('1');
  await expect(m.bajarNivel).toBeDisabled();
  await expect(m.bajarNivel).toBeFocused();
  expect(await page.evaluate(() => ({ startLevel: localStorage.getItem('startLevel'), level }))).toEqual({ startLevel: '1', level: 1 });

  // P sigue cerrando la pausa con un botón del nivel enfocado.
  await page.keyboard.press('KeyP');
  await expect(m.overlay).toBeHidden();
  expect(await page.evaluate(() => paused)).toBe(false);
});

test('Nivel inicial se recuerda tras recargar y el nivel nunca baja de él', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  await m.subirNivel.click();
  await m.subirNivel.click();
  await expect(m.nivel).toHaveText('3');
  await page.reload();

  const inicio = await page.evaluate(() => ({ level, dropInterval, guardado: localStorage.getItem('startLevel') }));
  expect(inicio).toEqual({ level: 3, dropInterval: 820, guardado: '3' });
  await page.keyboard.press('KeyP');
  await expect(m.nivel).toHaveText('3');
  await capturar(page, 'nivel-inicial-recordado');
  await page.keyboard.press('KeyP');

  // level = max(nivel inicial, floor(lines / 10) + 1): con 10 líneas sigue en 3; con 30, sube a 4.
  const r = await page.evaluate(() => {
    cancelAnimationFrame(animId);
    const pasos = [];
    for (const total of [10, 29, 30]) {
      lines = total - 1;
      board = createBoard();
      board[10][0] = 1;
      for (let c = 0; c < COLS; c++) board[ROWS - 1][c] = c === 4 ? 0 : 1;
      current = { type: SINGLE, shape: [[SINGLE]], x: 4, y: 0, rot: 0 };
      current.y = ghostY();
      lockPiece();
      pasos.push({ lines, level, dropInterval });
    }
    draw();
    return pasos;
  });
  expect(r).toEqual([
    { lines: 10, level: 3, dropInterval: 820 },
    { lines: 29, level: 3, dropInterval: 820 },
    { lines: 30, level: 4, dropInterval: 730 },
  ]);
});

test('con el menú abierto, las teclas del juego no mueven la pieza', async ({ page }) => {
  const m = menu(page);
  await page.keyboard.press('KeyP');
  const antes = await page.evaluate(() => JSON.stringify({ x: current.x, y: current.y, shape: current.shape, score, pieces, board }));
  // Se quita el foco de Reanudar para que Espacio no lo pulse: solo se prueban las teclas del juego.
  await page.evaluate(() => document.activeElement.blur());
  for (const tecla of ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space']) {
    await page.keyboard.press(tecla);
  }
  const despues = await page.evaluate(() => JSON.stringify({ x: current.x, y: current.y, shape: current.shape, score, pieces, board }));
  expect(despues).toBe(antes);
  await expect(m.overlay).toBeVisible();
  expect(await page.evaluate(() => paused)).toBe(true);
  await capturar(page, 'teclas-bloqueadas-en-pausa');
});

test('al volver del menú no hay movimientos accidentales', async ({ page }) => {
  const m = menu(page);

  // 1) Una flecha pulsada durante la pausa y mantenida al reanudar: sus repeticiones se ignoran.
  await page.keyboard.press('KeyP');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.press('KeyP');
  const x0 = await page.evaluate(() => current.x);
  await page.keyboard.down('ArrowLeft'); // con la tecla aún pulsada, Playwright envía repeat: true
  await page.keyboard.down('ArrowLeft');
  expect(await page.evaluate(() => current.x)).toBe(x0);
  // Al soltarla y pulsarla de nuevo, vuelve a mover.
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => current.x)).toBe(x0 - 1);

  // 2) Reanudar con el teclado (Enter sobre el botón): Espacio después hace caer la pieza
  //    una sola vez y no vuelve a pulsar ningún botón del menú.
  await page.keyboard.press('KeyP');
  await expect(m.reanudar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(m.overlay).toBeHidden();
  const piezas = await page.evaluate(() => pieces);
  await page.keyboard.press('Space');
  const r = await page.evaluate(() => ({ paused, pieces, overlayOculto: document.getElementById('overlay').classList.contains('hidden') }));
  expect(r).toEqual({ paused: false, pieces: piezas + 1, overlayOculto: true });

  // 3) Reanudar con el ratón y mantener P: la repetición de P no vuelve a pausar.
  await page.keyboard.press('KeyP');
  await m.reanudar.click();
  await page.keyboard.down('KeyP');
  await page.keyboard.down('KeyP'); // repeat: true
  expect(await page.evaluate(() => paused)).toBe(true); // el primer down pausa
  await page.keyboard.up('KeyP');
  await page.keyboard.press('KeyP');
  expect(await page.evaluate(() => paused)).toBe(false);
  await capturar(page, 'sin-movimientos-al-volver');
});

test('en GAME OVER no aparece el menú de pausa', async ({ page }) => {
  const m = menu(page);
  // Tablero lleno hasta arriba: la siguiente pieza no cabe y la partida termina.
  await page.evaluate(() => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) board[r][c] = c === 0 ? 0 : 2;
    hardDrop();
    draw(); // el bucle ya se detuvo: dibujar el tablero lleno para la captura
  });
  await expect(m.overlay).toBeVisible();
  await expect(m.titulo).toHaveText('GAME OVER');
  await expect(page.locator('#overlay-score')).toHaveText(/^Puntuación: /);
  await expect(m.reiniciar).toBeVisible();
  await expect(m.reanudar).toBeHidden();
  await expect(m.bloque).toBeHidden();

  // P y Escape no abren el menú sobre el GAME OVER.
  await page.keyboard.press('KeyP');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => ({ paused, gameOver }))).toEqual({ paused: false, gameOver: true });
  await expect(m.titulo).toHaveText('GAME OVER');
  await expect(m.reanudar).toBeHidden();
  await expect(m.bloque).toBeHidden();
  await capturar(page, 'game-over-sin-menu-de-pausa');

  await m.reiniciar.click();
  await expect(m.overlay).toBeHidden();
  expect(await page.evaluate(() => gameOver)).toBe(false);
});
