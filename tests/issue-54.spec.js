const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: tabla de récords local (top 5 con nombre, resaltado, borrar, mejor combo y líneas máximas) (issue #54).
// Cada prueba parte con localStorage vacío y la gravedad detenida: el GAME OVER se provoca
// con una torre en el centro (como en issue-48) o con hard drops, y las capturas no cambian.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=54 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 54);
  // Ayudas de la prueba en la página. Solo usan funciones y variables del juego; no lo modifican.
  await page.addInitScript(() => {
    const qa = {
      fila(r, huecos, color = 1) {
        for (let c = 0; c < COLS; c++) board[r][c] = huecos.includes(c) ? 0 : color;
      },
      fijar(type, shape, x) {
        current = { type, shape: shape.map((f) => [...f]), x, y: 0, rot: 0 };
        lastRotated = false;
        current.y = ghostY();
        lockPiece();
      },
      // Una línea con un 1×1 (un bloque suelto evita el Perfect Clear): sube el combo
      linea() {
        board = createBoard();
        board[10][0] = 1;
        qa.fila(ROWS - 1, [4]);
        qa.fijar(SINGLE, [[SINGLE]], 4);
      },
      // Fija una pieza sin completar línea: el combo vuelve a 0
      sinLinea() {
        board = createBoard();
        board[10][0] = 1;
        qa.fijar(SINGLE, [[SINGLE]], 0);
      },
      // GAME OVER: una torre en el centro, donde aparecen las piezas, y la siguiente no cabe.
      // Con `puntos` fija antes la puntuación de la partida.
      terminar(puntos) {
        if (puntos !== undefined) score = puntos;
        board = createBoard();
        for (let f = 1; f < ROWS; f++)
          for (let c = 3; c <= 6; c++) board[f][c] = 1 + ((f + c) % 7);
        next = { type: 3, shape: PIECES[3].map((f) => [...f]), x: 3, y: 0 };
        spawn();
        draw();
        return gameOver;
      },
      guardados() {
        return JSON.parse(localStorage.getItem('records'));
      },
    };
    window.qa = qa;
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => cancelAnimationFrame(animId));
});

// Filas de una tabla de récords: texto de cada celda y si está resaltada
function tabla(page, tbody) {
  return page.evaluate((id) => [...document.querySelectorAll(`#${id} tr`)].map((tr) => ({
    celdas: [...tr.cells].map((td) => td.textContent),
    resaltada: tr.classList.contains('record-current'),
  })), tbody);
}

const puntos = (texto) => Number(texto.replace(/\D/g, ''));

// Guarda récords en localStorage y recarga, como si vinieran de partidas anteriores
async function sembrar(page, datos) {
  await page.evaluate((d) => localStorage.setItem('records', typeof d === 'string' ? d : JSON.stringify(d)), datos);
  await page.reload();
  await page.evaluate(() => cancelAnimationFrame(animId));
}

const registro = (name, score, extra = {}) => ({ name, score, lines: 0, level: 1, maxCombo: 0, date: '2026-11-01T10:00:00.000Z', ...extra });

test('al cargar la página la tabla RÉCORDS se ve vacía, sin tapar el tablero, y el juego arranca solo', async ({ page }) => {
  const records = page.locator('#records');
  await expect(records).toBeVisible();
  await expect(page.locator('#records-title')).toHaveText('RÉCORDS');
  expect(await tabla(page, 'records-table')).toEqual([{ celdas: ['Sin récords todavía'], resaltada: false }]);
  await expect(page.locator('#records-stats')).toHaveText('Mejor combo: 0 · Líneas máximas: 0');
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#gameover-records')).toBeHidden();
  const estado = await page.evaluate(() => ({ gameOver, paused, hayPieza: Boolean(current) }));
  expect(estado).toEqual({ gameOver: false, paused: false, hayPieza: true });

  // La tabla queda debajo del tablero y del panel, en las dos ventanas de las pruebas
  for (const ventana of [VENTANA, { width: 1080, height: 1920 }]) {
    await page.setViewportSize(ventana);
    const cajaTabla = await records.boundingBox();
    const cajaJuego = await page.locator('.game-container').boundingBox();
    expect(cajaTabla.y).toBeGreaterThanOrEqual(cajaJuego.y + cajaJuego.height);
  }
  await page.setViewportSize(VENTANA);
  await capturar(page, 'tabla-vacia-al-cargar');
});

