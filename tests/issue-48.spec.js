const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: modo combo y multiplicadores (combo, T-spin, Back-to-Back, Perfect Clear, efectos y sonido) (issue #48).
// La gravedad se detiene al cargar: las jugadas se hacen con las teclas o fijando piezas a mano,
// y las capturas no cambian mientras se espera a que aparezcan los avisos.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=48 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

// Los avisos aparecen con una animación de ~200 ms y duran 1,3 s
const VER_AVISOS = 250;

test.beforeEach(async ({ page }) => {
  await fijarSemilla(page, 48);
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
      tecla(code) {
        document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      },
      // Una línea: fila inferior llena salvo la columna 4, completada por un 1×1.
      // El bloque suelto evita que el tablero quede vacío (eso sería un Perfect Clear).
      linea() {
        board = createBoard();
        board[10][0] = 1;
        qa.fila(ROWS - 1, [4]);
        qa.fijar(SINGLE, [[SINGLE]], 4);
      },
      // Un Tetris: 4 filas llenas salvo la columna 9, completadas por una I vertical
      tetris() {
        board = createBoard();
        board[10][0] = 1;
        for (let r = ROWS - 4; r < ROWS; r++) qa.fila(r, [9], 2);
        qa.fijar(1, rotateCW(PIECES[1]), 7);
      },
      // Fija una pieza sin completar ninguna línea
      sinLinea() {
        board = createBoard();
        board[10][0] = 1;
        qa.fijar(SINGLE, [[SINGLE]], 0);
      },
      // Una línea que deja el tablero vacío
      perfecto() {
        board = createBoard();
        qa.fila(ROWS - 1, [4]);
        qa.fijar(SINGLE, [[SINGLE]], 4);
      },
      // Ranura de T-spin doble: hueco en T bajo un saliente en la columna 3. La T empieza arriba.
      ranuraT() {
        board = createBoard();
        qa.fila(ROWS - 1, [4]);
        qa.fila(ROWS - 2, [3, 4, 5]);
        board[ROWS - 3][3] = 1;
        current = { type: 3, shape: PIECES[3].map((f) => [...f]), x: 3, y: 0, rot: 0 };
        lastRotated = false;
      },
      // Con el teclado: girar en el aire, bajar con ↓ hasta apoyarse, girar dentro de la ranura y soltar
      tspinDoble() {
        qa.tecla('ArrowUp');
        while (!collide(current.shape, current.x, current.y + 1)) qa.tecla('ArrowDown');
        qa.tecla('ArrowUp');
        qa.tecla('Space');
      },
      hud() {
        return {
          combo: comboHud.hidden ? null : comboValue.textContent,
          nivel: comboHud.dataset.nivel,
          b2b: b2bHud.hidden ? null : b2bBadge.textContent,
          avisos: [...toastsEl.children].map((e) => e.textContent),
        };
      },
    };
    window.qa = qa;
  });
  await page.goto('/');
  await page.evaluate(() => cancelAnimationFrame(animId));
});

test('el combo sube con cada eliminación seguida, se detiene en ×8 y vuelve a 0 al fijar sin línea', async ({ page }) => {
  const r = await page.evaluate(() => {
    score = 0;
    const pasos = [];
    for (let i = 0; i < 9; i++) {
      const antes = score;
      qa.linea();
      pasos.push({ puntos: score - antes, combo });
    }
    const antes = score;
    qa.sinLinea();
    const roto = { puntos: score - antes, combo };
    qa.linea();
    const reinicio = { combo, multiplicador: qa.hud().combo };
    // Evidencia: el combo en el tope
    for (let i = 0; i < 7; i++) qa.linea();
    draw();
    return { pasos, roto, reinicio, hud: qa.hud() };
  });
  // 100 puntos por línea en nivel 1, multiplicados por el combo (tope ×8)
  expect(r.pasos.map((p) => p.puntos)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 800]);
  expect(r.pasos.map((p) => p.combo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(r.roto).toEqual({ puntos: 0, combo: 0 });
  expect(r.reinicio).toEqual({ combo: 1, multiplicador: '×1' });
  expect(r.hud.combo).toBe('×8');
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'combo-en-el-tope-x8');
});

