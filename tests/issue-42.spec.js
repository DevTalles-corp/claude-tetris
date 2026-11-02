const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: piezas especiales (pentominós +, U, Y, bloque 1×1 y cuadrado hueco 3×3) (issue #42).
// Cada prueba cambia el estado y mide en un mismo page.evaluate: el bucle del juego sigue corriendo.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=42 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 42);
  await page.goto('/');
});

test('los pentominós +, U e Y tienen 5 bloques y rotan correctamente', async ({ page }) => {
  const r = await page.evaluate(() => {
    const celdas = (s) => s.flat().filter(Boolean).length;
    return PENTOMINOES.map((t) => {
      let s = PIECES[t];
      const rotada = rotateCW(s);
      for (let i = 0; i < 4; i++) s = rotateCW(s);
      return {
        tipo: t,
        bloques: celdas(PIECES[t]),
        bloquesRotada: celdas(rotada),
        vuelveAlOriginal: JSON.stringify(s) === JSON.stringify(PIECES[t]),
        igualTrasUnGiro: JSON.stringify(rotada) === JSON.stringify(PIECES[t]),
      };
    });
  });
  for (const p of r) {
    expect(p.bloques, `pieza ${p.tipo}`).toBe(5);
    expect(p.bloquesRotada, `pieza ${p.tipo} rotada`).toBe(5);
    expect(p.vuelveAlOriginal, `pieza ${p.tipo}: 4 giros`).toBe(true);
  }
  // La cruz es simétrica: un giro la deja igual. U e Y sí cambian de orientación.
  expect(r.map((p) => p.igualTrasUnGiro)).toEqual([true, false, false]);

  // Evidencia: las cinco piezas especiales fijadas en el tablero
  await page.evaluate(() => {
    board = createBoard();
    const poner = (t, x, y) => PIECES[t].forEach((fila, f) => fila.forEach((v, c) => { if (v) board[y + f][x + c] = v; }));
    poner(HOLLOW, 0, 17);
    poner(8, 3, 17);
    poner(9, 6, 18);
    poner(10, 6, 13);
    poner(SINGLE, 9, 19);
    current = { type: SINGLE, shape: [[SINGLE]], x: 4, y: 0 };
    draw();
  });
  await capturar(page, 'piezas-especiales-en-tablero');
});

test('las piezas especiales respetan paredes, suelo y otras piezas', async ({ page }) => {
  const r = await page.evaluate(() => {
    board = createBoard();
    return [...PENTOMINOES, SINGLE, HOLLOW].map((t) => {
      const s = PIECES[t];
      const cols = s[0].map((_, c) => s.some((f) => f[c]));
      const filas = s.map((f) => f.some(Boolean));
      const izq = cols.indexOf(true);
      const der = cols.lastIndexOf(true);
      const abajo = filas.lastIndexOf(true);
      const xMin = -izq;
      const xMax = COLS - 1 - der;
      const yMax = ROWS - 1 - abajo;
      // Un bloque fijo justo debajo de la primera celda inferior de la pieza
      const colApoyo = s[abajo].findIndex(Boolean);
      board[10 + abajo + 1][4 + colApoyo] = 1;
      const sobrePieza = collide(s, 4, 10 + 1);
      board = createBoard();
      return {
        tipo: t,
        paredIzq: !collide(s, xMin, 0) && collide(s, xMin - 1, 0),
        paredDer: !collide(s, xMax, 0) && collide(s, xMax + 1, 0),
        suelo: !collide(s, 0 - izq, yMax) && collide(s, 0 - izq, yMax + 1),
        sobrePieza,
      };
    });
  });
  for (const p of r) {
    expect(p, `pieza ${p.tipo}`).toEqual({ tipo: p.tipo, paredIzq: true, paredDer: true, suelo: true, sobrePieza: true });
  }
});

test('el cuadrado hueco conserva el centro vacío al fijarse y al rotar', async ({ page }) => {
  const r = await page.evaluate(() => {
    board = createBoard();
    current = { type: HOLLOW, shape: PIECES[HOLLOW].map((f) => [...f]), x: 3, y: 0 };
    const rotada = rotateCW(current.shape);
    current.y = ghostY();
    merge();
    const y = current.y;
    const bloques = board.flat().filter((v) => v === HOLLOW).length;
    draw();
    return {
      centro: board[y + 1][4],
      bloques,
      rotadaIgual: JSON.stringify(rotada) === JSON.stringify(PIECES[HOLLOW]),
      abajo: y + 2 === ROWS - 1,
    };
  });
  expect(r).toEqual({ centro: 0, bloques: 8, rotadaIgual: true, abajo: true });
  await capturar(page, 'cuadrado-hueco-centro-vacio');
});