test('al cargar se muestran los récords guardados: ordenados, como mucho 5, con mejor combo y líneas máximas', async ({ page }) => {
  await sembrar(page, {
    top: [registro('Eva', 300), registro('Ana', 900, { lines: 12, level: 2, maxCombo: 4 }), registro('Luis', 100),
      registro('Sol', 700), registro('Max', 500), registro('Teo', 50)],
    bestCombo: 7,
    maxLines: 42,
  });
  const filas = await tabla(page, 'records-table');
  expect(filas.map((f) => f.celdas[1])).toEqual(['Ana', 'Sol', 'Max', 'Eva', 'Luis']);
  expect(filas[0].celdas).toEqual(['1', 'Ana', '900', '12', '2', '4']);
  expect(filas.some((f) => f.resaltada)).toBe(false);
  await expect(page.locator('#records-stats')).toHaveText('Mejor combo: 7 · Líneas máximas: 42');
  await capturar(page, 'tabla-con-records-al-cargar');
});

test('GAME OVER jugando con hard drops: «¡Nuevo récord! Puesto #1», campo de nombre enfocado y fila resaltada', async ({ page }) => {
  for (let i = 0; i < 100 && !(await page.evaluate(() => gameOver)); i++) await page.keyboard.press('Space');
  const fin = await page.evaluate(() => ({ gameOver, score, texto: document.getElementById('overlay-score').textContent, esperado: `Puntuación: ${score.toLocaleString()}` }));
  expect(fin.gameOver).toBe(true);
  expect(fin.score).toBeGreaterThan(0);
  expect(fin.texto).toBe(fin.esperado);

  await expect(page.locator('#overlay-title')).toHaveText('GAME OVER');
  await expect(page.locator('#gameover-message')).toHaveText('¡Nuevo récord! Puesto #1');
  await expect(page.locator('#record-name')).toBeVisible();
  await expect(page.locator('#record-name')).toBeFocused();
  await expect(page.locator('#record-save')).toHaveText('Guardar');
  const filas = await tabla(page, 'gameover-table');
  expect(filas).toHaveLength(1);
  expect(filas[0].resaltada).toBe(true);
  expect(puntos(filas[0].celdas[2])).toBe(fin.score);
  expect((await tabla(page, 'records-table'))[0].resaltada).toBe(true);
  await capturar(page, 'game-over-nuevo-record');
});