test('el contador de combo se ve mientras está activo y desaparece al romperse', async ({ page }) => {
  const inicial = await page.evaluate(() => qa.hud().combo);
  expect(inicial).toBeNull();

  const activo = await page.evaluate(() => {
    qa.linea();
    qa.linea();
    qa.linea();
    draw();
    return qa.hud().combo;
  });
  expect(activo).toBe('×3');
  await expect(page.locator('#combo-hud')).toBeVisible();
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'contador-combo-activo');

  const roto = await page.evaluate(() => {
    qa.sinLinea();
    draw();
    return qa.hud().combo;
  });
  expect(roto).toBeNull();
  await expect(page.locator('#combo-hud')).toBeHidden();
  await capturar(page, 'contador-combo-oculto-al-romperse');
});

test('T-spin doble con el teclado: girar, bajar y girar dentro de la ranura', async ({ page }) => {
  const r = await page.evaluate(() => {
    const eventos = [];
    onGameEvent((e) => eventos.push(e));
    score = 0;
    qa.ranuraT();
    qa.tspinDoble();
    draw();
    return {
      score,
      lines,
      tspin: eventos.filter((e) => e.type === 'tspin').map((e) => [e.variant, e.cleared, e.label]),
      avisos: qa.hud().avisos,
      etiquetas: [tspinLabel('normal', 0), tspinLabel('normal', 1), tspinLabel('normal', 3), tspinLabel('mini', 0)],
    };
  });
  // 1200 del T-spin doble en nivel 1 + 17 filas de soft drop
  expect(r.score).toBe(1217);
  expect(r.lines).toBe(2);
  expect(r.tspin).toEqual([['normal', 2, 'T-SPIN DOUBLE']]);
  expect(r.avisos).toContain('T-SPIN DOUBLE');
  expect(r.etiquetas).toEqual(['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN TRIPLE', 'T-SPIN MINI']);
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'tspin-doble');
});

test('T-spin Mini: tres esquinas ocupadas pero no las dos del frente de la T', async ({ page }) => {
  const r = await page.evaluate(() => {
    const eventos = [];
    onGameEvent((e) => eventos.push(e));
    score = 0;
    board = createBoard();
    qa.fila(ROWS - 1, [4, 5]);
    qa.fila(ROWS - 2, [3, 4, 5]);
    board[ROWS - 3][3] = 1;
    board[ROWS - 3][5] = 1;
    // La T se coloca a mano junto al hueco, apuntando a la derecha; el giro sí se hace con la tecla
    current = { type: 3, shape: rotateCW(PIECES[3]), x: 3, y: ROWS - 3, rot: 1 };
    lastRotated = false;
    qa.tecla('ArrowUp');
    qa.tecla('Space');
    draw();
    return {
      score,
      lines,
      tspin: eventos.filter((e) => e.type === 'tspin').map((e) => [e.variant, e.cleared, e.label]),
      avisos: qa.hud().avisos,
    };
  });
  // Mini con 1 línea: 200 en nivel 1
  expect(r.score).toBe(200);
  expect(r.lines).toBe(1);
  expect(r.tspin).toEqual([['mini', 1, 'T-SPIN MINI']]);
  expect(r.avisos).toContain('T-SPIN MINI');
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'tspin-mini');
});