test('las piezas nuevas completan líneas, suman puntos y suben de nivel', async ({ page }) => {
  const r = await page.evaluate(() => {
    board = createBoard();
    // Fila inferior llena salvo la columna 4; el bloque 1×1 la completa
    for (let c = 0; c < COLS; c++) if (c !== 4) board[ROWS - 1][c] = 1;
    lines = 9; score = 0; level = 1;
    current = { type: SINGLE, shape: [[SINGLE]], x: 4, y: 0 };
    current.y = ghostY();
    lockPiece();
    draw();
    return { lines, score, level, dropInterval, filaVacia: board[ROWS - 1].every((v) => v === 0) };
  });
  // 100 puntos por 1 línea en nivel 1; con 10 líneas pasa al nivel 2 (910 ms por caída)
  expect(r).toEqual({ lines: 10, score: 100, level: 2, dropInterval: 910, filaVacia: true });
  await capturar(page, 'linea-completada-con-1x1');
});

test('tras un Tetris, la pieza siguiente es el bloque 1×1', async ({ page }) => {
  const r = await page.evaluate(() => {
    board = createBoard();
    // 4 filas inferiores llenas salvo la columna 9; una I vertical las completa
    for (let f = ROWS - 4; f < ROWS; f++)
      for (let c = 0; c < 9; c++) board[f][c] = 2;
    lines = 0; score = 0; level = 1;
    const vertical = rotateCW(PIECES[1]); // la columna 2 de la matriz queda llena
    current = { type: 1, shape: vertical, x: 7, y: 0 };
    current.y = ghostY();
    lockPiece();
    draw();
    return { lines, score, siguiente: next.type, tableroVacio: board.flat().every((v) => v === 0) };
  });
  expect(r).toEqual({ lines: 4, score: 800, siguiente: 11, tableroVacio: true });
  await capturar(page, 'recompensa-1x1-tras-tetris');
});

test('frecuencias: hueco cerca del 1 %, pentominós cerca del 8 % y nunca dos especiales seguidas', async ({ page }) => {
  const r = await page.evaluate(() => {
    bonusSingle = false;
    lastSpecial = false;
    const N = 20000;
    const cuenta = {};
    let seguidas = 0;
    let anterior = 0;
    for (let i = 0; i < N; i++) {
      const t = randomPiece().type;
      cuenta[t] = (cuenta[t] || 0) + 1;
      if (t > 7 && anterior > 7) seguidas++;
      anterior = t;
    }
    const pct = (n) => (100 * (n || 0)) / N;
    return {
      hueco: pct(cuenta[HOLLOW]),
      pentominos: pct((cuenta[8] || 0) + (cuenta[9] || 0) + (cuenta[10] || 0)),
      single: cuenta[SINGLE] || 0,
      clasicas: [1, 2, 3, 4, 5, 6, 7].every((t) => cuenta[t] > 0),
      seguidas,
    };
  });
  test.info().annotations.push({ type: 'frecuencias', description: `hueco ${r.hueco.toFixed(2)} %, pentominós ${r.pentominos.toFixed(2)} %` });
  console.log(`FRECUENCIAS: hueco ${r.hueco.toFixed(2)} %, pentominós ${r.pentominos.toFixed(2)} %`);
  // Tras una especial siempre sale una clásica, así que la frecuencia real queda algo por debajo de la nominal
  expect(r.hueco).toBeGreaterThan(0.5);
  expect(r.hueco).toBeLessThan(1.5);
  expect(r.pentominos).toBeGreaterThan(6);
  expect(r.pentominos).toBeLessThan(10);
  expect(r.single, 'el 1×1 solo sale como recompensa').toBe(0);
  expect(r.clasicas).toBe(true);
  expect(r.seguidas).toBe(0);
});

test('una pieza especial que no cabe al aparecer termina la partida', async ({ page }) => {
  const r = await page.evaluate(() => {
    // Situación realista: una torre de piezas llega al techo en el centro, donde aparecen
    // las piezas. Las filas no se completan (a los lados hay huecos), así que no se eliminan.
    board = createBoard();
    const colores = [1, 2, 3, 4, 5, 6, 7];
    for (let f = 1; f < ROWS; f++)
      for (let c = 3; c <= 6; c++) board[f][c] = colores[(f + c) % colores.length];
    next = { type: HOLLOW, shape: PIECES[HOLLOW].map((f) => [...f]), x: 3, y: 0 };
    spawn();
    draw();
    return { gameOver, overlay: !document.getElementById('overlay').classList.contains('hidden') };
  });
  expect(r).toEqual({ gameOver: true, overlay: true });
  await capturar(page, 'game-over-con-cuadrado-hueco');
});