test('escribir el nombre no mueve la pieza ni pausa, y Enter lo guarda una sola vez', async ({ page }) => {
  // Durante la partida, las teclas que llegan a un campo de texto no son del juego
  const antes = await page.evaluate(() => ({ x: current.x, y: current.y, piezas: pieces, paused }));
  const despues = await page.evaluate(() => {
    const campo = document.getElementById('record-name');
    for (const code of ['KeyP', 'Space', 'ArrowLeft', 'ArrowDown', 'ArrowUp'])
      campo.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    return { x: current.x, y: current.y, piezas: pieces, paused };
  });
  expect(despues).toEqual(antes);

  expect(await page.evaluate(() => qa.terminar(1234))).toBe(true);
  await expect(page.locator('#record-name')).toBeFocused();
  // Espacio mantenido desde la partida: ni la repetición ni los espacios iniciales ocupan el nombre
  for (let i = 0; i < 4; i++) await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(page.locator('#record-name')).toHaveValue('');
  await page.keyboard.type('Ana Pepa'); // lleva P y Espacio
  await expect(page.locator('#record-name')).toHaveValue('Ana Pepa');
  await expect(page.locator('#overlay-title')).toHaveText('GAME OVER');
  expect(await page.evaluate(() => paused)).toBe(false);

  await page.keyboard.press('Enter');
  await expect(page.locator('#record-form')).toBeHidden();
  await expect(page.locator('#gameover-message')).toHaveText('¡Nuevo récord! Puesto #1 · Guardado');
  for (const id of ['gameover-table', 'records-table']) {
    const filas = await tabla(page, id);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ resaltada: true });
    expect(filas[0].celdas.slice(0, 2)).toEqual(['1', 'Ana Pepa']);
    expect(puntos(filas[0].celdas[2])).toBe(1234);
  }
  // Un segundo envío no guarda otra vez
  const guardados = await page.evaluate(() => {
    document.getElementById('record-form').requestSubmit();
    saveRecordName();
    recordGameOver(); // un segundo endGame tampoco duplica la partida
    return qa.guardados();
  });
  expect(guardados.top).toHaveLength(1);
  expect(guardados.top[0]).toMatchObject({ name: 'Ana Pepa', score: 1234, lines: 0, level: 1, maxCombo: 0 });
  expect(typeof guardados.top[0].date).toBe('string');
  await capturar(page, 'nombre-guardado-con-enter');
});

test('Guardar con el campo vacío usa «Jugador» y un nombre largo se corta a 12 letras', async ({ page }) => {
  await page.evaluate(() => qa.terminar(400));
  await page.locator('#record-save').click();
  expect((await page.evaluate(() => qa.guardados())).top.map((r) => r.name)).toEqual(['Jugador']);

  await page.locator('#restart-btn').click();
  await page.evaluate(() => { cancelAnimationFrame(animId); qa.terminar(800); });
  await expect(page.locator('#gameover-message')).toHaveText('¡Nuevo récord! Puesto #1');
  await page.locator('#record-name').fill('NombreMuyLargoDeVerdad');
  await expect(page.locator('#record-name')).toHaveValue('NombreMuyLar'); // maxlength=12
  await page.locator('#record-save').click();
  const top = (await page.evaluate(() => qa.guardados())).top;
  expect(top.map((r) => [r.name, r.score])).toEqual([['NombreMuyLar', 800], ['Jugador', 400]]);
  const filas = await tabla(page, 'gameover-table');
  expect(filas.map((f) => f.resaltada)).toEqual([true, false]);
  await capturar(page, 'nombre-vacio-y-nombre-largo');
});

test('reiniciar sin guardar conserva la puntuación como «Jugador»; en PAUSA no aparecen los récords', async ({ page }) => {
  await page.evaluate(() => qa.terminar(500));
  await expect(page.locator('#record-form')).toBeVisible();
  await page.locator('#restart-btn').click();
  await page.evaluate(() => cancelAnimationFrame(animId));

  expect((await page.evaluate(() => qa.guardados())).top).toMatchObject([{ name: 'Jugador', score: 500 }]);
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#gameover-records')).toBeHidden();
  const filas = await tabla(page, 'records-table');
  expect(filas.map((f) => [f.celdas[1], puntos(f.celdas[2]), f.resaltada])).toEqual([['Jugador', 500, false]]);
  // Las teclas vuelven al juego tras reiniciar: ni el campo ni Reiniciar quedan con el foco
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await capturar(page, 'reinicio-sin-guardar');

  await page.keyboard.press('KeyP');
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#overlay-title')).toHaveText('PAUSA');
  await expect(page.locator('#gameover-records')).toBeHidden();
  await capturar(page, 'pausa-sin-records');
});