test('sin un giro como último movimiento no hay T-spin, aunque tres esquinas estén ocupadas', async ({ page }) => {
  const r = await page.evaluate(() => {
    const eventos = [];
    onGameEvent((e) => eventos.push(e));
    score = 0;
    // Hueco con las esquinas superior izquierda, inferior izquierda e inferior derecha ocupadas
    board = createBoard();
    qa.fila(ROWS - 1, [4]);
    qa.fila(ROWS - 2, [4, 5]);
    board[ROWS - 3][3] = 1;
    current = { type: 3, shape: PIECES[3].map((f) => [...f]), x: 3, y: 0, rot: 0 };
    lastRotated = false;
    qa.tecla('ArrowUp'); // gira en el aire
    qa.tecla('Space');   // la caída es el último movimiento: cancela el giro
    draw();
    return { score, lines, tspin: eventos.filter((e) => e.type === 'tspin').length, avisos: qa.hud().avisos };
  });
  // Doble normal: 300 + 17 filas de hard drop × 2
  expect(r).toEqual({ score: 334, lines: 2, tspin: 0, avisos: [] });
  await capturar(page, 'sin-giro-no-es-tspin');
});

test('Back-to-Back: se activa con un Tetris, sobrevive a una pieza sin línea, sigue con un T-spin y se rompe con una línea normal', async ({ page }) => {
  const r = await page.evaluate(() => {
    score = 0;
    lines = 0;
    const pasos = [];
    const paso = (nombre, jugada) => {
      const antes = score;
      jugada();
      pasos.push({ nombre, puntos: score - antes, b2b, combo, hud: qa.hud().b2b, avisos: qa.hud().avisos });
    };
    paso('tetris', qa.tetris);
    paso('sin línea', qa.sinLinea);
    paso('tetris', qa.tetris);
    paso('t-spin doble', () => { qa.ranuraT(); qa.tspinDoble(); });
    draw();
    return pasos;
  });
  expect(r.map((p) => p.puntos)).toEqual([
    800,                // primer Tetris: activa el B2B, sin bonificación
    0,                  // fijar sin línea rompe el combo, no el B2B
    1200,               // 800 × 1,5
    1800 * 2 + 17,      // 1200 × 1,5, con combo ×2, + 17 de soft drop
  ]);
  expect(r.map((p) => p.b2b)).toEqual([1, 1, 2, 3]);
  expect(r.map((p) => p.hud)).toEqual(['B2B ACTIVADO', 'B2B ACTIVADO', 'B2B x2', 'B2B x3']);
  expect(r[0].avisos).toContain('B2B ACTIVADO');
  expect(r[2].avisos).toContain('BACK-TO-BACK');
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'b2b-x3-tras-tspin');

  const roto = await page.evaluate(() => {
    const antes = score;
    qa.linea(); // una línea suelta no es elegible
    draw();
    return { puntos: score - antes, b2b, combo, level, hud: qa.hud().b2b };
  });
  // Ya hay 10 líneas: nivel 2. Línea sola 100 × 2 con combo ×3, sin B2B
  expect(roto).toEqual({ puntos: 600, b2b: 0, combo: 3, level: 2, hud: null });
  await capturar(page, 'b2b-roto-con-linea-normal');
});

test('Perfect Clear: tablero vacío tras eliminar, con su bonificación multiplicada por el combo', async ({ page }) => {
  const r = await page.evaluate(() => {
    const eventos = [];
    onGameEvent((e) => eventos.push(e));
    score = 0;
    board = createBoard();
    qa.fila(ROWS - 1, [4]);
    qa.fila(ROWS - 2, [4]);
    qa.fijar(SINGLE, [[SINGLE]], 4); // elimina la fila de abajo; queda otra igual
    const primera = score;
    qa.fijar(SINGLE, [[SINGLE]], 4); // la elimina y el tablero queda vacío
    draw();
    return {
      primera,
      segunda: score - primera,
      vacio: board.flat().every((v) => v === 0),
      perfect: eventos.filter((e) => e.type === 'perfect-clear').map((e) => [e.cleared, e.bonus]),
      avisos: qa.hud().avisos,
      destello: document.getElementById('flash').classList.contains('on'),
    };
  });
  expect(r.primera).toBe(100);
  // (100 + 800 del Perfect Clear) × combo 2
  expect(r.segunda).toBe(1800);
  expect(r.vacio).toBe(true);
  expect(r.perfect).toEqual([[1, 800]]);
  expect(r.avisos).toContain('PERFECT CLEAR');
  expect(r.destello).toBe(true);
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'perfect-clear-con-combo');
});

test('la puntuación sigue la fórmula del issue y ningún evento se repite en una jugada', async ({ page }) => {
  // Fórmula del issue: puntos = round((base × B2B + perfectClear) × combo)
  const formula = ({ base, b2b = 1, perfect = 0, combo = 1 }) => Math.round((base * b2b + perfect) * combo);
  const casos = [
    { nombre: 'línea sola, como antes', in: { cleared: 1, combo: 0, b2b: 0, level: 1 }, puntos: formula({ base: 100 }), combo: 1, b2b: 0 },
    { nombre: 'doble en nivel 3', in: { cleared: 2, combo: 0, b2b: 0, level: 3 }, puntos: formula({ base: 900 }), combo: 1, b2b: 0 },
    { nombre: 'Tetris con B2B y combo previo 2', in: { cleared: 4, combo: 2, b2b: 1, level: 1 }, puntos: formula({ base: 800, b2b: 1.5, combo: 3 }), combo: 3, b2b: 2 },
    { nombre: 'T-spin sin líneas', in: { cleared: 0, tspin: 'normal', combo: 4, b2b: 2, level: 1 }, puntos: formula({ base: 400 }), combo: 0, b2b: 2 },
    { nombre: 'T-spin single', in: { cleared: 1, tspin: 'normal', combo: 0, b2b: 0, level: 1 }, puntos: formula({ base: 800 }), combo: 1, b2b: 1 },
    { nombre: 'T-spin triple con B2B', in: { cleared: 3, tspin: 'normal', combo: 0, b2b: 1, level: 1 }, puntos: formula({ base: 1600, b2b: 1.5 }), combo: 1, b2b: 2 },
    { nombre: 'Mini sin líneas', in: { cleared: 0, tspin: 'mini', combo: 3, b2b: 0, level: 1 }, puntos: formula({ base: 100 }), combo: 0, b2b: 0 },
    { nombre: 'Mini doble en nivel 2', in: { cleared: 2, tspin: 'mini', combo: 0, b2b: 0, level: 2 }, puntos: formula({ base: 800 }), combo: 1, b2b: 1 },
    { nombre: 'Perfect Clear con Tetris, B2B y combo', in: { cleared: 4, perfect: true, combo: 1, b2b: 1, level: 1 }, puntos: formula({ base: 800, b2b: 1.5, perfect: 2000, combo: 2 }), combo: 2, b2b: 2 },
    { nombre: 'tope del combo', in: { cleared: 1, combo: 10, b2b: 0, level: 1 }, puntos: formula({ base: 100, combo: 8 }), combo: 11, b2b: 0 },
    { nombre: 'línea sola rompe el B2B', in: { cleared: 1, combo: 0, b2b: 3, level: 1 }, puntos: formula({ base: 100 }), combo: 1, b2b: 0 },
  ];
  const r = await page.evaluate((entradas) => entradas.map((e) => {
    const res = scoreMove({ tspin: null, perfect: false, ...e });
    const tipos = res.events.map((ev) => ev.type);
    return { puntos: res.points, combo: res.combo, b2b: res.b2b, repetidos: tipos.length - new Set(tipos).size };
  }), casos.map((c) => c.in));
  casos.forEach((c, i) => {
    expect(r[i], c.nombre).toEqual({ puntos: c.puntos, combo: c.combo, b2b: c.b2b, repetidos: 0 });
  });
});

test('los avisos flotantes no se acumulan y el combo gana intensidad con el multiplicador', async ({ page }) => {
  const r = await page.evaluate(() => {
    const pasos = [];
    for (let i = 0; i < 9; i++) {
      qa.linea();
      const h = qa.hud();
      pasos.push({ nivel: h.nivel, avisos: h.avisos.length, pulso: comboValue.classList.contains('pulse') });
    }
    draw();
    return { pasos, maximo: MAX_TOASTS, avisos: qa.hud().avisos };
  });
  // Intensidad 0 hasta ×2, 1 desde ×3, 2 desde ×5 y 3 en el tope ×8
  expect(r.pasos.map((p) => p.nivel)).toEqual(['0', '0', '1', '1', '2', '2', '2', '3', '3']);
  expect(r.pasos.every((p) => p.pulso)).toBe(true);
  expect(Math.max(...r.pasos.map((p) => p.avisos))).toBeLessThanOrEqual(r.maximo);
  expect(r.maximo).toBe(3);
  // Quedan los 3 más recientes
  expect(r.avisos).toEqual(['COMBO ×7', 'COMBO ×8', 'COMBO ×8']);
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'avisos-limitados-e-intensidad-maxima');
});