test('una puntuación del puesto 3 desplaza a la 5.ª; un empate con la 5.ª o 0 puntos no entran', async ({ page }) => {
  await sembrar(page, { top: [5000, 4000, 3000, 2000, 1000].map((s, i) => registro(`P${i + 1}`, s)), bestCombo: 0, maxLines: 0 });
  await page.evaluate(() => qa.terminar(3500));
  await expect(page.locator('#gameover-message')).toHaveText('¡Nuevo récord! Puesto #3');
  let filas = await tabla(page, 'gameover-table');
  expect(filas.map((f) => puntos(f.celdas[2]))).toEqual([5000, 4000, 3500, 3000, 2000]);
  expect(filas.map((f) => f.resaltada)).toEqual([false, false, true, false, false]);
  await capturar(page, 'record-puesto-3');

  await page.locator('#restart-btn').click();
  await page.evaluate(() => { cancelAnimationFrame(animId); qa.terminar(2000); });
  await expect(page.locator('#gameover-message')).toHaveText('Sin récord esta vez');
  await expect(page.locator('#record-form')).toBeHidden();
  filas = await tabla(page, 'gameover-table');
  expect(filas.map((f) => puntos(f.celdas[2]))).toEqual([5000, 4000, 3500, 3000, 2000]);
  expect(filas.some((f) => f.resaltada)).toBe(false);
  expect((await page.evaluate(() => qa.guardados())).top).toHaveLength(5);
  await capturar(page, 'sin-record-empate-con-el-quinto');

  // Con la tabla vacía, una partida de 0 puntos tampoco entra
  await page.evaluate(() => { clearRecords(); init(); cancelAnimationFrame(animId); qa.terminar(0); });
  await expect(page.locator('#gameover-message')).toHaveText('Sin récord esta vez');
  expect(await page.evaluate(() => qa.guardados().top)).toEqual([]);
});

test('se muestran el mejor combo y las líneas máximas, y se conservan entre partidas', async ({ page }) => {
  const partida = await page.evaluate(() => {
    score = 0;
    qa.linea();
    qa.linea();
    qa.linea();
    qa.sinLinea(); // el combo se rompe, pero el mejor de la partida sigue en 3
    const r = { combo, maxCombo, lines };
    qa.terminar();
    return r;
  });
  expect(partida).toEqual({ combo: 0, maxCombo: 3, lines: 3 });
  await expect(page.locator('#gameover-stats')).toHaveText('Mejor combo: 3 · Líneas máximas: 3');
  await expect(page.locator('#records-stats')).toHaveText('Mejor combo: 3 · Líneas máximas: 3');
  const fila = (await tabla(page, 'gameover-table'))[0];
  expect(fila.celdas.slice(3)).toEqual(['3', '1', '3']); // líneas, nivel y combo de la partida
  await capturar(page, 'mejor-combo-y-lineas');

  // Una partida peor no baja los máximos; init() vuelve maxCombo a 0
  await page.locator('#restart-btn').click();
  const segunda = await page.evaluate(() => {
    cancelAnimationFrame(animId);
    const alEmpezar = maxCombo;
    qa.linea();
    qa.terminar();
    return { alEmpezar, maxCombo, guardados: qa.guardados() };
  });
  expect(segunda.alEmpezar).toBe(0);
  expect(segunda.maxCombo).toBe(1);
  expect(segunda.guardados).toMatchObject({ bestCombo: 3, maxLines: 3 });
  expect(segunda.guardados.top.map((r) => [r.score, r.lines, r.maxCombo])).toEqual([[600, 3, 3], [100, 1, 1]]);
  await expect(page.locator('#gameover-stats')).toHaveText('Mejor combo: 3 · Líneas máximas: 3');
  await capturar(page, 'maximos-se-conservan');
});