test('cada evento tiene su sonido, y el interruptor y el volumen funcionan por separado', async ({ page }) => {
  const sonidos = await page.evaluate(() => {
    soundLog.length = 0;
    qa.linea();                      // combo ×1: sin sonido
    qa.linea();                      // combo ×2
    qa.ranuraT(); qa.tspinDoble();   // T-spin, combo ×3 y B2B
    qa.perfecto();                   // combo ×4 y Perfect Clear
    return soundLog.map((s) => [s.name, s.intensity, s.volume]);
  });
  expect(sonidos.map((s) => s[0])).toEqual(['combo', 'tspin', 'combo', 'b2b', 'combo', 'perfect']);
  expect(sonidos.filter((s) => s[0] === 'combo').map((s) => s[1])).toEqual([2, 3, 4]);
  expect(sonidos.every((s) => s[2] === 0.4)).toBe(true);

  const boton = page.locator('#sound-toggle');
  const volumen = page.locator('#volume');
  await expect(boton).toHaveText('🔊');
  await expect(volumen).toHaveValue('40');

  // Interruptor apagado: no suena y el volumen no cambia
  await boton.click();
  await expect(boton).toHaveText('🔇');
  await expect(volumen).toHaveValue('40');
  expect(await page.evaluate(() => { soundLog.length = 0; qa.linea(); return soundLog.length; })).toBe(0);

  // Encendido otra vez y con el volumen al 20 %
  await boton.click();
  await volumen.fill('20');
  await expect(boton).toHaveText('🔊');
  const conVolumen = await page.evaluate(() => { soundLog.length = 0; qa.linea(); return { log: soundLog.map((s) => s.volume), enabled: sound.enabled }; });
  expect(conVolumen).toEqual({ log: [0.2], enabled: true });
  await page.evaluate(() => draw());
  await capturar(page, 'controles-de-sonido-volumen-20');

  // Volumen 0: silencio, pero el interruptor sigue encendido
  await volumen.fill('0');
  await expect(boton).toHaveText('🔇');
  const enCero = await page.evaluate(() => { soundLog.length = 0; qa.linea(); return { sonidos: soundLog.length, enabled: sound.enabled }; });
  expect(enCero).toEqual({ sonidos: 0, enabled: true });
});

test('las reglas emiten eventos y funcionan sin la capa visual ni sonora', async ({ page }) => {
  const r = await page.evaluate(() => {
    gameListeners.length = 0; // se desconectan los efectos visuales y el sonido
    const vistos = [];
    onGameEvent((e) => vistos.push(e.type));
    soundLog.length = 0;
    score = 0;
    qa.tetris();
    const estado = JSON.stringify({ score, combo, b2b, lines, level, board });
    // scoreMove es una función pura: calcular una jugada no cambia el juego
    const puro = scoreMove({ cleared: 4, tspin: null, perfect: false, combo: 5, b2b: 3, level: 9 });
    draw();
    return {
      vistos,
      score,
      combo,
      b2b,
      puro: puro.points,
      sinCambios: estado === JSON.stringify({ score, combo, b2b, lines, level, board }),
      hud: qa.hud(),
      sonidos: soundLog.length,
    };
  });
  expect(r.vistos).toEqual(['combo', 'b2b-start', 'score']);
  expect({ score: r.score, combo: r.combo, b2b: r.b2b }).toEqual({ score: 800, combo: 1, b2b: 1 });
  expect(r.puro).toBe(Math.round(800 * 9 * 1.5 * 6));
  expect(r.sinCambios).toBe(true);
  // Sin suscriptores no se dibuja ni suena nada, pero la puntuación es la misma
  expect(r.hud).toEqual({ combo: null, nivel: undefined, b2b: null, avisos: [] });
  expect(r.sonidos).toBe(0);
  await capturar(page, 'reglas-sin-capa-visual');
});

test('funciona con las piezas especiales, sube de nivel en mitad del combo y mantiene la recompensa 1×1', async ({ page }) => {
  const r = await page.evaluate(() => {
    score = 0;
    lines = 8;
    level = 1;
    const pasos = [];
    const paso = (nombre, jugada) => {
      const antes = score;
      jugada();
      pasos.push({ nombre, puntos: score - antes, combo, level, lines });
    };
    paso('cruz +', () => {
      board = createBoard();
      board[10][0] = 1;
      qa.fila(ROWS - 1, [4]);
      qa.fila(ROWS - 2, [3, 4, 5]);
      qa.fijar(8, PIECES[8], 3);
    });
    paso('cuadrado hueco', () => {
      board = createBoard();
      board[10][9] = 1;
      qa.fila(ROWS - 1, [0, 1, 2]);
      qa.fijar(HOLLOW, PIECES[HOLLOW], 0);
    });
    paso('tetris', qa.tetris);
    draw();
    return { pasos, dropInterval, siguiente: next.type, hud: qa.hud().combo };
  });
  expect(r.pasos).toEqual([
    { nombre: 'cruz +', puntos: 300, combo: 1, level: 2, lines: 10 },         // doble en nivel 1
    { nombre: 'cuadrado hueco', puntos: 400, combo: 2, level: 2, lines: 11 }, // 100 × nivel 2 × combo 2
    { nombre: 'tetris', puntos: 4800, combo: 3, level: 2, lines: 15 },        // 800 × nivel 2 × combo 3
  ]);
  expect(r.dropInterval).toBe(910);
  expect(r.siguiente).toBe(11); // tras el Tetris sigue saliendo el 1×1
  expect(r.hud).toBe('×3');
  await page.waitForTimeout(VER_AVISOS);
  await capturar(page, 'combo-con-piezas-especiales');
});

test('GAME OVER con combo y B2B activos, y Reiniciar los deja en 0', async ({ page }) => {
  const r = await page.evaluate(() => {
    score = 0;
    qa.linea();  // una línea sola antes: después del Tetris rompería el B2B
    qa.tetris();
    const activos = { combo, b2b, hud: qa.hud() };
    // Una torre en el centro, donde aparecen las piezas: la siguiente no cabe
    board = createBoard();
    const colores = [1, 2, 3, 4, 5, 6, 7];
    for (let f = 1; f < ROWS; f++)
      for (let c = 3; c <= 6; c++) board[f][c] = colores[(f + c) % colores.length];
    next = { type: 3, shape: PIECES[3].map((f) => [...f]), x: 3, y: 0 };
    spawn();
    draw();
    return { activos, gameOver, texto: document.getElementById('overlay-score').textContent, esperado: `Puntuación: ${score.toLocaleString()}` };
  });
  expect(r.activos).toMatchObject({ combo: 2, b2b: 1, hud: { combo: '×2', b2b: 'B2B ACTIVADO' } });
  expect(r.gameOver).toBe(true);
  expect(r.texto).toBe(r.esperado);
  await expect(page.locator('#overlay')).toBeVisible();
  await capturar(page, 'game-over-con-combo-activo');

  await page.locator('#restart-btn').click();
  const reinicio = await page.evaluate(() => {
    cancelAnimationFrame(animId);
    draw();
    return { score, combo, b2b, gameOver, hud: qa.hud() };
  });
  expect(reinicio).toEqual({ score: 0, combo: 0, b2b: 0, gameOver: false, hud: { combo: null, nivel: '0', b2b: null, avisos: [] } });
  await capturar(page, 'reinicio-limpia-combo-y-b2b');
});