test('Borrar récords pide confirmación en la página y luego vacía la tabla', async ({ page }) => {
  let dialogo = false;
  page.on('dialog', async (d) => { dialogo = true; await d.dismiss(); });
  await sembrar(page, { top: [registro('Ana', 900), registro('Sol', 700), registro('Max', 500)], bestCombo: 5, maxLines: 20 });

  await page.locator('#records-reset').click();
  await expect(page.locator('#records-confirm')).toBeVisible();
  await expect(page.locator('#records-confirm')).toContainText('¿Borrar todos los récords?');
  await expect(page.locator('#records-reset')).toBeHidden();
  expect((await page.evaluate(() => qa.guardados())).top).toHaveLength(3); // todavía no se borró nada
  await capturar(page, 'confirmar-borrado');

  await page.locator('#records-confirm-no').click();
  await expect(page.locator('#records-confirm')).toBeHidden();
  await expect(page.locator('#records-reset')).toBeVisible();
  expect(await tabla(page, 'records-table')).toHaveLength(3);

  await page.locator('#records-reset').click();
  await page.locator('#records-confirm-yes').click();
  expect(await tabla(page, 'records-table')).toEqual([{ celdas: ['Sin récords todavía'], resaltada: false }]);
  await expect(page.locator('#records-stats')).toHaveText('Mejor combo: 0 · Líneas máximas: 0');
  expect(await page.evaluate(() => localStorage.getItem('records'))).toBeNull();
  expect(dialogo).toBe(false);
  await capturar(page, 'records-borrados');
  // Los botones no se quedan con el foco: la tecla P sigue pausando el juego
  await page.keyboard.press('KeyP');
  await expect(page.locator('#overlay-title')).toHaveText('PAUSA');
});

test('datos dañados en localStorage no rompen el juego ni la tabla', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await sembrar(page, '{esto no es JSON');
  expect(await tabla(page, 'records-table')).toEqual([{ celdas: ['Sin récords todavía'], resaltada: false }]);
  expect(await page.evaluate(() => ({ gameOver, hayPieza: Boolean(current) }))).toEqual({ gameOver: false, hayPieza: true });

  // Registros con tipos incorrectos: solo queda el válido, con los campos saneados
  await sembrar(page, { top: [{ name: 5, score: '100' }, { name: '  Ok  ', score: 300, lines: -2 }, { name: 'Cero', score: 0.5 }, null, 'x'], bestCombo: 'x', maxLines: 4 });
  const filas = await tabla(page, 'records-table');
  expect(filas.map((f) => f.celdas)).toEqual([['1', 'Ok', '300', '0', '1', '0']]);
  await expect(page.locator('#records-stats')).toHaveText('Mejor combo: 0 · Líneas máximas: 4');

  await page.evaluate(() => qa.terminar(150));
  await page.locator('#record-name').fill('Nuevo');
  await page.keyboard.press('Enter');
  const guardados = await page.evaluate(() => qa.guardados());
  expect(guardados.top.map((r) => [r.name, r.score])).toEqual([['Ok', 300], ['Nuevo', 150]]);
  expect(errores).toEqual([]);
  await capturar(page, 'datos-danados-ignorados');
});

test('un récord guardado desde otra pestaña no se pierde al terminar la partida', async ({ page }) => {
  await sembrar(page, { top: [registro('Ana', 900)], bestCombo: 2, maxLines: 10 });
  // Otra pestaña guarda después de que esta página cargó la tabla
  const guardados = await page.evaluate(() => {
    localStorage.setItem('records', JSON.stringify({
      top: [{ name: 'Otra', score: 5000, lines: 30, level: 4, maxCombo: 6, date: '2026-11-02T10:00:00.000Z' },
        { name: 'Ana', score: 900, lines: 0, level: 1, maxCombo: 0, date: '2026-11-01T10:00:00.000Z' }],
      bestCombo: 6,
      maxLines: 30,
    }));
    qa.terminar(1200);
    return qa.guardados();
  });
  expect(guardados.top.map((r) => [r.name, r.score])).toEqual([['Otra', 5000], ['Jugador', 1200], ['Ana', 900]]);
  expect(guardados).toMatchObject({ bestCombo: 6, maxLines: 30 });
  await expect(page.locator('#gameover-message')).toHaveText('¡Nuevo récord! Puesto #2');
  await capturar(page, 'record-de-otra-pestana-conservado');
});
